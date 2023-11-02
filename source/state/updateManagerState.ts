import { parseStateFromAppConfig } from "./_parseStateFromConfig";
import * as Cache from "./_cacheState";
import * as Operations from "./_findOperations";
import * as Network from "./_updateNetworkState";

/**
 * Reads the current configuration file, validates it and parses what
 * state the manager should be in and finds what operations need to be
 * performed.
 */
export async function updateManagerState(): Promise<Manager.State> {
  // Determine the new and previous state of the application configuration
  const applicationConfig: Array<Configuration.Application> = null as any; // FIXME: moved to reload
  const nextAppState = await parseStateFromAppConfig(applicationConfig);
  // TODO: what should be keept in internal processes
  // make a general function for determing state from other sources
  // than app config - like changes in build number and pm2 status
  // nextAppState.internalProcesses = await determineInternalProccessesToRun(
  //   nextAppState
  // );
  const prevAppState = Cache.cacheManagerState(nextAppState);

  // Find out what operations needs to be performed
  const operations = await Operations.findOperationsFromChangeOfState(
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
