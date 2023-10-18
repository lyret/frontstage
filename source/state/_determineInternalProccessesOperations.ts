import * as Path from "node:path";
import * as ProcessManager from "../processes/pm2";

/**
 * Uses the next and previous manager state and environmental variables
 * to determine what operations should be made to internal processes
 */
export async function determineInternalProccessesOperations(
  prevState: Manager.ApplicationsState,
  nextState: Manager.ApplicationsState
): Promise<Manager.Operations["internalProcesses"]> {
  const start: Manager.ApplicationsState["internalProcesses"] = [];
  const restart: Manager.ApplicationsState["internalProcesses"] = [];
  const remove: Manager.ApplicationsState["internalProcesses"] = [];

  const runningInternalProcesses = (await ProcessManager.list()).filter(
    (proc) => proc.namespace == "manager"
  );

  // Internal processes should be restarted when new builds are available
  const restartNeeded = prevState.buildNumber != nextState.buildNumber;

  // The Dummy process should be running
  const shouldBeRunning = true;
  const existingProcess = runningInternalProcesses.find(
    (proc) => proc.label == dummyProcess.label
  );

  if (shouldBeRunning) {
    if (!existingProcess || !existingProcess.details?.running) {
      start.push(dummyProcess);
    } else if (restartNeeded) {
      restart.push(dummyProcess);
    }
  } else if (existingProcess) {
    remove.push(dummyProcess);
  }

  // TODO: remove this line, move that function
  await handleInternalProcessesOperations({ start, restart, remove });
  return { start, restart, remove };
}

/** Dummy process options */
const dummyProcess: Manager.ApplicationsState["internalProcesses"][0] = {
  label: "DUMMY",
  process: {
    cwd: BIN_DIRECTORY,
    namespace: "manager",
    script: Path.resolve(BIN_DIRECTORY, "+dummy.js"),
  },
};

/**
 * TODO: document
 */
export async function handleInternalProcessesOperations(
  operations: Manager.Operations["internalProcesses"]
) {
  // Stop and remove processes that should not be running anymore
  for (const process of operations.remove) {
    await ProcessManager.remove(process.label);
  }

  // Restart processes that are needed
  for (const process of operations.restart) {
    await ProcessManager.restart(process.label);
  }

  // Start new processes that should be running
  for (const process of operations.start) {
    await ProcessManager.start(process.label, process.process);
  }
  // Save the list of processes so that PM2 can resurrect them on restart
  await ProcessManager.dump();
}
