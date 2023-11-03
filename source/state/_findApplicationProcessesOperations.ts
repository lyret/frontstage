import type { CurrentRuntimeInfo } from "./getCurrentRuntimeInformation";
import type { ConfigureredOptions } from "./_parseConfigurationOptions";

/**
 * Finds what operations should be performed by the process
 * manager by comparing the current runtime information
 * with the configured options
 */
export async function findApplicationProccessesOperations(
  runtimeInfo: CurrentRuntimeInfo,
  configuratedOptions: ConfigureredOptions
): Promise<State.Operations["applicationProcesses"]> {
  // Operations to perform on application processes
  const operations: State.Operations["applicationProcesses"] = {
    start: [],
    restart: [],
    remove: [],
  };
  console.log(runtimeInfo.applicationProcesses);
  // Find application processes to start and restart
  for (const process of configuratedOptions.applicationProcesses) {
    const existingProcess = runtimeInfo.applicationProcesses.find(
      (proc) => proc.label == process.label
    );
    if (!existingProcess || !existingProcess.process.details?.running) {
      operations.start.push(process);
    }
    // TODO: determine if restart should be here by comparing env, args etc
  }

  // Find applications to remove
  operations.remove = runtimeInfo.applicationProcesses
    .filter((process) => {
      return !configuratedOptions.applicationProcesses.find(
        (proc) => proc.label == process.label
      );
    })
    .map((proc) => proc.label);

  // Return the resulting operations
  return operations;
}
