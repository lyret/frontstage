import * as Output from "../output";
import * as ProcessManager from "../processes";

/** logger */
const logger = Output.createLogger("Commands");

/**
 * Sends a command to the running command handler process running in PM2
 * which will result in a specific operation being scheduled.
 * Returns true if successful, false otherwise
 */
export async function sendCommand(
  label: Process.Status["label"],
  delayMS: any
) {
  const proc = await ProcessManager.find(label);
  if (!proc) {
    logger.error(`No process labeled ${label} is running`);
    return false;
  }
  return ProcessManager.sendMessage(
    proc,
    "operation",
    {
      timestamp: Date.now() + delayMS,
    },
    true
  );
}
