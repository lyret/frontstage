#!/usr/bin/env node
// SERVER MANAGER PROGRAM
// This file defines the cli program with available commands used to interact
// with the managed processes on the server
//
// The daemon process that is always running is implemented in ./daemon.mjs

import * as Esbuild from "esbuild";
import * as Path from "node:path";
import { program } from "commander";
import { config } from "dotenv";
import { parse } from "dotenv-parse";
import { fileURLToPath } from "node:url";

// ENVIRONMENT VARIABLES CONFIGURATION ----------

/** The path to the directory of this program file */
const installationPath = Path.dirname(fileURLToPath(import.meta.url));

const { parsed: defaultEnvVariables } = config({
  override: true,
  path: Path.resolve(installationPath, ".defaults.env"),
});
const { parsed: customizedEnvVariables } = config({
  override: true,
  path: Path.resolve(installationPath, ".env"),
});
const env = parse({ ...defaultEnvVariables, ...customizedEnvVariables });
env["SOURCE_DIRECTORY"] = env["SOURCE_DIRECTORY"] || installationPath;
process.env["SOURCE_DIRECTORY"] = env["SOURCE_DIRECTORY"];
process.env["BIN_DIRECTORY"] = env["BIN_DIRECTORY"];
for (let key of Object.keys(env)) {
  if (typeof env[key] == "string") {
    env[key] = `"${env[key]}"`;
  } else {
    env[key] = `${env[key]}`;
  }
}

// FUNCTION DEFINITIONS ---------------

/**
 * Imports the existing build from the binary directory and executes the given method name
 */
async function importAndRun(methodName, ...methodArguments) {
  // Rebuild the source code if the build option was given
  const { build } = program.opts();
  if (build) {
    await createNewBuild();
  }

  // Import and run the given method name
  const latestBuild = Path.resolve(process.env["BIN_DIRECTORY"], "index.js");
  try {
    const module = await import(latestBuild);
    try {
      await module[methodName](...methodArguments);
    } catch (err) {
      console.error(`Failed to execute "${methodName}"`);
      console.error(err);
      process.exit(1);
    }
  } catch (err) {
    console.error("Failed to load the latest build");
  }
}

/**
 * Creates a new build in the binary directory
 */
async function createNewBuild() {
  const buildOptions = {
    platform: "node",
    packages: "external",
    entryPoints: [Path.resolve(installationPath, "source", "index.ts")],
    bundle: true,
    define: env,
    outdir: Path.resolve(process.env["BIN_DIRECTORY"]),
  };
  const result = await Esbuild.build(buildOptions);
  return result;
}

// PROGAM DEFINITION ---------------

program
  .name("manager")
  .description(
    "Manages all routing, proxying and running of application processes on a server, the goal is to be a portable swiss-army knife for self-hosting"
  );

// Add Environment Inspection option
program.option(
  "-e, --env",
  "Prints the current environmental variables set before running",
  async () => {
    let output = "\nCurrent environment:\n\n";
    for (const key of Object.keys(env)) {
      output += key + ": " + env[key] + "\n";
    }
    console.log(output);
  }
);

// Add rebuild option
program.option("-b, --build", "Rebuilds the source code before running");

// Add Status command
program
  .command("status", { isDefault: true })
  .description("Print the current status of the server and managed processes")
  .option(
    "-n, --network",
    "Also validate and current network, domain and certificate status"
  )
  .action(async (opts) => {
    // opts.network
    await importAndRun("status", opts);
  });

// Add reload / reconfiguration command
program
  .command("reload")
  .description(
    "Reconfigure the manager with modifications to the app config file"
  )
  .action(async () => {
    await importAndRun("reload");
  });

// Add validation command
program
  .command("validate")
  .description("Check if the current app config file is valid")
  .option(
    "-n, --network",
    "Include validation of current network, domain and certificates in the config file"
  )
  .action(async (opts) => {
    await importAndRun("validate", opts);
  });

// Add Lookup command
program
  .command("lookup")
  .option(
    "-d, --domain [hostname]",
    "Look up and print the current status of a hostname and any routes and certificates"
  )
  .option(
    "-p, --port [portnumber]",
    "Look up and return the current status of a given port"
  )
  .description("Look up good to know information")
  .action(async (options) => {
    await importAndRun("lookup", options);
  });

// Add build command
program
  .command("build")
  .description("Create a new build from the source files")
  .action(async () => {
    await createNewBuild();
  });

// PROGRAM EXECUTION ---------------

program.program.parse();
