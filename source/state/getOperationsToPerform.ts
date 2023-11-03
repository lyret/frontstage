import { getConfiguration } from "../messages";
import { findApplicationProccessesOperations } from "./_findApplicationProcessesOperations";
import { findChangeBetweenStateAndConfiguration } from "./_findChangeBetweenStateAndConfiguration";
import { findInternalProccessesOperations } from "./_findInternalProccessesOperations";
import { getCurrentRuntimeInformation } from "./getCurrentRuntimeInformation";
import { parseConfigurationOptions } from "./_parseConfigurationOptions";

/**
 * Reads the current configurations from the database and compares
 * it to the current runtime information to determine what
 * operations should be performed to get them to match.
 */
export async function getOperationsToPerform(): Promise<State.Operations> {
  // Read configurations from the database
  const managerConf = await getConfiguration("manager_configuration");
  const applicationsConf = await getConfiguration("application_configuration");
  const networkConf = await getConfiguration("network_configuration");

  if (!managerConf) {
    throw new Error(
      "Failed to determine operations to perform as no manager configuration exists"
    );
  }

  if (!applicationsConf) {
    throw new Error(
      "Failed to determine operations to perform as no applications configuration exists"
    );
  }

  if (!networkConf) {
    throw new Error(
      "Failed to determine operations to perform as no applications configuration exists"
    );
  }

  // Get the current runtime information
  const runtimeInformation = await getCurrentRuntimeInformation();

  // Get the options from the configurations
  const configuredOptions = await parseConfigurationOptions(
    managerConf,
    applicationsConf
  );

  // Determine and return the operations to perform
  return {
    redirections: findChangeBetweenStateAndConfiguration(
      "redirects",
      runtimeInformation,
      configuredOptions
    ),
    internalRoutes: findChangeBetweenStateAndConfiguration(
      "internalRoutes",
      runtimeInformation,
      configuredOptions
    ),
    certificates: findChangeBetweenStateAndConfiguration(
      "certificates",
      runtimeInformation,
      configuredOptions
    ),
    internalProcesses: await findInternalProccessesOperations(
      runtimeInformation
    ),
    applicationProcesses: await findApplicationProccessesOperations(
      runtimeInformation,
      configuredOptions
    ),
  };
}
