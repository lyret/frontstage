import * as HTTP from "node:http";
import * as DNS from "node:dns";
import * as NET from "node:net";
import * as OS from "node:os";
import { createLogger } from "../messages";

// This file contains utility methods for checking network status of the runtime
// machine and getting related network information

/** Logger */
const logger = createLogger("Network");

/** Runtime cache of the current public ip address */
let cachedPublicIp: string;

/** Runtime cache of the current local ip addresses */
let cachedLocalIps: string[];

/**
 * Returns the primary ip address of the given hostname (domain) according
 * to the A pointer available in the DNS records
 */
export async function nslookup(hostname: string) {
  return new Promise<string>((resolve, reject) => {
    DNS.resolve(hostname, (err, results) => {
      if (err) {
        reject(err);
      } else if (results && !results.length) {
        reject(new Error());
      } else {
        resolve(results[0]);
      }
    });
  });
}

/**
 * Returns the runtime machines public ip address using the
 * service ipify.org
 */
export async function myPublicIp() {
  if (cachedPublicIp) {
    return cachedPublicIp;
  }
  try {
    const ip = await new Promise<string>((resolve, reject) => {
      const client = HTTP.get(
        { host: "api.ipify.org", port: 80, path: "/" },
        (res) => {
          res.on("data", (ip) => {
            cachedPublicIp = String(ip);
            resolve(cachedPublicIp);
          });
          res.on("clientError", (err) => {
            reject(err);
          });
        }
      );
      client.on("error", (err) => {
        reject(err);
      });
    });

    return ip;
  } catch (err) {
    logger.error("Unable to get the public ip address", err);
    return "";
  }
}

/**
 * Returns a list of the runtime machines internal and local ip addresses
 * from its network interfaces
 */
export async function myLocalIps() {
  if (cachedLocalIps) {
    return cachedLocalIps;
  }
  return new Promise<string[]>((resolve) => {
    try {
      const interfaces = OS.networkInterfaces();

      cachedLocalIps = Object.values(interfaces)
        .flat()
        .filter((address) => {
          return address && address.family == "IPv4";
        })
        .map((address) => address!.address);
      resolve(cachedLocalIps);
    } catch (err) {
      logger.error("Unable to get the local ip addresses", err);
      resolve([]);
    }
  });
}

/**
 * Returns whenever a given network port is currently free or not on the runtime machine
 */
export async function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = NET.createServer();

    // Resolve false if the port is in use
    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    // Close the server if listening doesn't fail
    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}
