import * as Path from "node:path";
import * as TLS from "node:tls";
import * as Forge from "node-forge";
import * as FSE from "fs-extra";
import { normalizeName } from "./_utilities";
import { createLogger } from "../statistics";

/** Logger */
const logger = createLogger("Certificates");

/**
 * Create a certificate object from the given options object
 * (same as a cached certificate), also adds the given certificate
 * information to the file system cache
 */
export function createCertificate(
  cert: Certificates.CachedCertificate
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

  // Add the PEM files to the file system cache
  try {
    const pathName = normalizeName(cert.hostname);

    // Store the given certificate information in the cache
    const cachedFilePath = Path.join(
      CERTIFICATES_DIRECTORY,
      `${pathName}.json`
    );

    FSE.ensureFileSync(cachedFilePath);
    FSE.writeFile(cachedFilePath, JSON.stringify(cert), {
      encoding: "utf-8",
    });

    logger.trace(`Cached the certificate of hostname ${cert.hostname}`);
  } catch (err) {
    logger.error(
      `Failed to cache the certificate for the hostname ${cert.hostname}`,
      err
    );
  }

  // Return the certificate
  return {
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
}
