import * as PrivateGlobalState from "./state/globalState";
import * as PrivateProcesses from "./processes/_processManager";
import * as PrivateMessages from "./messages/_messages";
import * as PrivateDatabase from "./database/_connection";
import { createLogger } from "./messages";
import { reloadApplicationsConfig, reloadManagerConfig, reloadNetworkConfig, getCurrentRuntimeInformation, State, getOperationsToPerform } from "./state";
import { Redirections, InternalRoutes } from "./traffic";
import { Certificates } from "./certificates";
import { ApplicationProcesses, InternalProcesses } from "./processes";

import { DNSRecords } from "./dns";
// NOTE: clean up imports after program functionality is done
// NOTE: some private imports are made here

// PROGRAM
// This file contains the available commands callable
// from the CLI program. It is only loaded and run per command
// executed by the user

/** Logger */
const logger = createLogger("Server Manager");

/** Lists all DNS records managed by the configured DNS provider */
export async function dns(options: {}) {
	await run(options, async () => {
		const records = await DNSRecords.list();
		console.table(records);
	});
}

/** Prints the current status of the server and managed processes */
export async function status(options: { network: boolean }) {
	await run(options, async () => {
		const runtimeInfo = await getCurrentRuntimeInformation();
		console.log(runtimeInfo);
	});
}

/** Updates the runtime state of the manager with configuration updates */
export async function update(options: { reload?: boolean }) {
	options.reload = true;
	await run(options, async () => {
		const operations = await getOperationsToPerform();
		logger.debug("Performing operations", operations);

		logger.info("Performing changes to redirection configurations...");
		await Redirections.performOperations(operations.redirections);
		logger.info("Performing changes to internal routes...");
		await InternalRoutes.performOperations(operations.internalRoutes);
		logger.info("Performing changes to certificate configurations...");
		await Certificates.performOperations(operations.certificates);
		logger.info("Performing changes to internal processes...");
		await InternalProcesses.performOperations(operations.internalProcesses);
		logger.info("Performing changes to application processes...");
		await ApplicationProcesses.performOperations(operations.applicationProcesses);
		logger.trace("Scheduling certificate renewal if needed...");
		await Certificates.performCertificationRenewal();
		logger.success("Update completed");
	});
}

/** Checks if the current app config file is valid and reports any issues */
export async function validate(options: {}) {
	await run(options, async () => {
		const operations = await getOperationsToPerform();
		const runtimeInfo = await getCurrentRuntimeInformation();

		logger.info("Validating configuration files...");

		// Check unique ports
		const portIssues = [];
		for (const port of runtimeInfo.uniquePorts) {
			if (port < 1 || port > 65535) {
				portIssues.push(`Port ${port} is out of valid range (1-65535)`);
			}
		}

		// Check unique labels
		const labelIssues = [];
		const labelCounts = new Map();
		for (const label of runtimeInfo.uniqueLabels) {
			const count = labelCounts.get(label) || 0;
			labelCounts.set(label, count + 1);
			if (count > 0) {
				labelIssues.push(`Duplicate label found: ${label}`);
			}
		}

		// Report validation results
		if (portIssues.length === 0 && labelIssues.length === 0) {
			logger.success("Configuration validation passed - no issues found");
		} else {
			if (portIssues.length > 0) {
				logger.error("Port validation issues:");
				portIssues.forEach((issue) => logger.error(`  - ${issue}`));
			}
			if (labelIssues.length > 0) {
				logger.error("Label validation issues:");
				labelIssues.forEach((issue) => logger.error(`  - ${issue}`));
			}
		}

		console.log(`\nValidation Summary:
    - Redirections: ${operations.redirections.added.length + operations.redirections.moved.length + operations.redirections.removed.length}
    - Internal Routes: ${operations.internalRoutes.added.length + operations.internalRoutes.moved.length + operations.internalRoutes.removed.length}
    - Certificates: ${operations.certificates.added.length + operations.certificates.moved.length + operations.certificates.removed.length}
    - Application Processes: ${operations.applicationProcesses.start.length + operations.applicationProcesses.restart.length + operations.applicationProcesses.remove.length}
    - Internal Processes: ${operations.internalProcesses.start.length + operations.internalProcesses.restart.length + operations.internalProcesses.remove.length}
    - Unique Labels: ${runtimeInfo.uniqueLabels.length}
    - Unique Ports: ${runtimeInfo.uniquePorts.length}`);
	});
}

