import * as Forge from "node-forge";
import { createLogger } from "../messages";
import { State } from "../state";

/** Logger */
const logger = createLogger("Self Signed Certificate");

/**
 * Generats a self-signed certificate with the globally defined options
 * and returns it
 */
export function generateSelfSignedCertificate(
  hostname: string
): [certificate: string, privateKey: string] {
  // Make sure that self-signed certificates are enabled and that the necessary information is set
  if (!State.Manager.certificates.self_signed_certificates) {
    logger.error("Not enabled, can't generate certificate");
    throw new Error("Self signed certificates are not enabled");
  } else if (
    !State.Manager.certificates.self_signed_certificates.country ||
    !State.Manager.certificates.self_signed_certificates.state ||
    !State.Manager.certificates.self_signed_certificates.locality ||
    !State.Manager.certificates.self_signed_certificates.organization
  ) {
    logger.error("Missing neccesary information for generating certificate");
    throw new Error("Self signed certificates information is missing");
  } else {
    logger.info("Generating a self signed certificate for " + hostname);
  }

  // Generate key pair
  const keys = Forge.pki.rsa.generateKeyPair(2048);

  // Create certificate attributes
  const attributes = [
    {
      name: "commonName",
      value: hostname,
    },
    {
      name: "countryName",
      value: State.Manager.certificates.self_signed_certificates.country,
    },
    {
      shortName: "ST",
      value: State.Manager.certificates.self_signed_certificates.state,
    },
    {
      name: "localityName",
      value: State.Manager.certificates.self_signed_certificates.locality,
    },
    {
      name: "organizationName",
      value: State.Manager.certificates.self_signed_certificates.organization,
    },
    {
      shortName: "OU",
      value: State.Manager.certificates.self_signed_certificates.organization,
    },
  ];

  // Create certificate extensions
  const extensions = [
    {
      name: "basicConstraints",
      cA: true,
    },
    {
      name: "keyUsage",
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: "extKeyUsage",
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true,
    },
    {
      name: "nsCertType",
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true,
    },
    {
      name: "subjectAltName",
      altNames: [
        {
          type: 6, // URI
          value: `http://${hostname}`,
        },
        {
          type: 7, // IP
          ip: "127.0.0.1",
        },
      ],
    },
    {
      name: "subjectKeyIdentifier",
    },
  ];

  // Generate the certificate
  const certificate = Forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date();
  certificate.validity.notAfter = new Date(new Date().valueOf() + THREE_MONTHS);
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.setExtensions(extensions);

  // Sign certificate using the key (self-sign)
  certificate.sign(keys.privateKey);

  // Format the Keys and certificate in the PEM format
  const pem = {
    privateKey: Forge.pki.privateKeyToPem(keys.privateKey),
    publicKey: Forge.pki.publicKeyToPem(keys.publicKey),
    certificate: Forge.pki.certificateToPem(certificate),
  };

  // Return the certificate
  logger.success("Done! Created a self signed certificate for " + hostname);
  return [pem.certificate, pem.privateKey];
}
