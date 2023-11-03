import type { CurrentRuntimeInfo } from "./getCurrentRuntimeInformation";
import { InternalProcesses } from "../processes";

/**
 * Finds what operations should be performed by the process
 * manager by reading the current runtime information
 * and checking the global manager state
 */
export async function findInternalProccessesOperations(
  runtimeInfo: CurrentRuntimeInfo
): Promise<State.Operations["internalProcesses"]> {
  // Create the context object for the determination function
  const context = {
    // Get a list of running processes
    runningInternalProcesses: runtimeInfo.internalProcesses,
    // Internal processes should be hard restarted when new builds are available
    // that is so that changed env variables and other configurations are
    // updated when the process restarts
    updateNeeded: false, // FIXME: removed for now, was: current.buildNumber != next.buildNumber,
    // Determined operations on internal processes
    operations: {
      start: [],
      restart: [],
      remove: [],
    } as State.Operations["internalProcesses"],
  };

  // Run the determination function for each possible internal process

  // The Dummy process should never be running
  determineOperation(InternalProcesses.Dummy, context, () => false);

  // The Scheduler process should be always running
  determineOperation(InternalProcesses.Scheduler, context, () => true);

  // The Web Server process should be always running
  determineOperation(InternalProcesses.WebServer, context, () => true);

  // Return the resulting operations
  return context.operations;
}

/**
 * Determines what operation should be performed on the given process
 * using the given lambda function
 */
function determineOperation(
  process: { label: string; process: Process.Options },
  ctx: {
    runningInternalProcesses: CurrentRuntimeInfo["internalProcesses"];
    updateNeeded: boolean;
    operations: State.Operations["internalProcesses"];
  },
  condition: () => boolean
) {
  const shouldBeRunning = condition();
  const existingProcess = ctx.runningInternalProcesses.find(
    (proc) => proc.label == process.label
  );
  if (shouldBeRunning) {
    // The process is not running and needs to be started
    if (!existingProcess || !existingProcess.process.details?.running) {
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
