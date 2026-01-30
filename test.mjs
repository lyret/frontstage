#!/usr/bin/env node

// Frontstage Test Script
// Simple validation and testing without external dependencies

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Colors for output
const colors = {
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	reset: "\x1b[0m",
};

function log(level, message) {
	const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
	const prefix = {
		info: `${colors.blue}[INFO]${colors.reset}`,
		success: `${colors.green}[PASS]${colors.reset}`,
		warning: `${colors.yellow}[WARN]${colors.reset}`,
		error: `${colors.red}[FAIL]${colors.reset}`,
	};
	console.log(`${prefix[level]} ${timestamp} ${message}`);
}

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;
let testsWarning = 0;

function test(description, testFn) {
	try {
		const result = testFn();
		if (result === true) {
			log("success", description);
			testsPassed++;
		} else if (result === "warning") {
			log("warning", description);
			testsWarning++;
		} else {
			log("error", `${description} - ${result || "Failed"}`);
			testsFailed++;
		}
	} catch (error) {
		log("error", `${description} - ${error.message}`);
		testsFailed++;
	}
}

// Test functions
function testNodeVersion() {
	const version = process.version;
	const major = parseInt(version.slice(1).split(".")[0]);
	if (major >= 18) {
		return true;
	} else {
		return `Node.js ${version} found, but version 18+ required`;
	}
}

function testFileExists(filePath) {
	return fs.existsSync(path.join(__dirname, filePath));
}

function testDirectoryExists(dirPath) {
	const fullPath = path.join(__dirname, dirPath);
	return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
}

function testPackageJson() {
	try {
		const packagePath = path.join(__dirname, "package.json");
		const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));

		if (!packageData.name) {
			return "package.json missing name field";
		}

		// Version is not required for all projects
		if (!packageData.version && !packageData.description) {
			return "package.json missing version or description";
		}

		if (!packageData.dependencies || Object.keys(packageData.dependencies).length === 0) {
			return "warning";
		}

		return true;
	} catch (error) {
		return `package.json error: ${error.message}`;
	}
}

function testConfigurationFiles() {
	const devConfigExists = testFileExists("configuration.dev.yaml");
	const devAppsExists = testFileExists("applications.dev.yaml");

	if (devConfigExists && devAppsExists) {
		return true;
	} else if (!devConfigExists && !devAppsExists) {
		return "warning";
	} else {
		return "Some development config files missing";
	}
}

function testSourceStructure() {
	const requiredDirs = ["source", "source/certificates", "source/database", "source/dns", "source/processes", "source/state", "source/traffic"];

	const missingDirs = requiredDirs.filter((dir) => !testDirectoryExists(dir));

	if (missingDirs.length === 0) {
		return true;
	} else {
		return `Missing directories: ${missingDirs.join(", ")}`;
	}
}

function testMainFiles() {
	const requiredFiles = ["launcher.mjs", "_constants.mjs", "source/+program.ts", "source/+webServer.ts"];

	const missingFiles = requiredFiles.filter((file) => !testFileExists(file));

	if (missingFiles.length === 0) {
		return true;
	} else {
		return `Missing files: ${missingFiles.join(", ")}`;
	}
}

function testGUIFiles() {
	const guiFiles = ["gui/index.html"];

	const missingFiles = guiFiles.filter((file) => !testFileExists(file));

	if (missingFiles.length === 0) {
		return true;
	} else {
		return "warning";
	}
}

function testDocumentation() {
	const docFiles = ["README.md", "CONFIGURATION.md", "CHANGELOG.md"];

	const missingFiles = docFiles.filter((file) => !testFileExists(file));

	if (missingFiles.length === 0) {
		return true;
	} else if (missingFiles.length <= 1) {
		return "warning";
	} else {
		return `Missing documentation: ${missingFiles.join(", ")}`;
	}
}

function testBuildDirectory() {
	if (testDirectoryExists(".bin")) {
		const binFiles = fs.readdirSync(path.join(__dirname, ".bin"));
		if (binFiles.length > 0) {
			return true;
		} else {
			return "warning";
		}
	} else {
		return "warning";
	}
}

function testPortAvailability() {
	// Simple test - check if common development ports are free
	// This is a basic check and doesn't guarantee ports are available
	return "warning"; // Always return warning as we can't easily test ports in pure Node.js
}

