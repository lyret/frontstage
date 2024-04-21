#!/usr/bin/env node

import * as Esbuild from "esbuild";
import * as Path from "node:path";
import * as FSE from "fs-extra";
import * as FS from "fs/promises";
import { program } from "commander";
import { fileURLToPath } from "node:url";
import { constants } from "./_constants.mjs";
import { testRuntimeEnvironment } from "./_tests.mjs";

// SERVER MANAGER LAUNCHER
// This file defines the cli program with available commands used to interact
// with the managed processes on the server

// ENVIRONMENT VARIABLES CONFIGURATION ----------

/** The path to the directory of this program file */
const installationPath = Path.dirname(fileURLToPath(import.meta.url));

// Format the constants object correctly for defining global variables
// in the build file and make sure the necessary directories and files
// are available for making builds and that are correctly resolved
// from the executing pwd directory
for (let key of Object.keys(constants)) {
	process.env[key] = constants[key];
	if (key.includes("DIRECTORY")) {
		constants[key] = Path.resolve(installationPath, constants[key]);
		FSE.ensureDirSync(constants[key]);
	} else if (key.includes("FILE")) {
		constants[key] = Path.resolve(installationPath, constants[key]);
		FSE.ensureFileSync(constants[key]);
	}

	if (typeof constants[key] == "string") {
		constants[key] = `"${constants[key]}"`;
	} else {
		constants[key] = `${constants[key]}`;
	}
}

// FUNCTIONS ---------------

/**
 * Imports the existing build from the binary directory and executes the given method name
 */
async function importAndRun(methodName, options) {
	// Rebuild the source code if the build option was given
	const { build } = program.opts();
	if (build) {
		await createNewBuilds();
	}

	// Import and run the given method name
	const latestBuild = Path.resolve(process.env["BIN_DIRECTORY"], "+program.js");
	try {
		const module = await import(latestBuild);
		try {
			await module[methodName]({ ...options, ...program.opts() });
		} catch (err) {
			console.error(`Failed to execute "${methodName}"`);
			console.error(err);
			process.exit(1);
		}
	} catch (err) {
		console.error(err);
		console.error("\nFailed to load the latest build");
	}
}

/**
 * Creates a new build in the binary directory
 */
async function createNewBuilds() {
	// Find entry points to build
	const entryPoints = await FS.readdir(
		Path.resolve(installationPath, "source")
	).then((dirs) =>
		dirs
			.filter((fileName) => fileName[0] == "+")
			.map((fileName) => Path.resolve(installationPath, "source", fileName))
	);

	const buildOptions = {
		platform: "node",
		packages: "external",
		entryPoints,
		bundle: true,
		sourcemap: true,
		define: constants,
		outdir: Path.resolve(process.env["BIN_DIRECTORY"]),
	};
	const result = await Esbuild.build(buildOptions);
	return result;
}

// PROGAM DEFINITION ---------------

program
	.name("manager")
	.description(
		"A foundational layer for your self-hosted web services, making it easy to develop and host your web based applications"
	);

// Add rebuild option
program.option("-b, --build", "Rebuilds the source code before running");

// Add reconfigure option
program.option(
	"-r, --reload",
	"Reloads the configuration files before running and checks runtime info"
);

// Add verify command
program
	.command("verify")
	.description("Verifies the current installation and reports any problems")
	.action(async () => {
		await testRuntimeEnvironment();
	});

// Add dns command
program
	.command("dns")
	.description("TODO: document")
	.action(async (options) => {
		await importAndRun("dns", options);
	});

// Add Status command
program
	.command("status", { isDefault: true })
	.description("Print the current status of the server and managed processes")
	.action(async (options) => {
		await importAndRun("status", options);
	});

// Add reload / reconfiguration command
program
	.command("update")
	.description(
		"Reconfigure the manager with modifications made to the configuration"
	)
	.action(async (options) => {
		await importAndRun("update", options);
	});

// Add validation command
program
	.command("validate")
	.description("Check if the current app config file is valid")
	.action(async (options) => {
		await importAndRun("validate", options);
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
	.description("Create new executable files from the source code")
	.action(async () => {
		await createNewBuilds();
	});

// PROGRAM EXECUTION ---------------

program.program.parse();
