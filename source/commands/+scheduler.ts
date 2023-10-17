// // SERVER MANAGER DAEMON
// // This file defines the background process that should always be running
// // on the server.
// //
// // see ./program.mjs for the implementation of available cli commands
//
// // console.log("hej");
/**
 * Creates a scheduled call to the given function
 *
 * A timeout fires internally once a day until the last
 * day and then fires the given callback when the time has finally
 * expired.
 *
 * Useful as the 'timeout' in node is only good for about 24 days.
 */
// TODO: document

import * as Output from "../output";

type Operation = {
  /** The UNIX timestamp for when the operation should be run */
  timestamp: number;
  /** Has been performed */
  performed: boolean;
};

/** Logger */
const logger = Output.createLogger("Scheduler");

/** Timeout for when to run through the list of operations */
let timeout: NodeJS.Timeout | null = null;

/** List of operations to perform, sorted by UNIX timestamp */
let operations: Array<Operation> = [];

/** Adds an operation to the list and make sure its sorted by UNIX timestamp */
function add(op: Operation) {
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
  console.log(JSON.stringify(operations)); // TODO: continue with scheduling here
  // If this operation is the new earliest one, recreate the internal timeout
  // and perform any operations
  if (operations.findIndex((o) => o.timestamp == op.timestamp) == 0) {
    performOperations();
  }
}

/** Perform a single operation */
async function performOperation(op: Operation) {
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
        op!.performed = true;
        logger.trace("Performing operation", op);
        await performOperation(op);
      }
    }
  } catch (err) {
    logger.error("Failed when performing operations", err, { operations });
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

export async function main() {
  // Add an event handler that validates and adds incoming operations
  process.on("message", (message: { id: number; data: any; topic: string }) => {
    logger.trace("Received new message", message);

    try {
      if (message.topic == "operation") {
        // Validate and add the operation to the list
        const newOperation: Operation = {
          timestamp: Number(message.data.timestamp),
          performed: false,
        };
        add(newOperation);

        // Report that the operation was added
        process.send!({
          type: "process:msg",
          data: {
            status: 200,
          },
        });
      }
    } catch (err) {
      // Report that the operation failed to be added
      process.send!({
        type: "process:msg",
        data: {
          status: 500,
          err: err,
        },
      });
    }
  });

  logger.success("Waiting for operations...");
  performOperations();
}

// Starts the timeout
main();
