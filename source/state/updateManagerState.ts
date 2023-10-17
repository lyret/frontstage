import * as FS from "fs";
import * as Validate from "./_validateAppConfig";
import * as Parse from "./_parseStateFromConfig";
import * as Cache from "./_cacheState";
import * as Operations from "./_findOperations";
import * as Network from "./_updateNetworkState";

/**
 * Reads the current configuration file, validates it and parses what
 * state the manager should be in and finds what operations need to be
 * performed.
 */
export async function updateManagerState(): Promise<Manager.State> {
  // Read the current application configuration file
  if (!FS.existsSync(APPS_CONFIG_FILE)) {
    throw new Error(
      "The app configuration file does not exist at " + APPS_CONFIG_FILE
    );
  }
  const contents = FS.readFileSync(APPS_CONFIG_FILE, "utf-8");

  // Determine the new and previous state of the application configuration
  const jsonConfig = Validate.validateAppConfig(contents);
  const nextAppState = await Parse.parseStateFromAppConfig(jsonConfig);
  const prevAppState = Cache.cacheManagerState(nextAppState);

  // Find out what operations needs to be performed
  const operations = Operations.findOperationsFromChangeOfState(
    prevAppState,
    nextAppState
  );

  // Find out the current network status
  const network = await Network.updateNetworkState();

  // Return the updated state
  return {
    ...nextAppState,
    network,
    operations,
  };
}
