import * as Path from "node:path";

/**
 * Uses the next manager state and environmental variables
 * to determine what internal processes that should be running
 */
export async function determineInternalProccessesToRun(
  nextState: Manager.ApplicationsState
): Promise<Manager.ApplicationsState["internalProcesses"]> {
  const internalProcessesToRun: Manager.ApplicationsState["internalProcesses"] =
    [];

  // TODO: use this method to add internal processes to run
  internalProcessesToRun.push({
    label: "DUMMY",
    process: {
      cwd: BIN_DIRECTORY,
      namespace: "server-manager",
      script: Path.resolve(BIN_DIRECTORY, "+dummy.js"),
    },
  });

  return internalProcessesToRun;
}
