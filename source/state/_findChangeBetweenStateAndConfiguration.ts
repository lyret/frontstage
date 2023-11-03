import * as JsonDiffPatch from "jsondiffpatch";
import * as ArrayDifferences from "fast-array-diff";
import type { CurrentRuntimeInfo } from "./getCurrentRuntimeInformation";
import type { ConfigureredOptions } from "./_parseConfigurationOptions";

/**
 * Utility function that find changes between the current runtime
 * state and the currently configured options
 */
export function findChangeBetweenStateAndConfiguration<
  Key extends keyof Pick<
    CurrentRuntimeInfo,
    "redirects" | "internalRoutes" | "certificates"
  >
>(
  key: Key,
  current: CurrentRuntimeInfo,
  next: ConfigureredOptions
): {
  added: ConfigureredOptions[Key];
  removed: ConfigureredOptions[Key];
  moved: ConfigureredOptions[Key];
} {
  // Find modifications on the given key of the application state
  let { added, removed } = ArrayDifferences.diff<any>(
    current[key],
    next[key],
    (a, b) => !JsonDiffPatch.diff(pure(a), pure(b))
  );

  // Find out what entries were not modified, but moved
  let moved = ArrayDifferences.same(
    added,
    removed,
    (a, b) => !JsonDiffPatch.diff(pure(a), pure(b))
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

/** Returns the database id and and timestamps from the given object */
function pure(obj: any) {
  if (typeof obj !== "object") {
    return obj;
  }
  const strippedKeys = ["id", "createdAt", "deletedAt"];
  return Object.keys(obj)
    .filter((key) => !strippedKeys.includes(key))
    .reduce((strippedObj, key) => {
      strippedObj[key] = strippedObj[key];
      return strippedObj;
    }, <any>{});
}