/** Look up detailed information about domains and ports */
export async function lookup(options: { domain: string | undefined; port: string | undefined }) {
	await run(options, async () => {
		const runtimeInfo = await getCurrentRuntimeInformation();

		if (options.domain) {
			logger.info(`Looking up domain: ${options.domain}`);

			// Find redirections for this domain
			const redirections = runtimeInfo.redirects.filter((r) => r.hostname === options.domain);
			if (redirections.length > 0) {
				console.log(`\nRedirections for ${options.domain}:`);
				redirections.forEach((r) => {
					console.log(`  - ${r.hostname} → ${r.target} (${r.label})`);
				});
			}

			// Find internal routes for this domain
			const internalRoutes = runtimeInfo.internalRoutes.filter((r) => r.hostname === options.domain);
			if (internalRoutes.length > 0) {
				console.log(`\nInternal Routes for ${options.domain}:`);
				internalRoutes.forEach((r) => {
					console.log(`  - ${r.hostname} → localhost:${r.port} (${r.label})`);
				});
			}

			// Find certificates for this domain
			const certificates = runtimeInfo.certificates.filter((c) => c.hostname === options.domain);
			if (certificates.length > 0) {
				console.log(`\nCertificates for ${options.domain}:`);
				certificates.forEach((c) => {
					const expiresIn = Math.ceil((c.expiresOn.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
					console.log(`  - ${c.hostname} (${c.renewalMethod}) expires in ${expiresIn} days`);
				});
			}

			if (redirections.length === 0 && internalRoutes.length === 0 && certificates.length === 0) {
				console.log(`\nNo configuration found for domain: ${options.domain}`);
			}
		}

		if (options.port) {
			const port = parseInt(options.port, 10);
			logger.info(`Looking up port: ${port}`);

			// Find internal routes using this port
			const routesUsingPort = runtimeInfo.internalRoutes.filter((r) => r.port === port);
			if (routesUsingPort.length > 0) {
				console.log(`\nServices using port ${port}:`);
				routesUsingPort.forEach((r) => {
					console.log(`  - ${r.hostname} (${r.label})`);
				});
			} else {
				console.log(`\nNo services configured to use port ${port}`);
			}

			// Find application processes using this port
			const processesUsingPort = runtimeInfo.applicationProcesses.filter(
				(p) => p.process.details?.env?.PORT === port.toString() || p.process.details?.args?.includes(port.toString()),
			);
			if (processesUsingPort.length > 0) {
				console.log(`\nApplication processes potentially using port ${port}:`);
				processesUsingPort.forEach((p) => {
					console.log(`  - ${p.label} (${p.process.details?.running ? "running" : "stopped"})`);
				});
			}
		}

		if (!options.domain && !options.port) {
			logger.error("Please specify either --domain or --port option");
		}
	});
}

/**
 * Takes a callback function and executes it.
 * Makes sure that a connection to the process manager exists before running it
 * and closes the connection, along with any open broadcast
 * channels afterwards.
 * This ensures that the process manager is accessible during program execution
 * and that the program closes correctly after the method is executed,
 * as the CLI should not keep running
 */
async function run(options: { reload?: boolean } & any, method: () => Promise<void> | void) {
	// Connect to the database
	await PrivateDatabase.connect();

	// Reload the configuration if reload option is given
	if (options.reload) {
		await reloadManagerConfig();
		await reloadApplicationsConfig();
		await reloadNetworkConfig();
	}

	// Determine the current state
	await PrivateGlobalState.initializeState();

	// Connect to process manager
	await PrivateProcesses.connect();

	// Execute the callback function
	await method();

	// Disconnect from process manager
	await PrivateProcesses.disconnect();

	// Disconnect from the database
	await PrivateDatabase.disconnect();

	// Cleanup any open broadcast channels
	await PrivateMessages.disconnect();

	// Force quit
	process.exit(0);
}
