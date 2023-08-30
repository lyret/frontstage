/**
 * Configuration object categorised by operations
 * necessary to perform, created from parsing configured
 * applications
 */
type OperationsConfiguration = {
  /** List of all configured redirections to web addresses */
  redirectes: Array<{
    label: string;
    hostname: string;
    target: string;
  }>;
  /** List of all routes to a port on the runtime machine */
  internalRoutes: Array<{
    label: string;
    hostname: string;
    port: number;
  }>;
  /** List of all unique application labels */
  uniqueLabels: Array<string>;
  /** List of all unique hostnames found */
  uniqueHostnames: Array<{
    label: string;
    hostname: string;
  }>;
  /** List of all internal ports registered */
  uniquePorts: Array<{
    label: string;
    port: number;
  }>;
};

/** List of all processes that should be managed */
// TODO: let allProcesses: Array<{ label: string; process: Process }> = [];

/**
 * Parses the given list of applications for various errors and returns a
 * dictionary with list of operations that should be performed
 * // FIXME: cache the config and check for changes
 */
export async function parseAppConfig(
  applications: Array<App>
): Promise<OperationsConfiguration> {
  // Create the resulting operations configuration
  const operations: OperationsConfiguration = {
    redirectes: [],
    internalRoutes: [],
    uniqueLabels: [],
    uniqueHostnames: [],
    uniquePorts: [],
  };

  // Fill the operations lists created above with information from the given applications configuration
  for (const app of applications) {
    console.log("\n# ------------------------");
    console.log("#", app.label);
    console.log("# ------------------------");

    // Make sure that the label has not already been added
    const duplicate = operations.uniqueLabels.find((v) => v == app.label);
    if (duplicate) {
      throw new Error(
        `The label ${app.label} is duplicated in the configuration`
      );
    } else {
      operations.uniqueLabels.push(app.label);
    }

    // Find configured hostnames
    const foundHostnames = [];

    if (app.hostname) {
      foundHostnames.push(app.hostname);
    }
    if (app.hostnames) {
      foundHostnames.push(...app.hostnames);
    }

    // Make sure that the hostnames have not already been added
    for (const foundHostname of foundHostnames) {
      const duplicate = operations.uniqueHostnames.find(
        (v) => v.hostname == foundHostname
      );
      if (duplicate) {
        throw new Error(
          `The hostname ${foundHostname} at ${app.label} is a duplicate, also exists at ${duplicate.label}`
        );
      } else {
        operations.uniqueHostnames.push({
          hostname: foundHostname,
          label: app.label,
        });
      }
    }

    // Find redirections to make
    if (app.redirect) {
      for (const foundHostname of foundHostnames) {
        console.log("Redirecting", foundHostname, "to", app.redirect);
        operations.redirectes.push({
          label: app.label,
          hostname: foundHostname,
          target: app.redirect,
        });
      }
    }

    // Find internal routes to create
    else if (app.port) {
      // Make sure that the port have not been added already
      const duplicate = operations.uniquePorts.find((v) => v.port == app.port);
      if (duplicate) {
        throw new Error(
          `The port ${app.port} at ${app.label} is a duplicate, also exists at ${duplicate.label}`
        );
      } else {
        operations.uniquePorts.push({ port: app.port, label: app.label });
      }

      // Add internal routes
      for (const foundHostname of foundHostnames) {
        console.log("Added internal route from", foundHostname, "to", app.port);
        operations.internalRoutes.push({
          label: app.label,
          hostname: foundHostname,
          port: app.port,
        });
      }
    }

    // TODO: Directory
    //const { directory } = routing;
    // // Handle optional static file server
    // if (directory) {
    //   const relativeDir =
    //     "./" +
    //     Path.relative(PATH_TO_APPS, Path.resolve(PATH_TO_APPS, directory));
    //   allProcesses.push({
    //     label,
    //     process: {
    //       script: "serve",
    //       env: {
    //         PM2_SERVE_PATH: relativeDir,
    //         PM2_SERVE_PORT: routing.port,
    //       },
    //     },
    //   });
    // Output
    //console.log(prefix, "to file server in directory", relativeDir);
    //}
  }

  //     // R
  //
  //     // Process management
  //     if (process) {
  //       // Read process configuration
  //       const { script, intepreter = "node", args, env = {} } = process;
  //
  //       // Determine the working directory for the process, relative to the apps directory
  //       const cwd =
  //         "./" +
  //         Path.relative(
  //           PATH_TO_APPS,
  //           Path.resolve(PATH_TO_APPS, process.cwd || "")
  //         );
  //
  //       // Output
  //       console.log(
  //         "\n" + prefix,
  //         "running",
  //         `"${script} ${args ? " " + args : ""}"`
  //       );
  //       console.log(prefix, "using", intepreter);
  //       console.log(prefix, "from directory", cwd);
  //       if (Object.keys(env).length) {
  //         for (const [envVar, value] of Object.entries(env)) {
  //           console.log(prefix, "with", envVar, "set to", value);
  //         }
  //       }
  //
  //       // Add to process list
  //       allProcesses.push({ label, process: { ...process, cwd } });
  //     }
  //   }
  //
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

  return operations;
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
// TODO: remove output
