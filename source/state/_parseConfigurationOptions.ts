import * as Path from "node:path";

/**
 * Information from the current configuration object categorised by what
 * internal data models will result from the current config,
 * what functionality is enabled in the manager and other useful information
 * that needs to be looked up and verified.
 */
export type ConfigureredOptions = {
  /** List of all configured web addresses to redirect between */
  redirects: Array<Routes.Redirection>;
  /** List of all configured internal routes to forward to */
  internalRoutes: Array<Routes.InternalRoute>;
  /** List of all certificates that should exist */
  certificates: Array<{
    label: string;
    renewalMethod: Certificates.LoadedCertificate["renewalMethod"];
    hostname: string;
  }>;
  /** List of all application daemons that should be running */
  applicationProcesses: Array<{
    label: string;
    process: Required<Process.Options>;
  }>;
  /** List of all internal ports registered */
  uniquePorts: Array<number>;
  /** List of all unique application labels */
  uniqueLabels: Array<string>;
};

/**
 * Parses the given configuration for various errors and returns a
 * runtime information object
 */
export async function parseConfigurationOptions(
  manager: State.StoredConfigurations["manager_configuration"],
  applications: State.StoredConfigurations["application_configuration"]
): Promise<ConfigureredOptions> {
  // Create the resulting information object
  const results: ConfigureredOptions = {
    redirects: [],
    internalRoutes: [],
    certificates: [],
    applicationProcesses: [],
    uniqueLabels: [],
    uniquePorts: [],
  };
  const uniquePortsWithLabels: Array<[label: string, port: number]> = [];

  // Fill the state created above with information from the given application configuration
  for (const app of applications) {
    // Make sure that the label has not already been added
    const duplicate = results.uniqueLabels.find((v) => v == app.label);
    if (duplicate) {
      throw new Error(
        `The label ${app.label} is duplicated in the configuration`
      );
    } else {
      results.uniqueLabels.push(app.label);
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
      const duplicate = results.certificates.find(
        (v) => v.hostname == foundHostname
      );
      if (duplicate) {
        throw new Error(
          `The hostname ${foundHostname} at ${app.label} is a duplicate, also exists at ${duplicate.label}`
        );
      } else {
        results.certificates.push({
          hostname: foundHostname,
          label: app.label,
          renewalMethod: app.certificates || "default",
        });
      }
    }

    // Find redirections to make
    if (app.redirect) {
      for (const foundHostname of foundHostnames) {
        results.redirects.push({
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
      // const directoryToServe =
      //   "./" +
      //   Path.relative(APPS_DIRECTORY, Path.resolve(APPS_DIRECTORY, app.serve));
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
      const duplicate = uniquePortsWithLabels.find(
        ([_, port]) => port == app.port
      );
      if (duplicate) {
        throw new Error(
          `The port ${app.port} at ${app.label} is a duplicate, also exists at ${duplicate[0]}`
        );
      } else {
        uniquePortsWithLabels.push([app.label, app.port]);
        results.uniquePorts.push(app.port);
      }

      // Add internal routes
      for (const foundHostname of foundHostnames) {
        results.internalRoutes.push({
          label: app.label,
          hostname: foundHostname,
          port: app.port,
        });
      }
    }

    // Find application processes to manage
    if (app.process) {
      // Read process configuration and add default values
      const { script, intepreter = "node", args = "", env = {} } = app.process;

      // Determine the working directory for the process, relative to the apps directory
      const cwd =
        "./" +
        Path.relative(
          manager.daemons.root_directory,
          Path.resolve(manager.daemons.root_directory, app.process.cwd || "")
        );

      // Add to process list
      results.applicationProcesses.push({
        label: app.label,
        process: {
          namespace: APP_DAEMON_NAMESPACE,
          script,
          intepreter,
          args,
          env,
          cwd,
        },
      });
    }
  }
  return results;
}
