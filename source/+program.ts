import * as Certificates from "./certificates";
import * as ProcessManager from "./processes/_pm2";
import { InternalProcesses } from "./processes";
import * as Redirections from "./traffic/redirections";
import * as InternalRoutes from "./traffic/internalRoutes";
import * as State from "./state";
import { createLogger } from "./messages";
import * as PrivateProcesses from "./processes/_pm2";
import * as PrivateMessages from "./messages/_messages";
import * as PrivateDatabase from "./database/_connection";
import { test } from "./dns/test";
// NOTE: clean up imports after program functionality is done
// NOTE: some private imports are made here

// PROGRAM
// This file contains the available commands callable
// from the CLI program. It is only loaded and run per command
// executed by the user

/** Logger */
const logger = createLogger("Server Manager");

/** Prints the current status of the server and managed processes */
export async function status(options: { network: boolean }) {
  await run(async () => {
    const runners = await ProcessManager.list();

    const table = runners.reduce<{
      [key: string | number]: Partial<object>;
    }>((tabularData, process) => {
      tabularData[process.index] = {
        LABEL: process.label,
        PID: process.pid,

        RESTARTS: process.details?.restarts || "?",
        MEM: process.details
          ? Math.round(process.details.memory / 1000000) + "mb"
          : "?",
        CPU: process.details ? process.details.cpu + "%" : "?",
        UPTIME: process.details
          ? Math.round(process.details.uptime / 10000000 / 60 / 60 / 60) + "h"
          : "?",
      };
      return tabularData;
    }, {});

    console.table(table);

    // FIXME: testcode
    console.log("tested!");
    // await scheduleOperation({
    //   timestamp: Date.now() + 10000,
    // });
  });
}

/** Reconfigures the manager with modifications to the app config file */
export async function reload() {
  await run(async () => {
    // FIXME: CONTINUE HERE this is where im currently working
    const state = await State.updateManagerState();
    const runners = await ProcessManager.list();
    const certs = await Certificates.list();

    console.log("RUNNING PROCESSES");
    console.log(JSON.stringify(runners, null, 4));
    console.log("DELTAS");
    console.log(JSON.stringify(state.operations, null, 4));
    console.log("NETWORK");
    console.log(JSON.stringify(state.network, null, 4));
    console.log("CERTIFICATES");
    console.log(JSON.stringify(certs, null, 4));

    console.log("Performing changes to internal routes...");
    await InternalRoutes.performOperations(state.operations.internalRoutes);

    console.log("Performing changes to redirection configurations...");
    await Redirections.performOperations(state.operations.redirections);

    console.log("Performing changes to certificate configurations...");
    await Certificates.performOperations(state.operations.hostnames);

    console.log("Performing changes to internal processes...");
    await InternalProcesses.performOperations(
      state.operations.internalProcesses
    );
    console.log("Scheduling certificate renewal if needed...");
    await Certificates.performCertificationRenewal();
    console.log("Done!");

    // TODO: new experiments
    //   for (const { port } of operations.uniquePorts) {
    //     const a = await Network.isPortAvailable(port);
    //     console.log(port, a);
    //   }
    //
    //   for (const { hostname } of operations.uniqueHostnames) {
    //     const a = await Network.nslookup(hostname);
    //     console.log(hostname, a);
    //   }
  });
}

/** Checks if the current app config file is valid */
export async function validate(options: { network: boolean }) {
  await run(async () => {
    console.log("validate");
    await test();
  });
}

/** Look up good to know information */
export async function lookup(options: {
  domain: string | undefined;
  port: string | undefined;
}) {
  await run(() => {
    // TODO: Does it go to this server?
    console.log("lookup", options);
  });
}

/**
 * Takes a callback function and executes it.
 * Makes sure that a connection to PM2 exists before running it
 * and closes the connection, along with any open broadcast
 * channels afterwards.
 * This ensures that PM2 is accessible during program execution
 * and that the program closes correctly after the method is executed,
 * as the CLI should not keep running
 */
async function run(method: () => Promise<void> | void) {
  // Connect to PM2
  await PrivateProcesses.connect();

  // Connect to the database
  await PrivateDatabase.connect();

  // Execute the callback function
  await method();

  // Disconnect from PM2
  await PrivateProcesses.disconnect();

  // Disconnect from the database
  await PrivateDatabase.disconnect();

  // Cleanup any open broadcast channels
  await PrivateMessages.disconnect();

  // Force quit
  process.exit(0);
}
