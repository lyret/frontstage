import * as FS from "fs";
import * as Validate from "./_validateConfig";
import * as Parse from "./_parseStateFromConfig";
import * as Cache from "./_cacheState";
import * as Operations from "./_findOperations";

/**
 * Reads the current configuration file, validates it and parses what
 * state the manager should be in and finds what operations need to be
 * performed.
 */
export async function updateManagerState() {
  if (!FS.existsSync(APPS_CONFIG_FILE)) {
    throw new Error(
      "The app configuration file does not exist at " + APPS_CONFIG_FILE
    );
  }
  const contents = FS.readFileSync(APPS_CONFIG_FILE, "utf-8");
  const jsonConfig = Validate.validateAppConfig(contents);
  const nextState = await Parse.parseStateFromAppConfig(jsonConfig);
  const prevState = Cache.cacheManagerState(nextState);
  const operations = Operations.findOperationsFromChangeOfState(
    prevState,
    nextState
  );

  console.log("DELTAS");
  console.log(JSON.stringify(operations, null, 4));

  return operations;
}
