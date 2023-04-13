#!/usr/bin/env node
import * as Esbuild from "esbuild";
import * as Path from "node:path";
import { program } from "commander";
import { config } from "dotenv";
import { parse } from "dotenv-parse";
import { fileURLToPath } from "node:url";

// ENVIRONMENT VARIABLES CONFIGURATION ----------

const installationPath = Path.dirname(fileURLToPath(import.meta.url));

const { parsed: defaultEnvVariables } = config({
  override: true,
  path: Path.resolve(installationPath, ".env.defaults"),
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

async function importLatestBuild(methodName) {
  console.log(installationPath);
  const latestBuild = Path.resolve(installationPath, ".bin", "index.js");
  try {
    const module = await import(latestBuild);
    try {
      await module[methodName]();
    } catch (err) {
      console.error(`execution of "${methodName}" in existing build failed`);
      console.error(err);
      process.exit(1);
    }
  } catch (err) {
    console.error("import of existing build failed");
  }
}

/**
 * Creates a new build from the typescript entry file
 */
async function createNewBuild() {
  try {
    const buildOptions = {
      platform: "node",
      packages: "external",
      entryPoints: [Path.resolve(installationPath, "./index.ts")],
      bundle: true,
      define: env,
      outdir: Path.resolve(installationPath, "./.bin"),
    };
    const result = await Esbuild.build(buildOptions);
    return result;
  } catch (err) {
    console.error("Failed to create a new program build");
  }
}

// PROGAM DEFINITION ---------------

program.name("Server Manager").description("");

// Add start command
program
  .command("start", { isDefault: true })
  .description("")
  .action(async () => {
    await createNewBuild();
    await importLatestBuild("main");
  });
// Add build command
program
  .command("build")
  .description("")
  .action(async () => {
    await createNewBuild();
  });
program
  .command("bootstrap")
  .description("")
  .action(async () => {
    await createNewBuild();
    await importLatestBuild("bootstrap");
    process.exit(0);
  });
// program
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
