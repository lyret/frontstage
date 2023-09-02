/** Helper function to turn a hostname string used for filenames in the cache */
export function normalizeName(hostname: string): string {
  return hostname.replace(/\./g, "_");
}

/** Helper function to get the default renewal method to use in the current environment */
export function defaultRenewalMethod(): Certificates.Certificate["renewalMethod"] {
  if (LETS_ENCRYPT_CERTIFICATES_ENABLED) {
    return "lets-encrypt";
  }
  return "self-signed";
}
