import * as ProcessManager from "./_pm2";

/**
 * Get an array of all currently running application processes
 */
export async function list() {
  const runningApplicationProcesses = (await ProcessManager.list()).filter(
    (proc) => proc.namespace == APP_DAEMON_NAMESPACE
  );
  return runningApplicationProcesses;
}

/**
 * Handles operations that needs to be performed on application
 * processes
 */
export async function performOperations(
  operations: State.Operations["applicationProcesses"]
) {
  // Stop and remove processes that should not be running anymore
  for (const label of operations.remove) {
    await ProcessManager.remove(label);
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
