import * as TLS from 'tls';
import * as Forge from 'node-forge';
import { InMemoryCollection, FileDirectoryCollection } from '../storage';
import { ONE_MONTH, ONE_HOUR, ScheduledFunction } from '../datetime';
import { PATH_TO_CERTIFICATES } from '../config/settings';
import { Logger } from '../logging';


/**
 * TODO: Document
 */
type Certificate = {
  /** The context object used for https transport */
  secureContext: TLS.SecureContext
  /** The datetime for the expiration of this certificates validity */
  expiresOn: Date
  /** The common name of the certificate */
  commonName: string
  /** Additional information about the certificate to allows for automatic renewals */
  metadata: {
    /** Hostname this certificate is valid for */
    hostname: string
    /** Method used to renew this certificate */
    renewalMethod?: (hostname: string) => Promise < [privateKey: string, certificate: string] >
    /** The time in milliseconds, before expiration that the certificate should be renewed */
    renewWithin: number
  }
}

/**
 * TODO: Document
 */
interface CertificateAsset {
  // If a certificate for the hostname already exists,
  // tryadd or renew the certificate with 5 tries, do not force it
  ensure: (hostname: string, renewalMethod: Certificate['metadata']['renewalMethod']) => Promise<void>
  /** Adds a certificate if one does not already exist */
  //add: (hostname: string, secureContext: TLS.SecureContext) => void
  // add: (
  // hostname: string,
  // renewalMethod: (hostname: string) => Promise < [privateKey: string, certificate: string] > ,
  // options?: {
  //   expiresOn: Date,
  //   forceRenewal ? : boolean,
  //   renewWithin ? : number
  // }) => void
  /** Update a certificate if it exists */
  // PRIVATE: update: (hostname: string, secureContext: TLS.SecureContext) => void
  /** Remove a certificate from the table */
  remove: (hostname: string) => void
  /** Gets the certificate info for the given hostname if it exists */
  get: (hostname: string) => Certificate | undefined
  /** TODO: Gets the certificate info for the given hostname if it exists */
  //getInfo: (hostname: string) => CertificateInfo | undefined
}

