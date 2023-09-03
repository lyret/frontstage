import * as Certificates from "./certificates";
import * as ProcessManager from "./processes/pm2";
import * as State from "./state";

// This file contains the available commands callable
// from the CLI program
// each exported method is imported by program.mjs and
// executed dynamically on runtime

/** Prints the current status of the server and managed processes */
export async function status(options: { network: boolean }) {
  const state = await State.updateManagerState();
  const runners = await ProcessManager.list();
  ProcessManager.disconnect();
  await Certificates.bootstrap();
  const certs = Certificates.list();

  console.log("RUNNING PROCESSES");
  console.log(JSON.stringify(runners, null, 4));
  console.log("DELTAS");
  console.log(JSON.stringify(state.operations, null, 4));
  console.log("NETWORK");
  console.log(JSON.stringify(state.network, null, 4));
  console.log("CERTIFICATATES");
  console.log(JSON.stringify(certs, null, 4));
}

/** Reconfigures the manager with modifications to the app config file */
export async function reload() {
  // TODO: testcode
  console.log("reload");
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

/**
 * The main function executed from the cli interface
 */
export async function main() {
  return;

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

// FIXME: old INDEX.TS

// import {
//   generateProcessEcosystem,
//   reloadPM2,
//   removeAppProcessesFromPM2,
// } from "./processes/ecosystem";
// import { startRedirectionProxy } from "./routing/redirection-proxy";
// import { startReverseRouterServer } from "./routing/reverse-proxy";
//

// TODO: Move to program?
// // Create a PM2 process for the server manager and then exit
// export async function bootstrap() {
//   await PM2.bootstrap();
//   console.log("done!");
// }
// // Determine the runtime mode on execution
// //const isTest: boolean = process.argv[2] === "test";
//
// // Determine if the application should deamonize and exit
// //const isDeamon: boolean = process.argv[2] === "deamon";

// TODO: Move to daemon?
// export async function main() {
//   process.on("message", (...a) => {
//     console.log("HERE HERE HERE", ...a);
//     console.log(process.env);
//     console.log(process.env.LOG_LEVEL);
//     console.log(typeof REVERSE_ROUTER_HOST, REVERSE_ROUTER_HOST);
//     console.log(typeof LOG_LEVEL, LOG_LEVEL);
//
//     process.send!({
//       type: "process:msg",
//       data: {
//         success: true,
//       },
//     });
//   });
//
//   console.log("waiting for signal...");
//   // setInterval(() => {
//   //   console.log("i");
//   // }, 1000);
//
//   //   // Only output the intepretetion of the current apps.yaml and then exit
//   //   else if (isTest) {
//   //     update();
//   //   }
//   //   // Default: Watch the apps.yaml for changes and manage processes and routing
//   //   else {
//   //     update().then(() => watchAppConfig(update));
//   //   }
// }
//
