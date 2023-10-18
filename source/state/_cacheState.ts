import * as JsonDiffPatch from "jsondiffpatch";
import * as FS from "node:fs";
import * as Path from "node:path";

/**
 * Caches the current manager state and return the previous state
 * so that necessary operations can be made from the differences found
 */
export function cacheManagerState(
  nextState: Manager.ApplicationsState
): Manager.ApplicationsState {
  const pathToCachedState = Path.resolve(CACHE_DIRECTORY, "state.json");

  // Retrieve the previous state
  let prevState: Manager.ApplicationsState = {
    buildNumber: 0,
    configuration: [],
    internalRoutes: [],
    internalProcesses: [],
    applicationProcesses: [],
    redirects: [],
    uniqueHostnames: [],
    uniqueLabels: [],
    uniquePorts: [],
  };

  if (FS.existsSync(pathToCachedState)) {
    const contents = FS.readFileSync(pathToCachedState, "utf8");
    const cachedState = JSON.parse(contents, JsonDiffPatch.dateReviver);
    prevState = {
      ...prevState,
      ...cachedState,
    };
  }

  // Update the cached state on file
  FS.writeFileSync(pathToCachedState, JSON.stringify(nextState), "utf8");

  // Return the previous state
  return prevState;
}
