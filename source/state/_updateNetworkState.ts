import * as Checks from "./_networkChecks";

/**
 * Updates and returns the the current network status of the manager
 */
export async function updateNetworkState(): Promise<Manager.NetworkState> {
  const publicIp = await Checks.myPublicIp();
  const internalIps = await Checks.myLocalIps();
  const allIps = [...internalIps, publicIp];

  return {
    publicIp,
    internalIps,
    allIps,
  };
}
