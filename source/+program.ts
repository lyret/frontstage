import * as PrivateGlobalState from "./state/globalState";
import * as PrivateProcesses from "./processes/_pm2";
import * as PrivateMessages from "./messages/_messages";
import * as PrivateDatabase from "./database/_connection";
import { createLogger } from "./messages";
import {
  reloadApplicationsConfig,
  reloadManagerConfig,
  reloadNetworkConfig,
  getCurrentRuntimeInformation,
  State,
  getOperationsToPerform,
} from "./state";
import { Redirections, InternalRoutes } from "./traffic";
import { Certificates } from "./certificates";
import { ApplicationProcesses, InternalProcesses } from "./processes";

import { DNSRecords } from "./dns";
// NOTE: clean up imports after program functionality is done
// NOTE: some private imports are made here

// PROGRAM
// This file contains the available commands callable
// from the CLI program. It is only loaded and run per command
// executed by the user

/** Logger */
const logger = createLogger("Server Manager");


/** DNS TODO: document */
export async function dns(options: {}) {
  await run(options, async () => {
    const records = await DNSRecords.list()
    console.table(records);
  });
}


/** Prints the current status of the server and managed processes */
export async function status(options: { network: boolean }) {
  await run(options, async () => {
    const runtimeInfo = await getCurrentRuntimeInformation();
    console.log(runtimeInfo);
  });
}

/** Updates the runtime state of the manager with configuration updates */
export async function update(options: { reload?: boolean }) {
  options.reload = true;
  await run(options, async () => {
    const operations = await getOperationsToPerform();
    logger.debug("Performing operations", operations);

    logger.info("Performing changes to redirection configurations...");
    await Redirections.performOperations(operations.redirections);
    logger.info("Performing changes to internal routes...");
    await InternalRoutes.performOperations(operations.internalRoutes);
    logger.info("Performing changes to certificate configurations...");
    await Certificates.performOperations(operations.certificates);
    logger.info("Performing changes to internal processes...");
    await InternalProcesses.performOperations(operations.internalProcesses);
    logger.info("Performing changes to application processes...");
    await ApplicationProcesses.performOperations(
      operations.applicationProcesses
    );
    logger.trace("Scheduling certificate renewal if needed...");
    await Certificates.performCertificationRenewal();
    logger.success("Update completed");
  });
}

/** Checks if the current app config file is valid */
export async function validate(options: {}) {
  await run(options, async () => {
    // console.log("validate");
    // await test();
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

/** Look up good to know information */
export async function lookup(options: {
  domain: string | undefined;
  port: string | undefined;
}) {
  await run(options, () => {
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
async function run(
  options: { reload?: boolean } & any,
  method: () => Promise<void> | void
) {
  // Connect to the database
  await PrivateDatabase.connect();

  // Reload the configuration if reload option is given
  if (options.reload) {
    await reloadManagerConfig();
    await reloadApplicationsConfig();
    await reloadNetworkConfig();
  }

  // Determine the current state
  await PrivateGlobalState.initializeState();

  // Connect to PM2
  await PrivateProcesses.connect();

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
