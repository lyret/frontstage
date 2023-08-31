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
     * Operations necessary to perform after reconfiguring
     * the application configuration
     */
    type Operations = {
      hostnames: {
        added: Array<string>;
        removed: Array<string>;
        moved: Array<string>;
      };
      processes: {
        added: Manager.State["processes"];
        removed: Manager.State["processes"];
        moved: Manager.State["processes"];
      };
      internalRoutes: {
        added: Manager.State["internalRoutes"];
        removed: Manager.State["internalRoutes"];
        moved: Manager.State["internalRoutes"];
      };
    };

    /**
     * State object categorised by data collected
     * from reading the application configuration
     */
    type State = {
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
      applications: Array<App>;
    };
  }

  // TODO: Old
  interface Process {
    script: string;
    cwd?: string;
    intepreter?: string;
    args?: string;
    env?: {
      [key: string]: string | number;
    };
  }

  // TODO: Old
  interface App {
    label: string;
    port: number;
    hostname?: Hostname;
    hostnames?: Array<Hostname>;
    serve: string;
    redirect: string;
    process: Process;
  }

  // ASSETS
  // TODO: Old

  type Asset<T extends object = {}> = T & {
    close: () => void;
  };

  type AssetOf<T extends AssetGenerator<any, any>> = ReturnType<T>;

  type AssetGenerator<
    Options extends object = {},
    AssetDefinition extends object = {}
  > = (options: Options) => Asset<AssetDefinition>;

  type AssetGeneratorWithoutOptions<AssetDefinition extends object = {}> =
    () => Asset<AssetDefinition>;
}
