import * as FS from "fs";
import * as Validator from "./_validateYaml";
import * as Parser from "./_parseConfig";

/**
 * Reads, validates and parses the app configuration from file
 */
export async function readAppConfig() {
  if (!FS.existsSync(APPS_CONFIG_FILE)) {
    throw new Error(
      "The app configuration file does not exist at " + APPS_CONFIG_FILE
    );
  }
  const contents = FS.readFileSync(APPS_CONFIG_FILE, "utf-8");
  const jsonConfig = Validator.validateAppConfig(contents);
  return Parser.parseAppConfig(jsonConfig);
}
