import * as Path from "node:path";
import * as FSE from "fs-extra";
import * as Output from "../output";
import { generateSelfSignedCertificate } from "./_generateSelfSignedCertificate";
import { requestCertificateFromLetsEncrypt } from "./letsEncrypt";
import { createCertificate } from "./_createCertificate";
import { normalizeName, defaultRenewalMethod } from "./_utilities";

/** Logger */
const logger = Output.createLogger("Certificates");

/** In-memory collection of loaded certificates */
const loadedCertificates = new Map<string, Certificates.Certificate>();

/**
 * Returns all loaded certificates
 */
export function list() {
  return Array.from(loadedCertificates.values());
}

/**
 * Get a single certificate currently loaded in memory, if it exists
 */
export function find(hostname: string): Certificates.Certificate | undefined {
  return loadedCertificates.get(hostname);
}

/**
 * Renews an existing certificate for the given hostname, with several tries. Optionally the renewal can be forced to run even before the
 * existing certificate expires
 */
export async function renew(
  hostname: string,
  forceRenewal: boolean = false,
  numberOfTries: number = 5
): Promise<void> {
  // Make sure that the certificate to renew exists
  const loadedCertificate = loadedCertificates.get(hostname);
  if (!loadedCertificate) {
    throw new Error(
      `No certificate exists that can be renewed for the hostname ${hostname}`
    );
  }
  const { expiresOn, renewalMethod, renewWithin } = loadedCertificate;

  // Calculate the milliseconds to certificates expiration
  let initialNow = Date.now();
  let timeToExpiration = expiresOn
    ? expiresOn.valueOf() - initialNow - renewWithin
    : 0;

  // Stop if the certificate is not due to be renewed, and the renewal is not forced
  if (timeToExpiration > 0 && !forceRenewal) {
    logger.trace(`The certificate for ${hostname} is not in need of renewal`);
    return;
  }

  // Renewal the certificate
  logger.info(`Renewing the certificate for "${hostname}..."`);

  try {
    await addOrRenewCertificate(hostname, renewalMethod, renewWithin);
  } catch (err) {
    // Retry the same renewal until the number of tries reaches zero
    if (numberOfTries >= 0) {
      logger.warn(
        `Unable to renew the certificate for hostname ${hostname}, retries left: ${
          numberOfTries - 1
        }`,
        err
      );
      return new Promise((resolve) =>
        setTimeout(async () => {
          await renew(hostname, forceRenewal, numberOfTries - 1);
          resolve();
        }, 5000)
      );
    } else {
      logger.error(
        `Failed to generate a certificate for the hostname ${hostname}, no more retries`,
        err
      );
      throw err;
    }
  }
}

/**
 * Adds a new certificate
 *
 * @param hostname The hostname to create the certificate for
 * @param renewalMethod The type of certificate to generate or request
 * @param renewWithin The time in milliseconds before expiration that the certificate should be renewed
 */
export async function add(
  hostname: string,
  renewalMethod?: Certificates.Certificate["renewalMethod"],
  renewWithin?: Certificates.Certificate["renewWithin"]
): Promise<void> {
  // Can't add an already existing certificate
  if (!loadedCertificates.has(hostname)) {
    throw new Error(
      `Can't add a certificate for the hostname ${hostname} as its already exist`
    );
  }

  // Add it using the internal function
  await addOrRenewCertificate(hostname, renewalMethod, renewWithin);
}

/**
 * If found deletes the certificate for the given hostname completely
 */
export function remove(hostname: string): void {
  // Remove it from the in memory collection
  loadedCertificates.delete(hostname);

  // Remove it from the cache
  const cacheFilePath = Path.join(
    CERTIFICATES_DIRECTORY,
    `${normalizeName(hostname)}.json`
  );
  if (FSE.existsSync(cacheFilePath)) {
    FSE.removeSync(cacheFilePath);
  }
}

/**
 * Loads all the certificates from the cache to the in memory collection
 * Should be called once during initialisation
 */
export function bootstrap(): void {
  FSE.readdirSync(CERTIFICATES_DIRECTORY)
    .filter((v) => v.split(".")[0].split("-")[1] == "crt")
    .map((v) => v.split("-")[0].replace(/\_/g, "."))
    .map((hostname) => readCertificateFromFileSystem(hostname))
    .filter((cert) => !!cert)
    .forEach((cert) => {
      if (cert) {
        loadedCertificates.set(cert.hostname, cert);
      }
    });
}

/**
 * Utility function used to request or generate the certificate
 * both when adding and renewing it
 */
