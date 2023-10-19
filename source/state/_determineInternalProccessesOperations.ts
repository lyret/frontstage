import * as Path from "node:path";
import { InternalProcesses } from "../processes";

/**
 * Uses the next and previous manager state and environmental variables
 * to determine what operations should be made to internal processes
 */
export async function determineInternalProccessesOperations(
  prevState: Manager.ApplicationsState,
  nextState: Manager.ApplicationsState
): Promise<Manager.Operations["internalProcesses"]> {
  // Create the context object for the determination function
  const context = {
    // Get a list of running processes
    runningInternalProcesses: await InternalProcesses.list(),
    // Internal processes should be hard restarted when new builds are available
    // that is so that changed env variables and other configurations are
    // updated when the process restarts
    updateNeeded: prevState.buildNumber != nextState.buildNumber,
    // Determined operations on internal processes
    operations: {
      start: [],
      restart: [],
      remove: [],
    } as Manager.Operations["internalProcesses"],
  };

  // Run the determination function for each possible internal process

  // The Dummy process should be always running
  determineOp(dummyProcess, context, () => true);

  // The Scheduler process should be always running
  determineOp(schedulerProcess, context, () => true);

  // Return the resulting operations
  return context.operations;
}

/**
 * Determines what operation should be performed on the given process
 * using the given lambda function
 */
function determineOp(
  process: Manager.ApplicationsState["internalProcesses"][0],
  ctx: {
    runningInternalProcesses: Array<Process.Status>;
    updateNeeded: boolean;
    operations: Manager.Operations["internalProcesses"];
  },
  condition: () => boolean
) {
  const shouldBeRunning = condition();
  const existingProcess = ctx.runningInternalProcesses.find(
    (proc) => proc.label == process.label
  );
  if (shouldBeRunning) {
    // The process is not running and needs to be started
    if (!existingProcess || !existingProcess.details?.running) {
      ctx.operations.start.push(process);
    }
    // The process is running but needs to be updated, add it
    // also to 'start' so that its hard restarted
    else if (ctx.updateNeeded) {
      ctx.operations.start.push(process);
    }
  } else if (existingProcess) {
    ctx.operations.remove.push(process);
  }
}

// AVAILABLE INTERNAL PROCESSES

/** Dummy process options */
const dummyProcess: Manager.ApplicationsState["internalProcesses"][0] = {
  label: "DUMMY",
  process: {
    cwd: BIN_DIRECTORY,
    namespace: "manager",
    script: Path.resolve(BIN_DIRECTORY, "+dummy.js"),
  },
};

/** Scheduler process options */
const schedulerProcess: Manager.ApplicationsState["internalProcesses"][0] = {
  label: "SCHEDULER",
  process: {
    cwd: BIN_DIRECTORY,
    namespace: "manager",
    script: Path.resolve(BIN_DIRECTORY, "+scheduler.js"),
  },
};
