import { getState, onState } from "../messages";

// TODO: document
type State = {
  /** Indicates if the state is initialized */
  Initialized: boolean;
  /** Manager configuration */
  Manager: Configuration.Manager;
};

/** In-memory storage of the combined runtime state */
let _state: State | null = null;

/**
 * Returns a state object for determining the enabled
 * functionality and status of the server manager.
 * Will fail unless the state is first initialized.
 */
export const State = {
  get Initialized(): boolean {
    return !!_state;
  },
  get Manager(): State["Manager"] {
    if (!_state) {
      throw new Error(
        "Failed to access the current manager state as its not initialized"
      );
    }
    return _state.Manager;
  },
};

// TODO: Document
export async function initializeState() {
  const managerConf = await getState("manager_configuration");

  if (!managerConf) {
    throw new Error(
      "Failed to initialize the manager state as no manager configuration exists"
    );
  }

  _state = {
    Initialized: true,
    Manager: managerConf,
  };

  // FIXME:
  // onState("manager_configuration", (conf) => {
  //   State.LOG_LEVEL = conf.logging.level;
  // });
  // onState("application_configuration", (conf) => {});
}
