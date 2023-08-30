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
for (let key of Object.keys(env)) {
  if (typeof env[key] == "string") {
    env[key] = `"${env[key]}"`;
  } else {
    env[key] = `${env[key]}`;
  }
}

// FUNCTION DEFINITIONS ---------------

/**
 * Imports the existing build from the .bin directory and executes the given method name
 */
async function importAndRun(methodName) {
  const latestBuild = Path.resolve(installationPath, ".bin", "index.js");
  try {
    const module = await import(latestBuild);
    try {
      await module[methodName]();
    } catch (err) {
      console.error(`Failed to execute "${methodName}"`);
      console.error(err); // TODO: add verbosity
      process.exit(1);
    }
  } catch (err) {
    console.error("Failed to load latest build");
  }
}

/**
 * Creates a new build in the .bin directory
 */
async function createNewBuild() {
  const buildOptions = {
    platform: "node",
    packages: "external",
    entryPoints: [Path.resolve(installationPath, "source", "index.ts")],
    bundle: true,
    define: env,
    outdir: Path.resolve(installationPath, ".bin"),
  };
  const result = await Esbuild.build(buildOptions);
  return result;
}

// PROGAM DEFINITION ---------------

program.name("manager").description("");

// Add options
program.option(
  "-b, --build",
  "rebuilds the manager from source before running"
);

// Parse the options given on execution
const opts = program.opts();

// Add additional help text
let helpText = "";

// ...add current options to help text
if (Object.keys(opts).length) {
  helpText += "\nCurrent options:\n";
  for (const key of Object.keys(opts)) {
    helpText += key + ": " + opts[key] + "\n";
  }
}

// ...add current environment settings to help text
helpText += "\nCurrent environment:\n\n";
for (const key of Object.keys(env)) {
  helpText += key + ": " + env[key] + "\n";
}

program.addHelpText("after", helpText);

// Add start command
program
  .command("start", { isDefault: true })
  .description("Executes the manager process")
  .action(async () => {
    if (opts.build) {
      await createNewBuild();
    }
    await importAndRun("main");
  });
// Add build command
program
  .command("build")
  .description("Create a new build from the source files")
  .action(async () => {
    await createNewBuild();
  });
// program
//   .command("bootstrap")
//   .description("")
//   .action(async () => {
//     await createNewBuild();
//     //await importLatestBuild("bootstrap");
//     process.exit(0);
//   });
// TODO: finish the program
//   .command("watch")
//   .description("")
//   .action(async () => {
//     //const result = await esbuild.build(buildOptions);
//     //console.log(result);
//     console.log("watch result");
//   });
//
// // Add build command
// program
//   .command("test")
//   .description("")
//   .action(async () => {
//     const result = await esbuild.build(buildOptions);
//     console.log(result);
//   });
//
// // Add deamon command
// program
//   .command("deamon")
//   .description("")
//   .action(async () => {
//     const result = await esbuild.build(buildOptions);
//     console.log(result);
//   });
//
// // Add watch command
// program
//   .command("watch")
//   .description("")
//   .action(async () => {
//     const ctx = await esbuild.context(buildOptions);
//     await ctx.watch();
//     console.log("watching...");
//   });

// PROGRAM EXECUTION ---------------

program.program.parse();
