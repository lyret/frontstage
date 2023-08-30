import * as Path from "node:path";
import * as Pm2 from "./processes/pm2";
import * as Network from "./network/network";
import * as Apps from "./config/readAppConfig";

/**
 * The main function executed from the cli interface
 */
export async function main() {
  console.log(await Apps.readAppConfig());

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

  // const domain = "www.väveriet.se";
  // const r2 = await nslookup(domain);
  // const r = await myPublicIp();
  // const r3 = await myLocalIps();
  //console.log(r, r2, r3);

  // await Pm2.connect();
  // await Pm2.bootstrap();
  // const list = await Pm2.list();
  // console.log(list);
  // //console.log(bootstrap);
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
