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
     * Overarching current state of the manager
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
        added: ApplicationsState["uniqueHostnames"];
        removed: ApplicationsState["uniqueHostnames"];
        moved: ApplicationsState["uniqueHostnames"];
      };
      internalProcesses: {
        added: ApplicationsState["internalProcesses"];
        removed: ApplicationsState["internalProcesses"];
        moved: ApplicationsState["internalProcesses"];
      };
      applicationProcesses: {
        added: ApplicationsState["applicationProcesses"];
        removed: ApplicationsState["applicationProcesses"];
        moved: ApplicationsState["applicationProcesses"];
      };
      internalRoutes: {
        added: ApplicationsState["internalRoutes"];
        removed: ApplicationsState["internalRoutes"];
        moved: ApplicationsState["internalRoutes"];
      };
      redirections: {
        added: ApplicationsState["redirects"];
        removed: ApplicationsState["redirects"];
        moved: ApplicationsState["redirects"];
      };
    };

    /**
     * State object categorised by data collected
     * from reading the application configuration
     */
    type ApplicationsState = {
      /** List of all configured redirections to web addresses to forward from the public server */
      redirects: Array<Routes.Redirection>;
      /** List of all configured internal routes to forward from the public server */
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
        renewalMethod: Certificates.Certificate["renewalMethod"];
        hostname: string;
      }>;
      /** List of all internal ports registered */
      uniquePorts: Array<{
        label: string;
        port: number;
      }>;
      /** List of all internal server manaker processes that should be managed by PM2 */
      internalProcesses: Array<{
        label: string;
        process: Required<Process.Options>;
      }>;
      /** List of all application processes that should be managed by PM2 */
      applicationProcesses: Array<{
        label: string;
        process: Required<Process.Options>;
      }>;
      /** The build number for the server manager source code */
      buildNumber: number;
      /** List of all applications as configured in the YAML file */
      configuration: Array<Configuration.Application>;
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
      /** The renewal method for certificates for hostname(s) of the application */
      certificates: Certificates.Certificate["renewalMethod"];
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
        env?: Record<string, string | number>;
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
        /** The running status of the process in PM2 */
        running: boolean;
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
      hostname: Certificate["hostname"];
      /** Method used to renew this certificate */
      renewalMethod: Certificate["renewalMethod"];
      /** The time in milliseconds, before expiration that the certificate should be renewed */
      renewWithin: Certificate["renewWithin"];
      /** The PEM certificate(s) */
      certificate: string | string[];
      /** The PEM private key(s) */
      privateKey: string | string[];
    };
  }

  /**
   * Type definitions for routing http traffic
   */
  namespace Routes {
    /**
     * Individual options when forwarding to an internal route
     */
    type Options = {
      /** If true the proxy will substitute the target host name for the inbound host name of the request, i.e it is not changed */
      useTargetHostHeader?: boolean;
      /** If true, The proxy will use https and check the credentials on the target when forwarding */
      secureOutbound?: boolean;
    };

    /**
     * Definition for an internal route behind the public server
     * i.e. the information needed for forwarding a request
     */
    type InternalRoute = {
      /**
       * Indicates that this target should be secured by HTTPS when forwarding
       * effects the routing between the public server and the internal target,
       * and not the public server directly
       */
      secure: boolean;
      /** The hostname of the target, excluding protocol and port */
      hostname: string;
      /** The port of the target */
      port: number;
      /** Options used when forwarding to this target */
      options: Options;
    };

    /**
     * Definition of a redirection from a hostname to an external URL
     */
    type Redirection = {
      /** Label of the application configuration this redirection originated from */
      label: string;
      /** Hostname to redirect from */
      hostname: string;
      /** Target URL to redirect to */
      target: string;
    };
  }
}
