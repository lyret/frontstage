import * as HTTP from 'node:http';
import * as AcmeClient from 'acme-client';
import * as Forge from 'node-forge';

import {
	LETS_ENCRYPT_PRODUCTION,
	LETS_ENCRYPT_EMAIL,
	LETS_ENCRYPT_SELF_SIGN_ENABLED,
	LETS_ENCRYPT_SELF_SIGN_COUNTRY,
	LETS_ENCRYPT_SELF_SIGN_STATE,
	LETS_ENCRYPT_SELF_SIGN_LOCALITY,
	LETS_ENCRYPT_SELF_SIGN_ORGANZIATION
} from '../config/settings';

import { BadRequest, NotFound, Ok } from '../http/_handlers';
import { THREE_MONTHS } from '../datetime';
import { InMemoryCollection } from "../storage"
import { Logger } from '../logging';

/**
 * This is the base class for the specific implentation of 
 * the Let's Encrypt Acme challenge handlers.
 * 
 * It instantiates the Http server to handle the http01 challenges
 */
/**
 * This is the entry point for requesting a new certificate.
 * 
 
 * 
 * ForceRenew will ignore the expiration of an existing certificate and request a new certificate.
 * 
 * setExpiration is a callback to allow the calling code to monitor the expiration date of the
 * certificate and request a new one before it expires
 */
/**
 * The base Let's Encrypt options
 * 
 * The base class instantiates an http server to respond to the Http-01 challenges
 * The port and host are used by the server
 * 
 * The dnsChallenge is the interface to a particular DNS server 
 * when you need to support a dns-01 challenge.
 * 
 * The dnsNameServer is optional. If specified it is the ip address of the DNS nameserver.
 * When specified the DNS challenge will query the nameserver to make sure the
 * update to the TXT record has propagated to the server specified
 *
 *  noVerify: optional switch to turn off the internal verification of the token/key with the internal server
 *      This is to avoid the problem for routers trying to twart the DNS-redis hack
 */

