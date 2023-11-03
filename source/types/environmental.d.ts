/*
 * Defines global environmental variables that are always available
 */
declare global {
  // BUILD

  /** Unique build number generated for each build */
  var BUILD_NUMBER: number;

  // PATHS

  /** The path to the manager configuration file */
  var MANAGER_CONFIG_FILE: string;

  /** The path to the application configuration file */
  var APPS_CONFIG_FILE: string;

  /** The path to the source code directory*/
  var SOURCE_DIRECTORY: string;

  /** The path to the executable transpiled code directory*/
  var BIN_DIRECTORY: string;

  /** The path to the database directory */
  var DATABASE_DIRECTORY: string;

  /** The path to the cache and temporary files directory */
  var CACHE_DIRECTORY: string;

  // PROCESSES

  /** Daemon namespace for internal processes */
  var APP_DAEMON_NAMESPACE: string;

  /** Daemon namespace for application processes */
  var MANAGER_DAEMON_NAMESPACE: string;

  // OTHER CONSTANTS

  /** One hour in milliseconds */
  var ONE_HOUR: number;

  /** One day in milliseconds */
  var ONE_DAY: number;

  /** One month in milliseconds */
  var ONE_MONTH: number;

  /** Three months in milliseconds */
  var THREE_MONTHS: number;
}

export {};
