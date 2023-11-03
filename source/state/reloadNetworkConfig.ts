import * as Checks from "./_networkChecks";
import { updateConfiguration } from "../messages";

/**
 * Reloads the network configuration from the current runtime
 * machine status and updates it in the database
 */
export async function reloadNetworkConfig(): Promise<void> {
  const publicIp = await Checks.myPublicIp();
  const internalIps = await Checks.myLocalIps();
  const allIps = [...internalIps, publicIp];

  // Update the configuration state in the database and message running internal processes
  await updateConfiguration("network_configuration", {
    publicIp,
    internalIps,
    allIps,
  });
}
