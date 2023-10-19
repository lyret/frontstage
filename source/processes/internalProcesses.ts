import * as ProcessManager from "./_pm2";

/**
 * Get an array of all currently running internal processes
 */
export async function list() {
  const runningInternalProcesses = (await ProcessManager.list()).filter(
    (proc) => proc.namespace == "manager"
  );
  return runningInternalProcesses;
}

/**
 * Handles operations that needs to be performed on internal
 * processes
 */
export async function performOperations(
  operations: Manager.Operations["internalProcesses"]
) {
  // Stop and remove processes that should not be running anymore
  for (const process of operations.remove) {
    await ProcessManager.remove(process.label);
  }

  // Soft restart processes
  for (const process of operations.restart) {
    await ProcessManager.restart(process.label);
  }

  // Start or update processes
  for (const process of operations.start) {
    await ProcessManager.start(process.label, process.process);
  }

  // Save the list of currently running processes
  // so that PM2 can resurrect them when restarted
  await ProcessManager.dump();
}
