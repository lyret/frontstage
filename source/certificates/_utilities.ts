/** Helper function to get the default renewal method to use in the current environment */
export function defaultRenewalMethod(): Certificates.Certificate["renewalMethod"] {
  if (LETS_ENCRYPT_CERTIFICATES_ENABLED) {
    return "lets-encrypt";
  }
  return "self-signed";
}

/**
 * Helper function to calculate the time to
 * when the given certificate should be renewed
 * before becoming invalid
 */
export function getTimeToExpiration(
  certificate: Certificates.StoredCertificate | Certificates.Certificate
): number {
  return certificate.expiresOn
    ? certificate.expiresOn.valueOf() - Date.now() - certificate.renewWithin
    : 0;
}
