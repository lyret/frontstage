import * as ProcessManager from "./_pm2";
import { createLogger } from "../statistics";

// SCHEDULED OPERATIONS
// This module exports methods for interacting
// with the internal scheduler process while
// running

/** logger */
const logger = createLogger("Scheduled Operations");

/**
 * Sends an operation to the internal scheduler process running in PM2
 * which will result in it being executed at the specific timestamp. It
 * waits for a response to the server
 * Returns true if successful, false otherwise
 */
export async function scheduleOperation(
  operation: Omit<Scheduled.Operation, "performed">
) {
  const proc = await ProcessManager.find("SCHEDULER");
  if (!proc) {
    logger.error(`The internal scheduler process is not running`);
    return false;
  }
  const rest = await ProcessManager.sendMessage(
    proc,
    "operation",
    {
      timestamp: operation.timestamp,
      perfomed: false,
    },
    true
  );
  console.log("here!", rest);
}