// Run all tests
function runTests() {
	console.log("");
	console.log("╔══════════════════════════════════════════╗");
	console.log("║         Frontstage Test Suite           ║");
	console.log("║        Validation & Health Check        ║");
	console.log("╚══════════════════════════════════════════╝");
	console.log("");

	log("info", "Starting Frontstage validation tests...");
	console.log("");

	// System requirements
	test("Node.js version compatibility", testNodeVersion);

	// File structure tests
	test("Main launcher files exist", () => testFileExists("launcher.mjs"));
	test("Package.json validity", testPackageJson);
	test("Source code structure", testSourceStructure);
	test("Main program files", testMainFiles);
	test("Development configuration files", testConfigurationFiles);

	// Optional components
	test("GUI interface files", testGUIFiles);
	test("Documentation files", testDocumentation);
	test("Build directory status", testBuildDirectory);

	// Runtime environment
	test("Development ports availability", testPortAvailability);

	// Working directories
	test("Apps directory exists or can be created", () => {
		const appsDir = path.join(__dirname, "apps");
		if (!fs.existsSync(appsDir)) {
			try {
				fs.mkdirSync(appsDir, { recursive: true });
				return true;
			} catch (error) {
				return `Cannot create apps directory: ${error.message}`;
			}
		}
		return true;
	});

	test("Cache directory can be created", () => {
		const cacheDir = path.join(__dirname, ".cache");
		if (!fs.existsSync(cacheDir)) {
			try {
				fs.mkdirSync(cacheDir, { recursive: true });
				return true;
			} catch (error) {
				return `Cannot create cache directory: ${error.message}`;
			}
		}
		return true;
	});

	// Summary
	console.log("");
	console.log("═══════════════════════════════════════════");
	console.log("Test Results Summary:");
	console.log(`  ${colors.green}✓ Passed:  ${testsPassed}${colors.reset}`);
	console.log(`  ${colors.yellow}⚠ Warning: ${testsWarning}${colors.reset}`);
	console.log(`  ${colors.red}✗ Failed:  ${testsFailed}${colors.reset}`);
	console.log("═══════════════════════════════════════════");

	if (testsFailed === 0) {
		if (testsWarning === 0) {
			log("success", "All tests passed! Frontstage is ready to run.");
		} else {
			log("warning", "Tests passed with warnings. Frontstage should work but some features may be limited.");
		}
		console.log("");
		console.log("Next steps:");
		console.log("  1. Run: ./dev.sh start    (for development mode)");
		console.log("  2. Or:   ./setup.sh       (for production setup)");
		console.log("  3. Or:   node launcher.mjs build && node launcher.mjs status");
		console.log("");
		console.log("Note: Frontstage now uses built-in process management instead of PM2");
	} else {
		log("error", "Some tests failed. Please fix the issues above before running Frontstage.");
		console.log("");
		console.log("Quick fixes:");
		if (!testFileExists("package.json")) {
			console.log("  • Run: npm init to create package.json");
		}
		if (!testDirectoryExists("source")) {
			console.log("  • Ensure you are in the correct Frontstage directory");
		}
		if (testsFailed > 2) {
			console.log("  • Consider re-downloading/cloning Frontstage from source");
		}
		console.log("  • Note: PM2 is no longer required - using built-in process management");
		process.exit(1);
	}

	console.log("");
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
	console.log("Frontstage Test Suite");
	console.log("");
	console.log("Usage: node test.mjs [options]");
	console.log("");
	console.log("Options:");
	console.log("  --help, -h     Show this help message");
	console.log("  --quiet, -q    Show only failures");
	console.log("  --version, -v  Show version info");
	console.log("");
	console.log("This script validates the Frontstage installation and");
	console.log("checks that all required files and dependencies are present.");
	process.exit(0);
}

if (process.argv.includes("--version") || process.argv.includes("-v")) {
	try {
		const packageData = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
		console.log(`Frontstage ${packageData.version || "unknown"}`);
		console.log(`Node.js ${process.version}`);
		console.log(`Platform: ${process.platform} ${process.arch}`);
	} catch (error) {
		console.log("Frontstage version unknown (package.json not readable)");
	}
	process.exit(0);
}

// Run the tests
runTests();
