import * as Path from "node:path";
import * as ProcessManager from "./_processManager";
import { createLogger } from "../messages";
import { State } from "../state";

/** Logger */
const logger = createLogger("Internal Processes");

/**
 * Get an array of all currently running internal processes
 */
export async function list() {
	const runningInternalProcesses = (await ProcessManager.list()).filter((proc) => proc.namespace == MANAGER_DAEMON_NAMESPACE);
	return runningInternalProcesses;
}

/**
 * Handles operations that needs to be performed on internal
 * processes (the subprocess of the server manager)
 */
export async function performOperations(operations: State.Operations["internalProcesses"]) {
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
	// so that the process manager can restore them when restarted
	await ProcessManager.dump();
}

// AVAILABLE INTERNAL PROCESSES

/** Dummy process options */
export const Dummy: State.Operations["internalProcesses"]["start"][0] = {
	label: "DUMMY",
	process: {
		namespace: MANAGER_DAEMON_NAMESPACE,
		cwd: BIN_DIRECTORY,
		script: Path.resolve(BIN_DIRECTORY, "+dummy.js"),
	},
};

/** Scheduler process options */
export const Scheduler: State.Operations["internalProcesses"]["start"][0] = {
	label: "SCHEDULER",
	process: {
		namespace: MANAGER_DAEMON_NAMESPACE,
		cwd: BIN_DIRECTORY,
		script: Path.resolve(BIN_DIRECTORY, "+scheduler.js"),
	},
};

/** Public Web Server process options */
export const WebServer: State.Operations["internalProcesses"]["start"][0] = {
	label: "WEBSERVER",
	process: {
		namespace: MANAGER_DAEMON_NAMESPACE,
		cwd: BIN_DIRECTORY,
		script: Path.resolve(BIN_DIRECTORY, "+webServer.js"),
	},
};
