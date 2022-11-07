import * as Path from 'node:path';
import { readAppConfig, watchAppConfig } from './config/apps';
import { generateProcessEcosystem, reloadPM2, removeAppProcessesFromPM2, deamonizeServerManager } from './processes/ecosystem';
import { startRedirectionProxy } from './routing/redirection-proxy';
import { startReverseRouterServer } from './routing/reverse-proxy';
import { REDIRECTION_PROXY_PORT, PATH_TO_APPS } from './config/settings';

// NEW TEST CODE FOR RXJS

// Determine the runtime mode on execution
const isTest: boolean = process.argv[2] === "test";

// Determine if the application should deamonize and exit
const isDeamon: boolean = process.argv[2] === "deamon";

// Create a PM2 process for the server manager and then exit
if (isDeamon) {
   deamonizeServerManager();
} else
// Only output the intepretetion of the current apps.yaml and then exit
if (isTest) {
   update();
}
// Default: Watch the apps.yaml for changes and manage processes and routing
else {
   update().then(() => watchAppConfig(update));
}

/** Main manager update function - parses the apps.yaml configuration file and perform changes */
async function update() {
   try {
      // Output
      console.log("\n> ------------------------");
      console.log("> READING APP.YAML CONFIGURATION...");
      console.log("> from", PATH_TO_APPS);
      isTest && console.log("> this is a test run...");
      console.log("> ------------------------");

      // Get the app configuration
      const config: AppsConfig = readAppConfig();

      // All redirections to handle
      let allRedirectes: Array < { from: Hostname, to: Hostname } > = [];

      // All proxy routes for the server to handle
      let allRoutes: Array < { hostname: Hostname, port: number } > = [];

      // All processes that should be managed
      let allProcesses: Array < { label: string, process: Process } > = [];

      // Handle configured redirections
      if (config.redirects) {
         for (const redirection of config.redirects) {
            const { name, from, to } = redirection;
            
            // Output
            console.log("\n# ------------------------")
            console.log("#", name);
            console.log("# ------------------------")
            console.log("  ", "redirecting", from, "to", to);
            
            // Add redirection
            allRedirectes.push({ from, to });
         }
      }

      // Handle configured apps
      for (const app of config.apps) {

         // Read app configuration
         const { name, label, process, routing } = app;

         // Output
         console.log("\n# ------------------------")
         console.log("#", name)
         console.log("#", label)
         console.log("# ------------------------")
         const prefix = "  ";

         // Routing
         if (routing) {

            // Read routing configuration
            const { port, redirects, directory } = routing;
            const hostnames = routing.hostname ? [routing.hostname] : routing.hostnames!;

            // Determine main hostname for the app
            const mainHostname = hostnames[0];

            // Output
            console.log("\n" + prefix, "routing to port", port);

            // Handle optional static file server
            if (directory) {
               const relativeDir = "./" + Path.relative(PATH_TO_APPS, Path.resolve(PATH_TO_APPS, directory));
               allProcesses.push({
                  label,
                  process: {
                     script: "serve",
                     env: {
                        PM2_SERVE_PATH: relativeDir,
                        PM2_SERVE_PORT: routing.port
                     }
                  }
               });

               // Output
               console.log(prefix, "to file server in directory", relativeDir);
            }

            // Handle routes
            for (const hostname of hostnames) {
               allRoutes.push({ hostname, port });

               // Output
               console.log(prefix, "from", hostname);
            }

            // Handle redirections
            if (redirects) {
               for (const redirection of redirects) {
                  allRedirectes.push({ from: redirection, to: mainHostname });

                  // Output
                  console.log(prefix, "redirecting", redirection, "to", mainHostname);
               }
            }
         }

         // Process management
         if (process) {

            // Read process configuration
            const { script, intepreter = "node", args, env = {} } = process;

            // Determine the working directory for the process, relative to the apps directory
            const cwd = "./" + Path.relative(PATH_TO_APPS, Path.resolve(PATH_TO_APPS, process.cwd || ""));

            // Output
            console.log("\n" + prefix, "running", `"${script} ${args ? " "+args : ""}"`);
            console.log(prefix, "using", intepreter);
            console.log(prefix, "from directory", cwd);
            if (Object.keys(env).length) {
               for (const [envVar, value] of Object.entries(env)) {
                  console.log(prefix, "with", envVar, "set to", value);
               }
            }

            // Add to process list
            allProcesses.push({ label, process: { ...process, cwd } })
         }
      }

      // If redirections are needed, start a proxy server
      if (!isTest && allRedirectes.length) {

         // Add routes to the redirection proxy
         for (const redirection of allRedirectes) {
            allRoutes.push({ hostname: redirection.from, port: REDIRECTION_PROXY_PORT });
         }

         // Output
         console.log("\n> ------------------------");
         console.log("> STARTING REDIRECTION PROXY...");
         console.log("> ------------------------");
          
         // Start proxy
         await startRedirectionProxy(allRedirectes);
      }

      // Start the reverse router proxy server for all configured routes
      if (!isTest) {

         // Output
         console.log("\n> ------------------------");
         console.log("> STARTING REVERSE ROUTER");
         console.log("> ------------------------");

         // Start router
         await startReverseRouterServer(allRoutes)
      }



      // Perform changes to the process ecosystem
      if (!isTest) {

         console.log("\n> ------------------------");
         console.log("> PERFORMING PM2 CHANGES");
         console.log("> ------------------------");

         // Generate ecosystem file
         await generateProcessEcosystem(allProcesses);

         // Delete all processes removed from the configuration
         await removeAppProcessesFromPM2(allProcesses);

         // Reload the managed PM2 processes
         await reloadPM2();
      }

      // End output and handling
      isTest ? console.log("\n> Test completed\n\n") : console.log("\n> End\n\n");

   } catch (err) {
      console.error("> Something went wrong...");
      console.error(err);
   }
}