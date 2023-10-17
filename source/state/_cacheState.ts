import * as JsonDiffPatch from "jsondiffpatch";
import * as FS from "node:fs";
import * as Path from "node:path";

/**
 * Caches the current manager state and return the previous state
 * so that necessary operations can be made from the difference found
 */
export function cacheManagerState(
  nextState: Manager.ApplicationsState
): Manager.ApplicationsState {
  const pathToCachedState = Path.resolve(BIN_STATE_FILE);

  // Retrieve the previous state
  let prevState: Manager.ApplicationsState = {
    configuration: [],
    internalRoutes: [],
    processes: [],
    redirects: [],
    uniqueHostnames: [],
    uniqueLabels: [],
    uniquePorts: [],
  };

  if (FS.existsSync(pathToCachedState)) {
    const contents = FS.readFileSync(pathToCachedState, "utf8");
    prevState = JSON.parse(contents, JsonDiffPatch.dateReviver);
  }

  // Update the cached state on file
  FS.writeFileSync(pathToCachedState, JSON.stringify(nextState), "utf8");

  // Return the previous state
  return prevState;
}