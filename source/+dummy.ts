import { createLogger } from "./statistics";

// DUMMY
// This is a subprocess of the server manager, it simply outputs to the console
// Created to test the handling of subsystems

/** Logger */
const logger = createLogger("Dummy");

/**
 * Prints to the console repeatedly
 */
export async function main() {
  setInterval(() => logger.info("Höhöhöhöö"), 2000);
}
