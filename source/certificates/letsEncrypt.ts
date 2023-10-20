import * as HTTP from "node:http";
import * as AcmeClient from "acme-client";
import { createLogger } from "../messages";

/** Runtime cache of outstanding challenges to Lets Encrypt */
const outstandingChallenges = new Map<string, string>();

/** Logger */
const logger = createLogger("Lets Encrypt");

/**
 * Sends a request to a Lets Encrypt directory (i.e. either production or staging)
 * to create and return a certificate for the given hostname.
 * After the request has been made a challenge will be made from Lets Encrypt to
 * this server that is handled by the public server, make sure its running.
 */
export async function requestCertificateFromLetsEncrypt(
  hostname: string
): Promise<[certificate: string, privateKey: string]> {
  let token = "";

  // Make sure that certificates from Lets Encrypt are enabled and that the necessary information is set
  if (!LETS_ENCRYPT_CERTIFICATES_ENABLED) {
    logger.error("Not enabled, can't request certificate");
    throw new Error("Lets encrypt certificates are not enabled");
  } else if (!LETS_ENCRYPT_CERTIFICATES_EMAIL) {
    logger.error("Missing neccesary information for requesting a certificate");
    throw new Error("Lets Encrypt certificates information is missing");
  } else {
    logger.info(`Requesting new certificate from Lets Encrypt for ${hostname}`);
  }

  try {
    // Determine what Lets Encrypt directory (server) to use
    const directoryUrl =
      AcmeClient.directory.letsencrypt[
        LETS_ENCRYPT_CERTIFICATES_PRODUCTION ? "production" : "staging"
      ];
    logger.info(
      `Using the ${
        LETS_ENCRYPT_CERTIFICATES_PRODUCTION ? "production" : "staging"
      } server`
    );

    // Create a ACME Client
    const clientOptions: AcmeClient.ClientOptions = {
      directoryUrl,
      accountKey: await AcmeClient.forge.createPrivateKey(),
      backoffAttempts: 10,
    };

    const client: AcmeClient.Client = new AcmeClient.Client(clientOptions);

    // Create the account on Let's Encrypt
    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: ["mailto:" + LETS_ENCRYPT_CERTIFICATES_EMAIL],
    });

    // Create the order on Let's Encrypt
    const order: AcmeClient.Order = await client.createOrder({
      identifiers: [{ type: "dns", value: hostname }],
    });

    // Get the list of possible challenge types
    const authorizations: AcmeClient.Authorization[] =
      await client.getAuthorizations(order);
    const authorization = authorizations[0];

    // Work with the first challenge type. It is usually the simplest (http-01)
    let challenge = authorization.challenges[0];

    const keyAuthorization: string = await client.getChallengeKeyAuthorization(
      challenge
    );

    logger.info("Adding challenge", {
      ...challenge,
      key: keyAuthorization,
    });

    // Update the challenge response
    token = challenge.token;

    outstandingChallenges.set(
      normalizeIndex(hostname, token),
      keyAuthorization
    );

    // Verify the challenge
    await client.verifyChallenge(authorization, challenge);

    // Ask Let's Encrypt to validate the challenge
    await client.completeChallenge(challenge);
    await client.waitForValidStatus(challenge);

    // Create the certificate signing request and private key
    const [key, csr] = await AcmeClient.forge.createCsr({
      commonName: hostname,
    });

    // Finish the order
    await client.finalizeOrder(order, csr);

    // Get the certificate
    const certificate: string = await client.getCertificate(order);

    // Return it
    logger.success(
      `Got a new certificate from LetsEncrypt for hostname: ${hostname}`
    );
    return [certificate, key.toString()];
  } catch (err) {
    // Log and then raise any errors that occur
    logger.error(
      `New certificate from Lets Encrypt for ${hostname} failed!`,
      err
    );
    throw err;
  } finally {
    // Remove the outstanding challenge
    outstandingChallenges.delete(normalizeIndex(hostname, token));
  }
}

/**
 * Evaluates if the given request matches the one that Lets Encrypt will try to contact this server on
 * Is used from the public server
 */
export function isLetsEncryptChallengeRequest(
  req: HTTP.IncomingMessage
): boolean {
  if (!LETS_ENCRYPT_CERTIFICATES_ENABLED) {
    return false;
  }
  return /^\/.well-known\/acme-challenge\//.test(req.url || "/");
}

/**
 * Resolves a http challenge response from the Lets Encrypt servers
 * Is used from the public server
 */
export function handleLetsEncryptChallengeRequest(
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
): void {
  // Make sure that this request actually is meant for this service
  if (!(req.url && isLetsEncryptChallengeRequest(req))) {
    logger.warn(`Got a request thats not an ACME-challenge: ${req.url}`);
    return Output.Http.BadRequest(req, res);
  }

  // Get the token from the url
  // trim white space,
  // strip trailing /,
  // split into array on /,
  // take last item,
  // remove invalid identifier characters
  const token = req.url
    .trim()
    .replace(/$\//, "")
    .split("/")
    .pop()!
    .replace(/\W-/g, "");

  // Respond with error if missing challenge path, token, or token is not in in outstanding challenges

  // ...No host information
  if (!req.headers.host) {
    logger.warn("Got a request with not host header set");
    return Output.Http.NotFound(req, res);
  }

  // No token in request
  if (!token) {
    logger.warn("Got a request without an included token");
    return Output.Http.NotFound(req, res);
  }

  const key = outstandingChallenges.get(
    normalizeIndex(req.headers.host, token)
  );
  logger.trace(`Validating challenge for token: ${token}`);

  // No outstanding challenge
  if (!key) {
    logger.trace(`No outstanding challenge found for token: ${token}`);
    return Output.Http.NotFound(req, res);
  }

  // Respond with the key corresponding to the token from the outstanding challenges
  return Output.Http.Ok(req, res, key);
}

/** Helper function to turn a hostname and token into a string used to index the challenges collection */
function normalizeIndex(hostname: string, token: string): string {
  return `${hostname}_${token.replace(/\W-/g, "")}`;
}
