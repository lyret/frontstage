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
