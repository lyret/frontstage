import { getConfiguration } from "../messages";

/**
 * A combined state object thats globally reachable.
 * Used for determining how the server
 * manager should function across the different source code modules
 * contains combined information from the available state objects in the database
 */
type GlobalState = {
  /** Indicates if the state is initialized */
  Initialized: boolean;
  /** The Manager configuration */
  Manager: Configuration.Manager;
  /** Unique identifier for this build of the source code */
  BuildNumber: number;
};

/** In-memory cache of the runtime state */
let _state: GlobalState | null = null;

/**
 * Returns a state object for determining the enabled
 * functionality and status of the server manager.
 * Will fail unless the global state is first initialized.
 */
export const State = {
  get Initialized(): boolean {
    return !!_state;
  },
  get Manager(): GlobalState["Manager"] {
    if (!_state) {
      throw new Error(
        "Failed to access the current manager state as its not initialized"
      );
    }
    return _state.Manager;
  },
};

/**
 * Initializes the global state using the current configuration
 * in the database
 */
export async function initializeState() {
  const managerConf = await getConfiguration("manager_configuration");
  const applicationsConf = await getConfiguration("application_configuration");
  const networkConf = await getConfiguration("network_configuration");

  if (!managerConf) {
    throw new Error(
      "Failed to initialize the manager state as no manager configuration exists"
    );
  }

  if (!applicationsConf) {
    throw new Error(
      "Failed to initialize the manager state as no applications configuration exists"
    );
  }

  if (!networkConf) {
    throw new Error(
      "Failed to initialize the manager state as no network configuration exists"
    );
  }

  _state = {
    Initialized: true,
    BuildNumber: BUILD_NUMBER,
    Manager: managerConf,
  };

  // FIXME:
  // onState("manager_configuration", (conf) => {
  //   State.LOG_LEVEL = conf.logging.level;
  // });
  // onState("application_configuration", (conf) => {});
}

// FIXME:
// export async function reloadConfiguration() {
//   const prevManagerConf = await getState("manager_configuration");
//   const prevApplicationsConf = await getState("application_configuration");
//   const nextManagerConf = await reloadManagerConfig();
//
//   if (!prevManagerConf) {
//   }
//
//   if (!prevApplicationsConf) {
//   }
//
//   //   const ri = await parseConfigurationOptions(
//   //     prevManagerConf,
//   //     prevApplicationsConf
//   //   );
//   //
//   //   console.log("RI", ri);
//   //
//   //   _state = {
//   //     Initialized: true,
//   //     BuildNumber: 0,
//   //     Manager: prevManagerConf,
//   //   };
//
//   // FIXME:
//   // onState("manager_configuration", (conf) => {
//   //   State.LOG_LEVEL = conf.logging.level;
//   // });
//   // onState("application_configuration", (conf) => {});
// }