async function addOrRenewCertificate(
  hostname: string,
  renewalMethod?: Certificates.Certificate["renewalMethod"],
  renewWithin?: Certificates.Certificate["renewWithin"]
) {
  // Determine the renewal method to use and that we do not override
  // the one given as an option
  renewalMethod = renewalMethod || "default";
  const renewalMethodToUse =
    renewalMethod == "default" ? defaultRenewalMethod() : renewalMethod;

  // Make sure that renewWithin is set
  // Renew one day before expiration by default
  renewWithin = renewWithin || ONE_MONTH;

  // Request or generate a certificate depending on
  // the renewal method to use
  let certificate = "";
  let privateKey = "";
  if (renewalMethodToUse == "lets-encrypt") {
    [certificate, privateKey] = await requestCertificateFromLetsEncrypt(
      hostname
    );
  } else if (renewalMethodToUse == "self-signed") {
    [certificate, privateKey] = generateSelfSignedCertificate(hostname);
  }

  // Fail if no certificate and private key pair was generated
  if (!certificate || !privateKey) {
    throw new Error(
      `Unable to create a certificate for the hostname ${hostname} using the renewal method ${renewalMethod}`
    );
  }

  // Create and cache the certificate
  const cert = createCertificate({
    hostname,
    certificate,
    privateKey,
    renewalMethod,
    renewWithin,
  });

  // Add it to the in-memory collection
  loadedCertificates.set(hostname, cert);
}

/**
 * Utility function for loading a single certificate from the file system, if it exists
 */
function readCertificateFromFileSystem(
  hostname: string
): Certificates.Certificate | undefined {
  try {
    logger.trace("Checking for any existing certificate on file");

    const cacheFilePath = Path.join(
      CERTIFICATES_DIRECTORY,
      `${normalizeName(hostname)}.json`
    );

    if (!FSE.existsSync(cacheFilePath)) {
      logger.trace(
        `Unable to find certificates on file for hostname ${hostname}`
      );
      return undefined;
    }

    const cacheFile: Certificates.CachedCertificate = JSON.parse(
      FSE.readFileSync(cacheFilePath, {
        encoding: "utf-8",
        flag: "r",
      })
    );

    logger.trace(`Found and loaded cached certificate of hostname ${hostname}`);

    return createCertificate(cacheFile);
  } catch (err) {
    logger.error(
      `Failed to load a certificate from the filesystem for hostname ${hostname}`,
      err
    );
    return undefined;
  }
}

// TODO: Old, move to daemon
// If a certificate for the hostname already exists,
// tryadd or renew the certificate with 5 tries, do not force it
//ensure: (hostname: string, renewalMethod: Certificate["metadata"]["renewalMethod"]) => Promise<void>;
// ensure: async (hostname, renewalMethod) => {
//   if (!_map.exists(hostname)) {
//     logger.trace(`Adding or renewing a certificate for hostname: ${hostname}`);
//     await _addOrRenewCertificate(hostname, renewalMethod, false, 5);
//   }
// },

// TODO: Re-add, was run on asset creation
// Add a renewal timer, an intervaled function call to create
// new certificates before the old ones expires
// const _renewalTimer = ScheduledFunction({
//   milliseconds: ONE_HOUR,
//   callback: async () => {
//     logger.info("Checking for certificates that needs renewals");
//
//     // Keep the datetime for when the renewal function runs
//     const initialNow = Date.now();
//
//     // Remember the shortest expiration time among loaded certificates
//     let shortestTimeToExpiration = ONE_MONTH;
//
//     // Iterate over all loaded certificates
//     for (const {
//       expiresOn,
//       metadata: { renewalMethod, hostname, renewWithin },
//     } of _map.values()) {
//       // Calculate the milliseconds to certificates expiration
//       let timeToExpiration = expiresOn
//         ? expiresOn.valueOf() - initialNow - renewWithin
//         : 0;
//
//       // If the certificate is not due to be renewed, do not renew it - but keep the time
//       // left to expiration
//       if (timeToExpiration > 0) {
//         shortestTimeToExpiration = Math.max(
//           5000,
//           Math.min(timeToExpiration, shortestTimeToExpiration)
//         );
//         logger.trace(
//           `The certificate for "${hostname}" is not in need of renewal`,
//           { timeToExpiration, expiresOn }
//         );
//         continue;
//       }
//
//       // Force a renewal of the certificate with the 5 retries
//       logger.info(`Renewing the certificate for "${hostname}"`, {
//         timeToExpiration,
//         expiresOn,
//       });
//       await _addOrRenewCertificate(hostname, renewalMethod, true, 5);
//     }
//
//     // Recreate the timer
//     logger.info(
//       `The next renewal check will be run in ${Math.round(
//         shortestTimeToExpiration / 1000 / 60 / 60 / 24
//       )} days`,
//       { shortestTimeToExpiration }
//     );
//     _renewalTimer.reset(shortestTimeToExpiration);
//   },
// });
