import { satisfies } from "compare-versions";
import { readFile } from "fs/promises";
import { exec } from "node:child_process";
import { $ } from "execa";

// SERVER MANAGER TESTS
// This file exports a function for testing if the runtime
// environment is configured correctly for the server manager
// Will fail if PM2 is not available or any global dependencies
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
    // Test the built-in process manager by checking if we can get status
    const isRunning = await new Promise((resolve, reject) => {
      exec('node launcher.mjs status', (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        // If we can get status without error, process manager is working
        resolve(true);
      });
    });

    if (isRunning) {
      console.log(`Built-in process manager is running`);
    } else {
      console.log(
        `Built-in process manager is NOT working, check your installation`
      );
    }
    return isRunning;
  } catch (err) {
    console.error("Failed to verify if built-in process manager is working");
    return false;
  }
}
