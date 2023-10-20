import { createLogger, onScheduleOperation } from "./messages";

// SCHEDULER
// This file contains the an internal process for scheduling operations
// to be performed at a later time. It keeps a

/** Logger */
const logger = createLogger("Scheduler");

/** Timeout for when to run through the list of operations */
let timeout: NodeJS.Timeout | null = null;

/** List of operations to perform, sorted by UNIX timestamp */
let operations: Array<Messages.ScheduledOperation> = [];

/** Adds an operation to the list and make sure its sorted by UNIX timestamp */
function add(op: Messages.ScheduledOperation) {
  operations.push(op);
  operations = operations.sort((a, b) => {
    if (a.timestamp < b.timestamp) {
      return -1;
    }
    if (a.timestamp > b.timestamp) {
      return 1;
    }
    return 0;
  });

  // If this operation is the new earliest one, recreate the internal timeout
  // and perform any operations
  if (operations.findIndex((o) => o.timestamp == op.timestamp) == 0) {
    performOperations();
  }
}

/** Perform a single operation */
async function performOperation(op: Messages.ScheduledOperation) {
  console.log("PERFORMING", op);
  // FIXME: Perform operation
}

/** Run through the list of operations and re-creates the timeout object */
async function performOperations() {
  // Destroy the internal timeout
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  // Current UNIX timestamp
  const initialNow = Date.now();

  // Iterate through the array of operations
  try {
    logger.info(
      "Performing scheduled operations, operations to perform: " +
        operations.length
    );

    for (const op of operations) {
      if (!op.performed && op.timestamp <= initialNow) {
        op.performed = true;
        logger.trace("Performing operation", op);
        try {
          await performOperation(op);
        } catch (err) {
          logger.error("Failed to perform the operation", err, op);
          op.performed = false;
        }
      }
    }
  } catch (err) {
    logger.error("Failed when trying to perform operations", err);
  } finally {
    // Filter and sort the operations remaining to be perform
    operations = operations
      .filter((op) => !op.performed)
      .sort((a, b) => {
        if (a.timestamp < b.timestamp) {
          return -1;
        }
        if (a.timestamp > b.timestamp) {
          return 1;
        }
        return 0;
      });

    // Get the time to the next operation to perform
    // Make sure the time to the next operation does not exceed one day
    const nextOperation = operations[0];
    const waitTime = Math.min(
      ONE_DAY,
      (nextOperation ? nextOperation.timestamp : initialNow + ONE_DAY) -
        initialNow
    );
    logger.trace("Operation in queue: " + operations.length);
    logger.trace("Waiting for " + waitTime + " ms");

    // Recreate the internal timeout object with
    // the time left to the next operation to perform
    timeout = setTimeout(() => {
      performOperations();
    }, waitTime);
  }
}

/**
 * Creates a timeout that fires at the next scheduled operation, or at least once a day
 * as the 'timeout' in node is only good for about 24 days.
 * When the timeout fires all scheduled operations with that timestamp are performed.
 * Also when new scheduled operations are received from the process bus the timer
 * is updated accordingly
 */
export async function main() {
  // Add an event handler that validates and adds incoming operations
  onScheduleOperation((operation) => {
    logger.trace("Received new message", operation);
    add({
      ...operation,
      performed: false,
    });
  });

  logger.success("Waiting for operations...");
  performOperations();
}

// Starts the internal process
main();
