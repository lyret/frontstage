import { satisfies } from "compare-versions";
import { readFile } from "fs/promises";
import { exec } from "node:child_process";
import { $ } from "execa";

// SERVER MANAGER TESTS
// This file exports a function for testing if the runtime
// environment is configurated correctly for the server manager
// Will fail if PM2 is not available or any global dependcies
// are on incorrect versions

export async function testRuntimeEnvironment() {
  let ok = await testIfProcessManagerIsRunning();
  if (ok) {
    ok = await testEngineRequirements();
  }
  return ok;
}

async function testEngineRequirements() {
  let results = true;
  try {
    const pkg = JSON.parse(
      await readFile(new URL("./package.json", import.meta.url))
    );

    if (pkg.engines) {
      for (const dependency of Object.keys(pkg.engines)) {
        const engineRequirement = pkg.engines[dependency];

        try {
          const { stdout: binVersion } = await $`${dependency} --version`;
          const satisfaction = satisfies(binVersion, engineRequirement);

          if (satisfaction) {
            console.log(
              `${dependency.toUpperCase()} version ${binVersion} is OK`
            );
          } else {
            console.log(
              `${dependency.toUpperCase()} version ${binVersion} is NOT compitable, ${engineRequirement} is required!`
            );
            results = false;
          }
        } catch {
          console.error(`${dependency.toUpperCase()} is NOT available`);
          results = false;
        }
      }
    }
  } catch (err) {
    console.error("Failed to verify engine requirements");
    console.error(err);
    return false;
  }
  return results;
}

async function testIfProcessManagerIsRunning() {
  try {
    const isRunning = await new Promise((resolve, reject) => {
      exec('ps aux | grep -c "PM2"', (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        const actualCount = parseInt(stdout.trim());
        console.log("here", actualCount);
        resolve(actualCount > 2);
      });
    });

    if (isRunning) {
      console.log(`PM2 is running`);
    } else {
      console.log(
        `PM2 is NOT running, check your installation startup configuration`
      );
    }
    return isRunning;
  } catch (err) {
    console.error("Failed to verify if PM2 is running");
    return false;
  }
}
