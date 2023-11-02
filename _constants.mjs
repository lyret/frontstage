// SERVER MANAGER CONSTANTS
// This file exports constants variables that are available globally
// in the source code for readability and convenience, they
// are defined for typescript in environmental.d.ts and defined
// when running esbuild

// Export the constants object
export let constants = {};

// Add constants for getting readable durations as milliseconds

/** One hour in milliseconds */
constants["ONE_HOUR"] = 60 * 60 * 1000;

/** One day in milliseconds */
constants["ONE_DAY"] = constants["ONE_HOUR"] * 24;

/** One month in milliseconds */
constants["ONE_MONTH"] = constants["ONE_DAY"] * 30;

/** Three months in milliseconds */
constants["THREE_MONTHS"] = constants["ONE_MONTH"] * 3;

// Add constants to reusable paths within the source directory

/** Path to the yaml file containing the current server manager configuration */
constants["MANAGER_CONFIG_FILE"] = "./configuration.yaml";

/** Path to the yaml file containing the configuration for application */
constants["APPS_CONFIG_FILE"] = "./applications.yaml";

/** Path to the directory containing the transpiled and executable manager code */
constants["BIN_DIRECTORY"] = "./.bin";

/** Path to the directory containing the database */
constants["DATABASE_DIRECTORY"] = "./.database";

/** Path to the directory containing any cache and temporary files */
constants["CACHE_DIRECTORY"] = "./.cache";