export const Certificates: AssetGeneratorWithoutOptions < CertificateAsset > = () => {

  // Add a logger
  const _logger = Logger({ name: "Certificates" });

  // Add a collection of certificate information loaded in memory
  const _map = InMemoryCollection < string,
    Certificate > ();

  // Add a store of certifacte pem files in the file system
  const _pemStorage = FileDirectoryCollection({ path: PATH_TO_CERTIFICATES });

  // Add a renewal timer, an intervaled function call to create
  // new certificates before the old ones expires
  const _renewalTimer = ScheduledFunction({
    milliseconds: ONE_HOUR,
    callback: async () => {
      _logger.info("Checking for certificates that needs renewals");
      
      // Keep the datetime for when the renewal function runs
      const initialNow = Date.now();

      // Remember the shortest expiration time among loaded certificates
      let shortestTimeToExpiration = ONE_MONTH;

      // Iterate over all loaded certificates
      for (const { expiresOn, metadata: { renewalMethod, hostname, renewWithin } } of _map.values()) {

        // Calculate the milliseconds to certificates expiration
        let timeToExpiration = expiresOn ? expiresOn.valueOf() - initialNow - renewWithin : 0

        // If the certificate is not due to be renewed, do not renew it - but keep the time
        // left to expiration
        if (timeToExpiration > 0) {
          shortestTimeToExpiration = Math.max(5000, Math.min(timeToExpiration, shortestTimeToExpiration));
          _logger.trace(`The certificate for "${hostname}" is not in need of renewal`, { timeToExpiration, expiresOn });
          continue;
        }

        // Force a renewal of the certificate with the 5 retries
        _logger.info(`Renewing the certificate for "${hostname}"`, { timeToExpiration, expiresOn });
        await _addOrRenewCertificate(hostname, renewalMethod, true, 5);
      }

      // Recreate the timer
      _logger.info(`The next renewal check will be run in ${Math.round(shortestTimeToExpiration/1000/60/60/24)} days`, { shortestTimeToExpiration });
      _renewalTimer.reset(shortestTimeToExpiration);
    }
  });
  
  /**
   * TODO: Document
   */
  const _addOrRenewCertificate = async (
    hostname: string,
    renewalMethod: Certificate['metadata']['renewalMethod'] | undefined,
    forceRenewal: boolean,
    numberOfTries: number): Promise < void > => {

    // Can't add an aldready existing certificate, unless we are forcing a new certificate
    if (!forceRenewal && _map.exists(hostname)) {
      throw new Error(`Can't add a certificate for the hostname (${hostname}) as its already exist`);
    }

    // Create the metadata object for the certificate to add
    const metadata: Certificate['metadata'] = {
      renewWithin: ONE_MONTH, // Renew one month before expiration by default
      hostname,
      renewalMethod
    }

    // Check if the certificate can be loaded from the filesystem, and is not forced to be renewed
    // make sure the renewal method will run shortly in case its neccessary and an old certificate was loaded
    if (!forceRenewal && _loadCertificateFromFileSystem(hostname, metadata)) {
      _renewalTimer.reset(5000);
    }
    // Otherwise call the renewal method to generate a certificate
    else if (renewalMethod) {
      try {
        const [privateKey, certificate] = await renewalMethod(hostname)
        const { secureContext, commonName, expiresOn } = createCertificateFromStrings(hostname, privateKey, certificate);

        // On success, save the certificate in the file system and also the in-memory collection
        _saveCertificateToFilesystem(hostname, privateKey.toString(), certificate);

        _map.set(hostname, {
          commonName,
          expiresOn,
          secureContext,
          metadata
        });

      } catch (err) {
        
        // Retry the same method until the number of tries reaches zero
        if (numberOfTries >= 0) {
          _logger.warn(`Certificate generation for hostname ${hostname} failed, retries left: ${numberOfTries-1}`, err);
          return new Promise(resolve => setTimeout(async () => {
            await _addOrRenewCertificate(hostname, renewalMethod, forceRenewal, numberOfTries - 1);
            resolve();
          }, 5000));
        } else {
          _logger.error(`Failed to generate a certificate for the hostname ${hostname}`, err);
        }
      }
    }
    else {
      _logger.warn(`Unable to load add a certificate for hostname ${hostname}, and no renewal method was given`);
    }
  }

  /** Loads a certificate to the in-memory collection from the file system, if it exists */
  const _loadCertificateFromFileSystem = (hostname: string, metadata: Certificate['metadata']): boolean => {
    try {
      const pathname = hostname.replace(/\./g, '_').replace(/\*/g, '')
      
      _logger.trace("Checking for any existing certificate on file", { hostname, pathname });

      const privateKey = _pemStorage.get(`${pathname}-key.pem`) || '';
      const certificate = _pemStorage.get(`${pathname}-crt.pem`) || '';
      const ca = _pemStorage.get(`${pathname}-ca.pem`) || '';

      if (!privateKey || !certificate) {
        _logger.trace("Unable to find certificates on file for hostname ${hostname}", { lengthOfCertificate: certificate.length, lengthOfPrivateKey: privateKey.length });
        return false;
      }

      const { commonName, expiresOn, secureContext } = createCertificateFromStrings(hostname, privateKey, certificate, ca);
      _map.set(hostname, {
        commonName,
        expiresOn,
        secureContext,
        metadata
      });

      _logger.trace(`Found and loaded saved PEM-files for the certificate of hostname ${hostname}`);
      return true;
    } catch (err) {
      _logger.error(`Failed to load a certificate from the filesystem for hostname ${hostname}`, err);
      return false;
    }
  }

  /** Saves a set of PEM files for the certificate to the file system */
  const _saveCertificateToFilesystem = (hostname: string, privateKey: string, certificate: string, ca ? : string): boolean => {
    try {
      const pathname = hostname.replace(/\./g, '_');

      // This call will fail if the given strings are not valid
      createCertificateFromStrings(hostname, privateKey, certificate, ca);

      // Store the given certificate information as pem files
      _pemStorage.set(`${pathname}-key.pem`, privateKey);
      _pemStorage.set(`${pathname}-crt.pem`, certificate);

      if (ca) {
        _pemStorage.set(`${pathname}-ca.pem`, ca);
      }

      _logger.trace(`Saved PEM-files for the certificate of hostname ${hostname}`);
      return true;
    } catch (err) {
      _logger.error("Failed to save the certificate for hostname", err);
      return false;
    }
  }

  // Asset
  return ({
    get: (hostname) => {
      return _map.get(hostname);
    },
    remove: (hostname) => {
      if (_map.exists(hostname)) {
        _map.remove(hostname);
      }
    },
    ensure: async (hostname, renewalMethod) => {
      if (!_map.exists(hostname)) {
        _logger.trace(`Adding or renewing a certificate for hostname: ${hostname}`);
        await _addOrRenewCertificate(hostname, renewalMethod, false, 5);
      }
    },
    close: () => {
      _logger.close();
      _pemStorage.close();
      _map.close();
      _renewalTimer.close();
    }
  });
}


/**
 * Utility method to load a certificate from stringified private-key, certificate, and (optionaly) authority strings. This is the format of
 * the certificates in the filesystem and also generated from LetsEncrypt
 */
const createCertificateFromStrings = (
    hostname: string,
    privateKey: string | string[],
    certificate: string | string[],
    certificateAuthority ? : string | string[]
  ): Omit < Certificate,
  'metadata' > => {

    // Prevent empty/missing certificates to be loaded
    if (!privateKey || !certificate) {
      throw new Error(`Tried to load an empty certificate/key for the hostname (${hostname})`);
    }

    // Create the secure context used by the https SNI interface
    const context = TLS.createSecureContext({
      key: privateKey,
      cert: certificate,
      ca: certificateAuthority || undefined
    }).context;

    // Use forge to extract the data from the PEM string
    const cert = Forge.pki.certificateFromPem(Array.isArray(certificate) ? certificate[0] : certificate);

    // Return the certificate
    return ({
      secureContext: context,
      expiresOn: cert.validity.notAfter,
      commonName: cert.subject.attributes.reduce((current, attribute) => attribute.name === 'commonName' ? attribute.value : current, null)
    });
  }