import * as Path from "node:path";

/**
 * Parses the given list of applications for various errors and returns a
 * manager state object with list categorised data
 */
export async function parseStateFromAppConfig(
  applications: Array<Configuration.Application>
): Promise<Manager.ApplicationsState> {
  // Create the resulting next manager state
  const nextState: Manager.ApplicationsState = {
    redirects: [],
    internalRoutes: [],
    uniqueLabels: [],
    uniqueHostnames: [],
    uniquePorts: [],
    processes: [],
    configuration: applications,
  };

  // Fill the state created above with information from the given application configuration
  for (const app of applications) {
    // Make sure that the label has not already been added
    const duplicate = nextState.uniqueLabels.find((v) => v == app.label);
    if (duplicate) {
      throw new Error(
        `The label ${app.label} is duplicated in the configuration`
      );
    } else {
      nextState.uniqueLabels.push(app.label);
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
      const duplicate = nextState.uniqueHostnames.find(
        (v) => v.hostname == foundHostname
      );
      if (duplicate) {
        throw new Error(
          `The hostname ${foundHostname} at ${app.label} is a duplicate, also exists at ${duplicate.label}`
        );
      } else {
        nextState.uniqueHostnames.push({
          hostname: foundHostname,
          label: app.label,
          renewalMethod: app.certificates || "default",
        });
      }
    }

    // Find redirections to make
    if (app.redirect) {
      for (const foundHostname of foundHostnames) {
        nextState.redirects.push({
          label: app.label,
          hostname: foundHostname,
          target: app.redirect,
        });
      }

      // Make sure that neither "port" or "serve" is also given
      if (app.serve || app.port) {
        throw new Error(
          app.label + " has a redirection, port/serve can't also be used"
        );
      }
    }

    // Find any folders with static web files to serve
    // TODO: Create a new static file serve that uses hostname
    // to serve the correct directory
    else if (app.serve) {
      // Determine the directory to serve, relative to the apps directory
      const directoryToServe =
        "./" +
        Path.relative(APPS_DIRECTORY, Path.resolve(APPS_DIRECTORY, app.serve));

      // allProcesses.push({
      //   label,
      //   process: {
      //     script: "serve",
      //     env: {
      //       PM2_SERVE_PATH: directoryToServe,
      //       PM2_SERVE_PORT: routing.port,
      //     },
      //   },
      // });

      // Make sure that "port" is not also given
      if (app.port) {
        throw new Error(
          app.label + " is a static file server, port can't also be used"
        );
      }
    }

    // Find internal routes to create
    else if (app.port) {
      // Make sure that the port have not been added already
      const duplicate = nextState.uniquePorts.find((v) => v.port == app.port);
      if (duplicate) {
        throw new Error(
          `The port ${app.port} at ${app.label} is a duplicate, also exists at ${duplicate.label}`
        );
      } else {
        nextState.uniquePorts.push({ port: app.port, label: app.label });
      }

      // Add internal routes
      for (const foundHostname of foundHostnames) {
        nextState.internalRoutes.push({
          label: app.label,
          hostname: foundHostname,
          port: app.port,
        });
      }
    }

    // Find processes to manage
    if (app.process) {
      // Read process configuration and add default values
      const { script, intepreter = "node", args = "", env = {} } = app.process;

      // Determine the working directory for the process, relative to the apps directory
      const cwd =
        "./" +
        Path.relative(
          APPS_DIRECTORY,
          Path.resolve(APPS_DIRECTORY, app.process.cwd || "")
        );

      // Add to process list
      nextState.processes.push({
        label: app.label,
        process: {
          script,
          intepreter,
          args,
          env,
          cwd,
        },
      });
    }
  }
  return nextState;
}
