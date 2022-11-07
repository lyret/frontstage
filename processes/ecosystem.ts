import * as FS from 'fs';
import * as Path from 'path';
import * as PM2 from 'pm2';
import * as execa from 'execa';
import { PATH_TO_APPS, PATH_TO_RUNTIME, PATH_TO_EXECUTABLE, PROCESS_MANAGER_LABEL, PATH_TO_MANAGER } from '../config/settings';

// Determine the path to the ecosystem file
const ecosystemPath = Path.resolve(PATH_TO_RUNTIME, 'ecosystem.config.js');

/** Creates and writes a ecosystem for PM2 using the given list of processes from the apps configuration */
export async function generateProcessEcosystem(processes: Array < { label: string, process: Process } > ) {

	// Create bare ecosystem data
	const ecosystem: { apps: any } = {
		apps: []
	}

	// Add all given processes to the ecosystem
	for (const { label, process } of processes) {

		// Determine the absolute working directory for the process, relative to the apps directory
		const absoluteWd = Path.resolve(PATH_TO_APPS, process.cwd || "");

		ecosystem.apps.push({
			name: label,
			script: process.script,
			args: process.args,
			interpreter: process.intepreter,
			cwd: absoluteWd,
			namespace: "apps",
			env: process.env
		});
	}

	// Write the ecosystem file to disk
	const contents = `module.exports = ${JSON.stringify(ecosystem, null, 2)};`;
	FS.writeFileSync(ecosystemPath, contents, 'utf-8');
}


/** Remove all app processes deleted from the configuration, comapring given processes that should be running with those currently managed by pm2 */
export async function removeAppProcessesFromPM2(processes: Array < { label: string, process: Process } > ) {
	// Get the labels of processes running in PM2
	const runningProcessLabels = await new Promise < Array < string >> ((resolve, reject) => {
		PM2.connect((err) => {
			err && reject(err);
			PM2.list((err, list) => {
				err && reject(err);
				PM2.disconnect();
				resolve(list.map(process => process.name || "unknown"));
			});
		});
	});

	// Get the labels that should be removed
	const processLabelsToRemove: Array < string > = runningProcessLabels.filter(runningLabel => {
		if (runningLabel == PROCESS_MANAGER_LABEL) {
			return false;
		}
		for (const { label } of processes) {
			if (label == runningLabel) {
				return false;
			}
		}
		return true;
	});

	// Remove the labels from PM2
	for (const label of processLabelsToRemove) {
		console.log(">>>> removing label...", label);
		const removalResult = await execa('pm2', ['del', label]);

		// Output
		console.log("\n> Removing", label, "from PM2...")
		console.log(removalResult.stdout);
	}
}

/** Reload the PM2 ecosystem processes from the currently generated ecosystem file */
export async function reloadPM2() {
	const reloadResult = await execa('pm2', ['startOrGracefulReload', ecosystemPath, '--update-env'])

	// Output
	console.log("\n> Reloading PM2 processes...")
	console.log(reloadResult.stdout);
}

/**  */
export async function deamonizeServerManager() {
	try {

		// Start or restart the PM2 process of the manager
		await new Promise < void > ((resolve, reject) => {
			PM2.connect((err) => {
				err && reject(err);

				PM2.list((err, list) => {
					err && reject(err);

					// Restart the process if it exists
					for (const process of list) {
						if (process.name == PROCESS_MANAGER_LABEL) {
							PM2.restart(PROCESS_MANAGER_LABEL, (err) => {
								err && reject(err);
								PM2.disconnect()
								
								// Output
								console.log("\n> Restarted the Server Manager...")
								
								// Done
								resolve();
							});
							
							// Prevent also starting when found
							return;
						}
					}
					
					// Start a new process
					PM2.start({
						script: PATH_TO_EXECUTABLE,
						name: PROCESS_MANAGER_LABEL,
						cwd: PATH_TO_MANAGER,
					}, (err) => {
						err && reject(err);
						PM2.disconnect();
						
						// Output
						console.log("\n> Added the Server Manager to PM2...")
						
						// Done
						resolve();
					})
				});
			});
		});
	} catch (err) {
		
		// Output any errors
		console.error("> Unable to demonize server-manager");
		console.error("  its possble its already started\n");
	}
}