/** TODO: Document, remove above */
export const LetsEncryptService: AssetGeneratorWithoutOptions < {
	/** TODO: Document */
	getNewCertificate: (hostname: string) => Promise < [privateKey: string, certificate: string] > ,
	/** Returns whenever the lets encrypt service should handle the incomming request */
	shouldHandleChallengeResponse: (req: HTTP.IncomingMessage) => boolean
	/** Resolves a challenge response from the Lets Encrypt servers */
	onChallengeResponse: (req: HTTP.IncomingMessage, res: HTTP.ServerResponse) => void
} > = () => {

	// Add a logger
	const _logger = Logger({ name: "Lets Encrypt Server" });

	// Add a in-memory collection of outstanding challenges to Lets Encrypt
	const _outstandingChallenges = InMemoryCollection < string,
		string > ();

	// Helper function to turn a hostname and token into a string used to index
	// the challenges collection
	const index = (hostname: string, token: string): string => {
		return `${hostname}_${token.replace(/\W-/g, '')}`;
	}

	// Method to evalute if a given request matches the one that Lets Encrypt
	// will try to contact
	const testUrl = (req: HTTP.IncomingMessage) => {
		return /^\/.well-known\/acme-challenge\//.test(req.url || '/');
	}

	// Asset
	return ({
		getNewCertificate: async (hostname) => {
			// TODO:  quickfixed
			let token = '';
			
			try {
				// Create a self signed certificate if enabled
				if (LETS_ENCRYPT_SELF_SIGN_ENABLED) {
					_logger.info(`Creating a self-signed certificate for ${hostname}`);
					return generateSelfSignedCertificate(hostname);
				}

				_logger.info(`Requesting new certificate for ${hostname}`);

				// Determine the Lets Encrypt directory (server) to use
				const directoryUrl = AcmeClient.directory.letsencrypt[LETS_ENCRYPT_PRODUCTION ? "production" : "staging"];

				// Create a ACME Client
				const clientOptions: AcmeClient.ClientOptions = {
					directoryUrl,
					accountKey: await AcmeClient.forge.createPrivateKey(),
					backoffAttempts: 10
				};

				const client: AcmeClient.Client = new AcmeClient.Client(clientOptions);

				// Create the account on Let's Encrypt
				await client.createAccount({
					termsOfServiceAgreed: true,
					contact: ['mailto:' + LETS_ENCRYPT_EMAIL]
				});

				// Create the order on Let's Encrypt
				const order: AcmeClient.Order = await client.createOrder({
					identifiers: [{ type: 'dns', value: hostname }]
				});

				// Get the list of possible challenge types
				const authorizations: AcmeClient.Authorization[] = await client.getAuthorizations(order);
				const authorization = authorizations[0];

				// Work with the first challenge type. It is usually the simplest (http-01)
				let challenge = authorization.challenges[0];

				const keyAuthorization: string = await client.getChallengeKeyAuthorization(challenge);

				_logger.info('Adding challenge', { ...challenge, key: keyAuthorization })

				// Update the challenge response
				token = challenge.token;

				_outstandingChallenges.set(index(hostname, token), keyAuthorization);



				// Verify the challenge
				await client.verifyChallenge(authorization, challenge);

				// Ask Let's Encrypt to validate the challenge
				await client.completeChallenge(challenge);
				await client.waitForValidStatus(challenge);

				// Create the certificate signing request and private key
				const [key, csr] = await AcmeClient.forge.createCsr({
					commonName: hostname
				});

				// Finish the order
				await client.finalizeOrder(order, csr);

				// Get the certificate
				const certificate: string = await client.getCertificate(order);

				// Return it
				_logger.info(`Getting a new certificate from LetsEncrypt for hostname: ${hostname} succeded`);
				return [key.toString(), certificate];

			} catch (err) {
				// Log and raise any errors
				_logger.error(`New certificate from Lets Encrypt for ${hostname} failed!`, err);
				throw err;
			} finally {
				// Allows remove the outstanding challenge
				_outstandingChallenges.remove(index(hostname, token));
			}
		},
		shouldHandleChallengeResponse: (req) => {
			// Test the requested url to see if its meant for this service 
			return !!(req.url && testUrl(req));
		},
		onChallengeResponse: (req, res) => {
			
			// Make sure that this request actually is meant for this service
			if (!(req.url && testUrl(req))) {
				_logger.warn(`Got a request thats not an ACME-challenge: ${req.url}`);
				return BadRequest(req, res);
			}

			// Get the token from the url
			// trim white space, 
			// strip trailing /, 
			// split into array on /, 
			// take last item, 
			// remove invalid identifier characters 
			const token = req.url.trim().replace(/$\//, '').split('/').pop() !.replace(/\W-/g, '');

			// Respond with error if missing challenge path, token, or token is not in in outstanding challenges

			// ...No host information
			if (!req.headers.host) {
				_logger.warn("Got a request with not host header set");
				return NotFound(req, res);
			}

			// No token in request
			if (!token) {
				_logger.warn("Got a request without an included token");
				return NotFound(req, res);
			}

			const key = _outstandingChallenges.get(index(req.headers.host, token));
			_logger.trace(`Validating challenge for token: ${token}`);

			// No outstanding challenge
			if (!key) {
				_logger.trace(`No outstanding challenge found for token: ${token}`);
				return NotFound(req, res);
			}

			// Respond with the key corresponding to the token from the outstanding challenges
			return Ok(req, res, key);
		},
		close: () => {
			_outstandingChallenges.close();
		}
	});
}

/** Utility method that generats a self-signed certificate with the globaly defined options */
const generateSelfSignedCertificate = (hostname: string): [privateKey: string, certificate: string] => {

	// Generate key pair
	const keys = Forge.pki.rsa.generateKeyPair(1024);

	// Create certificate attributes
	const attributes = [{
		name: 'commonName',
		value: hostname
	}, {
		name: 'countryName',
		value: LETS_ENCRYPT_SELF_SIGN_COUNTRY
	}, {
		shortName: 'ST',
		value: LETS_ENCRYPT_SELF_SIGN_STATE
	}, {
		name: 'localityName',
		value: LETS_ENCRYPT_SELF_SIGN_LOCALITY
	}, {
		name: 'organizationName',
		value: LETS_ENCRYPT_SELF_SIGN_ORGANZIATION
	}, {
		shortName: 'OU',
		value: LETS_ENCRYPT_SELF_SIGN_ORGANZIATION
	}];

	// Create certificate extensions
	const extensions = [{
		name: 'basicConstraints',
		cA: true
	}, {
		name: 'keyUsage',
		keyCertSign: true,
		digitalSignature: true,
		nonRepudiation: true,
		keyEncipherment: true,
		dataEncipherment: true
	}, {
		name: 'extKeyUsage',
		serverAuth: true,
		clientAuth: true,
		codeSigning: true,
		emailProtection: true,
		timeStamping: true
	}, {
		name: 'nsCertType',
		client: true,
		server: true,
		email: true,
		objsign: true,
		sslCA: true,
		emailCA: true,
		objCA: true
	}, {
		name: 'subjectAltName',
		altNames: [{
			type: 6, // URI
			value: `http://${hostname}`
		}, {
			type: 7, // IP
			ip: '127.0.0.1'
		}]
	}, {
		name: 'subjectKeyIdentifier'
	}]

	// Generate the certificate
	const certificate = Forge.pki.createCertificate();
	certificate.publicKey = keys.publicKey;
	certificate.serialNumber = '01';
	certificate.validity.notBefore = new Date();
	certificate.validity.notAfter = new Date(new Date().valueOf() + THREE_MONTHS);
	certificate.setSubject(attributes);
	certificate.setIssuer(attributes);
	certificate.setExtensions(extensions);

	// Sign certificate using the key (self-sign)
	certificate.sign(keys.privateKey)

	// Format the Keys and certificate in the PEM format
	const pem = {
		privateKey: Forge.pki.privateKeyToPem(keys.privateKey),
		publicKey: Forge.pki.publicKeyToPem(keys.publicKey),
		certificate: Forge.pki.certificateToPem(certificate)
	}

	// Return the certificate
	return [pem.privateKey, pem.certificate];
}