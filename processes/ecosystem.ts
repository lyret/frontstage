import * as FS from "fs";
import * as Path from "path";
import * as PM2 from "pm2";
import { execa } from "execa";

// Determine the path to the ecosystem file
const ecosystemPath = Path.resolve(PATH_TO_RUNTIME, "ecosystem.config.js");

/** Creates and writes a ecosystem for PM2 using the given list of processes from the apps configuration */
export async function generateProcessEcosystem(
  processes: Array<{ label: string; process: Process }>
) {
  // Create bare ecosystem data
  const ecosystem: { apps: any } = {
    apps: [],
  };

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
      env: process.env,
    });
  }

  // Write the ecosystem file to disk
  const contents = `module.exports = ${JSON.stringify(ecosystem, null, 2)};`;
  FS.writeFileSync(ecosystemPath, contents, "utf-8");
}

/** Remove all app processes deleted from the configuration, comapring given processes that should be running with those currently managed by pm2 */
export async function removeAppProcessesFromPM2(
  processes: Array<{ label: string; process: Process }>
) {
  // Get the labels of processes running in PM2
  const runningProcessLabels = await new Promise<Array<string>>(
    (resolve, reject) => {
      PM2.connect((err) => {
        err && reject(err);
        PM2.list((err, list) => {
          err && reject(err);
          PM2.disconnect();
          resolve(list.map((process) => process.name || "unknown"));
        });
      });
    }
  );

  // Get the labels that should be removed
  const processLabelsToRemove: Array<string> = runningProcessLabels.filter(
    (runningLabel) => {
      if (runningLabel == PROCESS_MANAGER_LABEL) {
        return false;
      }
      for (const { label } of processes) {
        if (label == runningLabel) {
          return false;
        }
      }
      return true;
    }
  );

  // Remove the labels from PM2
  for (const label of processLabelsToRemove) {
    console.log(">>>> removing label...", label);
    const removalResult = await execa("pm2", ["del", label]);

    // Output
    console.log("\n> Removing", label, "from PM2...");
    console.log(removalResult.stdout);
  }
}

/** Reload the PM2 ecosystem processes from the currently generated ecosystem file */
export async function reloadPM2() {
  const reloadResult = await execa("pm2", [
    "startOrGracefulReload",
    ecosystemPath,
    "--update-env",
  ]);

  // Output
  console.log("\n> Reloading PM2 processes...");
  console.log(reloadResult.stdout);
}
