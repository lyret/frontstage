import * as TLS from "node:tls";
import * as Forge from "node-forge";
import { createLogger, scheduleOperation } from "../messages";
import { generateSelfSignedCertificate } from "./_generateSelfSignedCertificate";
import { requestCertificateFromLetsEncrypt } from "./letsEncrypt";
import { defaultRenewalMethod, getTimeToExpiration } from "./_utilities";
import { Models } from "../database";

/** Logger */
const logger = createLogger("Certificates");

/** In-memory collection of loaded certificates */
const loadedCertificates = new Map<string, Certificates.Certificate>();

/**
 * Returns all stored certificates
 */
export async function list(): Promise<Array<Certificates.StoredCertificate>> {
  const db = await Models.certificates();
  const allCertificates = await db.findAll();
  return allCertificates.map((cert) => cert.toJSON());
}

/**
 * Returns a single loaded certificate, the one already loaded to memory or from the database
 */
export async function load(
  hostname: string
): Promise<Certificates.Certificate | undefined> {
  if (loadedCertificates.has(hostname)) {
    return loadedCertificates.get(hostname);
  } else {
    const model = await Models.certificates();
    const cert = await model.findOne({ where: { hostname } });
    if (cert) {
      return loadCertificate(cert.toJSON());
    }
  }
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
  const db = await Models.certificates();

  // Make sure that the certificate to renew exists
  const existingCertificate = await db.findOne({ where: { hostname } });
  if (!existingCertificate) {
    throw new Error(
      `No certificate exists that can be renewed for the hostname ${hostname}`
    );
  }
  const { renewalMethod, renewWithin } = existingCertificate.toJSON();

  // Calculate the milliseconds to certificates expiration
  const timeToExpiration = getTimeToExpiration(existingCertificate.toJSON());

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
export async function remove(hostname: string): Promise<void> {
  // Remove it from the in memory collection
  loadedCertificates.delete(hostname);

  // Remove it from the database
  const model = await Models.certificates();
  await model.destroy({ where: { hostname } });
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

  // Load the certificate when added and get the
  // expiration date
  const { expiresOn } = loadCertificate({
    hostname,
    certificate,
    privateKey,
    renewalMethod,
    renewWithin,
  });

  // Create or update the certificate in the database
  const db = await Models.certificates();
  await db.upsert({
    hostname,
    certificate,
    expiresOn,
    privateKey,
    renewalMethod,
    renewWithin,
  });
}

/**
 * Utility function that load the secure context
 * from a stored certificate object,
 * adds it to the in-memory map and returns it
 */
function loadCertificate(
  cert: Omit<Certificates.StoredCertificate, "expiresOn">
): Certificates.Certificate {
  // Prevent empty/missing certificates to be loaded
  if (!cert.privateKey || !cert.certificate) {
    throw new Error(
      `Tried to load an empty certificate/key for the hostname (${cert.hostname})`
    );
  }

  // Create the secure context used by the https SNI interface
  const context = TLS.createSecureContext({
    key: cert.privateKey,
    cert: cert.certificate,
    ca: undefined,
  }).context;

  // Use forge to extract the data from the PEM string
  const pki = Forge.pki.certificateFromPem(
    Array.isArray(cert.certificate) ? cert.certificate[0] : cert.certificate
  );

  // Return the loaded certificate
  const loadedCert: Certificates.Certificate = {
    hostname: cert.hostname,
    secureContext: context,
    expiresOn: pki.validity.notAfter,
    renewalMethod: cert.renewalMethod,
    renewWithin: cert.renewWithin,
    commonName: pki.subject.attributes.reduce(
      (current, attribute) =>
        attribute.name === "commonName" ? attribute.value : current,
      null
    ),
  };

  return loadedCert;
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

// FIXME: actively working here
// TODO: Re-add, was run on asset creation
// Add a renewal timer, an intervaled function call to create
// new certificates before the old ones expires
// TODO: should add job to scheduler
// jobs should be unique
async function renewAllLoadedCertificates() {
  logger.info("Checking for certificates that needs to be renewed");

  // Remember the shortest expiration time among loaded certificates
  let shortestTimeToExpiration = ONE_MONTH;

  // Iterate over all loaded certificates and tries to renew them
  for (const certificate of loadedCertificates.values()) {
    const timeToExpiration = getTimeToExpiration(certificate);

    // If the certificate is not due to be renewed, do not renew it - but keep the time left to expiration
    if (timeToExpiration > 0) {
      shortestTimeToExpiration = Math.max(
        5000,
        Math.min(timeToExpiration, shortestTimeToExpiration)
      );
    }
    await renew(certificate.hostname);
    // FIXME: pure test code
    scheduleOperation<Messages.ScheduledCertificateRenewal>({
      timestamp: Date.now() + timeToExpiration,
      id: certificate.hostname,
      hostname: certificate.hostname,
    });
  }

  return shortestTimeToExpiration;
}
