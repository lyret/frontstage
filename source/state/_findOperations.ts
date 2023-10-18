import * as JsonDiffPatch from "jsondiffpatch";
import * as ArrayDifferences from "fast-array-diff";

// TODO: document

function findChangeInApplicationState<
  Key extends keyof Manager.ApplicationsState
>(
  key: Key,
  prevState: Manager.ApplicationsState,
  nextState: Manager.ApplicationsState
): {
  added: Manager.ApplicationsState[Key];
  removed: Manager.ApplicationsState[Key];
  moved: Manager.ApplicationsState[Key];
} {
  // Find modifications on the given key of the application state
  let { added, removed } = ArrayDifferences.diff(
    prevState[key as keyof Manager.ApplicationsState],
    nextState[key as keyof Manager.ApplicationsState],
    (a, b) => !JsonDiffPatch.diff(a, b)
  );

  // Find out what entries were not modified, but moved
  let moved = ArrayDifferences.same(
    added,
    removed,
    (a, b) => !JsonDiffPatch.diff(a, b)
  );

  // Remove moved entries from the list of removed and added entries
  // Needs to be stringified for the comparison to work
  let stringifiedMoved = moved.map((v) => JSON.stringify(v));

  added = added
    .map((v) => JSON.stringify(v))
    .filter((v) => !stringifiedMoved.includes(v))
    .map((v) => JSON.parse(v));
  removed = removed
    .map((v) => JSON.stringify(v))
    .filter((v) => !stringifiedMoved.includes(v))
    .map((v) => JSON.parse(v));

  // Return the deltas
  return { added, removed, moved };
}

export function findOperationsFromChangeOfState(
  prevState: Manager.ApplicationsState,
  nextState: Manager.ApplicationsState
): Manager.Operations {
  return {
    redirections: findChangeInApplicationState(
      "redirects",
      prevState,
      nextState
    ),
    internalRoutes: findChangeInApplicationState(
      "internalRoutes",
      prevState,
      nextState
    ),
    internalProcesses: findChangeInApplicationState(
      "internalProcesses",
      prevState,
      nextState
    ),
    applicationProcesses: findChangeInApplicationState(
      "applicationProcesses",
      prevState,
      nextState
    ),
    hostnames: findChangeInApplicationState(
      "uniqueHostnames",
      prevState,
      nextState
    ),
  };
}
