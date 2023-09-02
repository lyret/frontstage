export {};

/**
 * Contains global type definitions for various data structures
 * used throughout the server manager
 */
declare global {
  /**
   * Type definitions for the internal state
   * of the server manager
   */
  namespace Manager {
    /**
     * Overall current state of the manager
     */
    type State = {
      operations: Operations;
      network: NetworkState;
    } & ApplicationsState;

    /**
     * Operations necessary to perform after reconfiguring
     * the internal manager state
     */
    type Operations = {
      hostnames: {
        added: Array<string>;
        removed: Array<string>;
        moved: Array<string>;
      };
      processes: {
        added: Manager.ApplicationsState["processes"];
        removed: Manager.ApplicationsState["processes"];
        moved: Manager.ApplicationsState["processes"];
      };
      internalRoutes: {
        added: Manager.ApplicationsState["internalRoutes"];
        removed: Manager.ApplicationsState["internalRoutes"];
        moved: Manager.ApplicationsState["internalRoutes"];
      };
    };

    /**
     * State object categorised by data collected
     * from reading the application configuration
     */
    type ApplicationsState = {
      /** List of all configured redirections to web addresses */
      redirects: Array<{
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
      /** List of all processes that should be managed by PM2 */
      processes: Array<{ label: string; process: Required<Process> }>;
      /** List of all applications as configured in the YAML file */
      configuration: Array<App>;
    };

    /**
     * State object with current network information
     * for the runtime machine of the manager
     */
    type NetworkState = {
      /** The public internet ip-address of this machine */
      publicIp: string;
      /** List of loopback and LAN ip-addresses for this machine */
      internalIps: Array<string>;
      /** List of all ip-addresses that points to this router */
      allIps: Array<string>;
    };

    /**
     * State object for currently running processes managed by
     * PM2
     */
    type ProcessesState = {
      /** List of all ip-addresses that points to this router */
      processes: List<Process.Status>;
    };
  }

  /**
   * Type definitions for configuration of the server manager
   */
  namespace Configuration {
    /**
     * Application configuration
     */
    type Application = {
      /** Unique identifying name for this application */
      label: string;
      /** A single hostname to use for routing traffic to this application */
      hostname?: Hostname;
      /** A list of several hostnames to use for routing traffic to this application */
      hostnames?: Array<Hostname>;
      /** (Optional) URL to route incoming web traffic to */
      redirect: string;
      /** (Optional) Directory to serve static files from */
      serve: string;
      /** (Optional) Port to use for internal routing on the same server */
      port: number;
      /**
       * (Optional) Description for running a program/shell script
       * as a background processes on the runtime machine
       */
      // TODO: Document
      process: {
        // TODO: This type does not support namespace for PM2!
        script: string;
        cwd?: string;
        // TODO: Process options does not support interpreter?
        intepreter?: string;
        // TODO: Process options does not support args?
        args?: string;
        // TODO: Process options does not support env?
        env?: {
          [key: string]: string | number;
        };
      };
    };
  }

  /**
   * Type definitions for running processes
   */
  namespace Process {
    /**
     * Sanitised process description of a process
     * registred in PM2
     */
    type Status = {
      /** Unique process name in PM2 */
      label: string;
      /** Unique process index for reference in PM2 */
      index: number;
      /** Unique process id on the runtime machine */
      pid: number;
      /** The namespace the process is running under in PM2 */
      namespace: string;
      /** Additional details of the process in PM2 */
      details?: {
        /** The path to the script being executed */
        script: string;
        /** The working directory the script is executed from */
        cwd: string;
        /** The number of restarts as reported by PM2 */
        restarts: number;
        /** The number of unstable restarts as reported by PM2 */
        unstable_restarts: number;
        /** The uptime for the process in PM2 */
        uptime: number;
        /** The timestamp for when the process was added to PM2 */
        createdAt: number;
        /** The status of the process in PM2 */
        status: string;
        /** The amount of memory being used, as reported by PM2 */
        memory: number;
        /** The percentage of the CPU dedicated to this process, as reported by PM2 */
        cpu: number;
      };
    };

    /**
     * Options for adding a new process to PM2
     */
    type Options = {
      /** To what namespace this process should be added */
      namespace: string;
      /** The path to the script to execute */
      script: string;
      /** The path to the working directory to execute from */
      cwd: string;
    };
  }

  /**
   * Type definitions for certificates
   */
  namespace Certificates {
    /**
     * Certificate description for available and loaded certificates
     */
    type Certificate = {
      /** Hostname this certificate is valid for */
      hostname: string;
      /** Method used to add and renew this certificate */
      renewalMethod: "lets-encrypt" | "self-signed" | "default";
      /** The time in milliseconds, before expiration that the certificate should be renewed */
      renewWithin: number;
      /** The date time for the expiration of this certificates validity */
      expiresOn: Date;
      /** The common name of the certificate */
      commonName: string;
      /** The context object used for https transport */
      secureContext: TLS.SecureContext;
    };

    /** A certificate as stored in the file system cache as JSON */
    type CachedCertificate = {
      /** Hostname this certificate is valid for */
      hostname: string;
      /** Method used to renew this certificate */
      renewalMethod: "lets-encrypt" | "self-signed" | "default";
      /** The time in milliseconds, before expiration that the certificate should be renewed */
      renewWithin: number;
      /** The PEM certificate(s) */
      certificate: string | string[];
      /** The PEM private key(s) */
      privateKey: string | string[];
    };
  }
}
