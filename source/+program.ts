import * as Certificates from "./certificates";
import * as ProcessManager from "./processes/_pm2"; // NOTE: remove this import
import * as State from "./state";
import { createLogger } from "./statistics";

// PROGRAM
// This file contains the available commands callable
// from the CLI program. It is only loaded and run per command
// executed by the user

/** Logger */
const logger = createLogger("Server Manager");

/** Prints the current status of the server and managed processes */
export async function status(options: { network: boolean }) {
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
  return;
}

/** Reconfigures the manager with modifications to the app config file */
export async function reload() {
  // FIXME: CONTINUE HERe this is where im currently working
  const state = await State.updateManagerState();
  const runners = await ProcessManager.list();
  Certificates.bootstrap();
  const certs = Certificates.list();

  console.log("RUNNING PROCESSES");
  console.log(JSON.stringify(runners, null, 4));
  console.log("DELTAS");
  console.log(JSON.stringify(state.operations, null, 4));
  console.log("NETWORK");
  console.log(JSON.stringify(state.network, null, 4));
  console.log("CERTIFICATES");
  console.log(JSON.stringify(certs, null, 4));

  //ProcessManager.bootstrap();
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
  //   // If redirections are needed, start a proxy server
  //   if (!isTest && allRedirectes.length) {
  //     // Add routes to the redirection proxy
  //     for (const redirection of allRedirectes) {
  //       allRoutes.push({
  //         hostname: redirection.from,
  //         port: REDIRECTION_PROXY_PORT,
  //       });
  //     }
  //
  //     // Output
  //     console.log("\n> ------------------------");
  //     console.log("> STARTING REDIRECTION PROXY...");
  //     console.log("> ------------------------");
  //
  //     // Start proxy
  //     await startRedirectionProxy(allRedirectes);
  //   }
  //
  //   // Start the reverse router proxy server for all configured routes
  //   if (!isTest) {
  //     // Output
  //     console.log("\n> ------------------------");
  //     console.log("> STARTING REVERSE ROUTER");
  //     console.log("> ------------------------");
  //
  //     // Start router
  //     await startReverseRouterServer(allRoutes);
  //   }
  //
  //   // Perform changes to the process ecosystem
  //   if (!isTest) {
  //     console.log("\n> ------------------------");
  //     console.log("> PERFORMING PM2 CHANGES");
  //     console.log("> ------------------------");
  //
  //     // Generate ecosystem file
  //     await generateProcessEcosystem(allProcesses);
  //
  //     // Delete all processes removed from the configuration
  //     await removeAppProcessesFromPM2(allProcesses);
  //
  //     // Reload the managed PM2 processes
  //     await reloadPM2();
  //   }
  //
  //   // End output and handling
  //   isTest ? console.log("\n> Test completed\n\n") : console.log("\n> End\n\n");
  // } catch (err) {
  //   console.error("> Something went wrong...");
  //   console.error(err);
  // }
  // }
}

/** Checks if the current app config file is valid */
export async function validate(options: { network: boolean }) {
  console.log("validate");
}

/** Look up good to know information */
export async function lookup(options: {
  domain: string | undefined;
  port: string | undefined;
}) {
  // TODO: Does it go to this server?
  console.log("lookup", options);
}
