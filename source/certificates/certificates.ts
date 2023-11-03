import * as TLS from "node:tls";
import * as Forge from "node-forge";
import { createLogger, scheduleOperation } from "../messages";
import { generateSelfSignedCertificate } from "./_generateSelfSignedCertificate";
import { requestCertificateFromLetsEncrypt } from "./letsEncrypt";
import { Models } from "../database";
import { State } from "../state";

/** Logger */
const logger = createLogger("Certificates");

/** In-memory collection of loaded certificates */
const loadedCertificates = new Map<string, Certificates.LoadedCertificate>();

/**
 * Returns all stored certificates
 */
export async function list(): Promise<Array<Certificates.StoredCertificate>> {
  const db = await Models.Certificates();
  const allCertificates = await db.findAll();
  return allCertificates.map((cert) => cert.toJSON());
}

/**
 * Returns a single loaded certificate, the one already loaded to memory or from the database
 */
export async function load(
  hostname: string
): Promise<Certificates.LoadedCertificate | undefined> {
  if (loadedCertificates.has(hostname)) {
    return loadedCertificates.get(hostname);
  } else {
    const model = await Models.Certificates();
    const cert = await model.findOne({ where: { hostname } });
    if (cert) {
      return loadCertificate(cert.toJSON());
    }
  }
}

/**
 * Perform operations on public hostnames
 * Makes sure that certificates exists for all unique hostnames
 */
export async function performOperations(
  operations: State.Operations["certificates"]
) {
  const db = await Models.Certificates();

  // Destroy all removed entries
  for (const entry of operations.removed) {
    await removeCertificate(entry.hostname);
    logger.warn(`Removed the certificate for the hostname ${entry.hostname}`);
  }

  // Update all moved entries
  for (const entry of operations.moved) {
    await db.update(entry, { where: { hostname: entry.hostname } });
    logger.success(
      `Updated the certificate configuration for ${entry.hostname}`
    );
  }

  // Add new entries
  for (const entry of operations.added) {
    try {
      await addCertificate(entry.hostname, entry.label, entry.renewalMethod);
      logger.success(`Added a new certificate for ${entry.hostname}`);
    } catch (err) {
      logger.error(
        `Failed to add a new certificate for ${entry.hostname}`,
        err
      );
    }
  }
}

/**
 * Renews all certificates that are due for renewal
 * and schedules a new renewal operation at the
 */
export async function performCertificationRenewal() {
  logger.info("Checking for certificates that needs to be renewed");

  // Find all certificates in the database
  const db = await Models.Certificates();
  const certificates = await db.findAll();

  // Remember the shortest expiration time among loaded certificates
  let shortestTimeToExpiration = ONE_MONTH;

  // Iterate over all loaded certificates and tries to renew them
  for (const certificate of certificates) {
    const timeToExpiration = getTimeToExpiration(certificate.toJSON());

    // If the certificate is not due to be renewed, do not renew it - but keep the time left to expiration
    if (timeToExpiration > 0) {
      shortestTimeToExpiration = Math.max(
        5000,
        Math.min(timeToExpiration, shortestTimeToExpiration)
      );
    }
    // Otherwise renew it now
    else {
      await renewCertificate(certificate.toJSON());
    }
  }

  // Schedule a new certificate renewal in the scheduler process
  await scheduleOperation<Messages.ScheduledCertificateRenewal>({
    id: "certificate-renewal",
    timestamp: Date.now() + shortestTimeToExpiration,
  });
  logger.success("Renewed all certificates that was due of renewal");
}

/**
 * Adds a new certificate
 */
async function addCertificate(
  hostname: string,
  label: string,
  renewalMethod?: Certificates.LoadedCertificate["renewalMethod"],
  renewWithin?: Certificates.LoadedCertificate["renewWithin"]
): Promise<void> {
  // Can't add an already existing certificate
  const existingCertificate = await load(hostname);
  if (existingCertificate) {
    throw new Error(
      `Can't add a certificate for the hostname ${hostname} as its already exist`
    );
  }

  // Add it using the internal function
  await addOrRenewCertificate(hostname, label, renewalMethod, renewWithin);
}

/**
 * If found deletes the certificate for the given hostname completely
 */
async function removeCertificate(hostname: string): Promise<void> {
  // Remove it from the in memory collection if it exists
  loadedCertificates.delete(hostname);

  // Remove it from the database
  const model = await Models.Certificates();
  await model.destroy({ where: { hostname } });
}

/**
 * Utility function that load the secure context
 * from a stored certificate object,
 * adds it to the in-memory map and returns it
 */
function loadCertificate(
  cert: Omit<Certificates.StoredCertificate, "expiresOn">
): Certificates.LoadedCertificate {
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
  const loadedCert: Certificates.LoadedCertificate = {
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

/**
 * Renews an existing certificate for the given hostname, with several tries. Optionally the renewal can be forced to run even before the
 existing certificate expires
 */
async function renewCertificate(
  certificate: Certificates.StoredCertificate,
  forceRenewal: boolean = false,
  numberOfTries: number = 5
): Promise<void> {
  const { hostname, label, renewalMethod, renewWithin } = certificate;

  // Calculate the milliseconds to certificates expiration
  const timeToExpiration = getTimeToExpiration(certificate);

  // Stop if the certificate is not due to be renewed, and the renewal is not forced
  if (timeToExpiration > 0 && !forceRenewal) {
    logger.trace(`The certificate for ${hostname} is not in need of renewal`);
    return;
  }

  // Renewal the certificate
  logger.info(`Renewing the certificate for "${hostname}..."`);

  try {
    await addOrRenewCertificate(hostname, label, renewalMethod, renewWithin);
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
          await renewCertificate(certificate, forceRenewal, numberOfTries - 1);
          resolve();
        }, 5000)
      );
    } else {
      logger.error(
        `Failed to generate a certificate for the hostname ${hostname}, no more retries`,
        err
      );
      return;
    }
  }
}

/**
 * Utility function used to request or generate the certificate
 * both when adding and renewing it
 */
async function addOrRenewCertificate(
  hostname: string,
  label: string,
  renewalMethod?: Certificates.LoadedCertificate["renewalMethod"],
  renewWithin?: Certificates.LoadedCertificate["renewWithin"]
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
    label,
    certificate,
    privateKey,
    renewalMethod,
    renewWithin,
  });

  // Create or update the certificate in the database
  const db = await Models.Certificates();
  await db.upsert({
    hostname,
    label,
    certificate,
    expiresOn,
    privateKey,
    renewalMethod,
    renewWithin,
  });
}

/** utility function to get the default renewal method to use in the current environment */
function defaultRenewalMethod(): Certificates.LoadedCertificate["renewalMethod"] {
  if (State.Manager.certificates.lets_encrypt) {
    return "lets-encrypt";
  }
  return "self-signed";
}

/**
 * Utility function to calculate the time to
 * when the given certificate should be renewed
 * before becoming invalid
 */
function getTimeToExpiration(
  certificate: Certificates.StoredCertificate | Certificates.LoadedCertificate
): number {
  return certificate.expiresOn
    ? certificate.expiresOn.valueOf() - Date.now() - certificate.renewWithin
    : 0;
}
