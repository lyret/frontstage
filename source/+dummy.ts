import { createLogger } from "./statistics";

// DUMMY
// This is an internal process of the server manager, it simply outputs to the console
// Created to test the handling of internal processes

/** Logger */
const logger = createLogger("Dummy");

/**
 * Prints to the console repeatedly
 */
export async function main() {
  logger.info("I'm a dummy, waiting 10s");
  setTimeout(() => main(), 10000);
}

// Starts the internal process
main();
