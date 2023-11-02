import * as HTTP from "node:http";
import * as AcmeClient from "acme-client";
import * as Output from "../traffic/httpHandlers";
import { Models } from "../database";
import { createLogger } from "../messages";
import { State } from "../state";

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
  if (!State.Manager.certificates.lets_encrypt) {
    logger.error("Not enabled, can't request certificate");
    throw new Error("Lets encrypt certificates are not enabled");
  } else if (!State.Manager.certificates.lets_encrypt.contact_email) {
    logger.error("Missing neccesary information for requesting a certificate");
    throw new Error("Lets Encrypt certificates information is missing");
  } else {
    logger.info(`Requesting new certificate from Lets Encrypt for ${hostname}`);
  }

  try {
    // Determine what Lets Encrypt directory (server) to use
    const directoryUrl =
      AcmeClient.directory.letsencrypt[
        State.Manager.certificates.lets_encrypt.use_production_server
          ? "production"
          : "staging"
      ];
    logger.info(
      `Using the ${
        State.Manager.certificates.lets_encrypt.use_production_server
          ? "production"
          : "staging"
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
      contact: [
        "mailto:" + State.Manager.certificates.lets_encrypt.contact_email,
      ],
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
    const db = await Models.LetsEncryptChallenges();
    db.create({
      index: normalizeIndex(hostname, token),
      key: keyAuthorization,
    });

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
    const db = await Models.LetsEncryptChallenges();
    await db.destroy({ where: { index: normalizeIndex(hostname, token) } });
  }
}

/**
 * Evaluates if the given request matches the one that Lets Encrypt will try to contact this server on
 * Is used from the public server
 */
export function isLetsEncryptChallengeRequest(
  req: HTTP.IncomingMessage
): boolean {
  if (!State.Manager.certificates.lets_encrypt) {
    return false;
  }
  return /^\/.well-known\/acme-challenge\//.test(req.url || "/");
}

/**
 * Resolves a http challenge response from the Lets Encrypt servers
 * Is used from the public server
 */
export async function handleLetsEncryptChallengeRequest(
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
): Promise<void> {
  // Make sure that this request actually is meant for this service
  if (!(req.url && isLetsEncryptChallengeRequest(req))) {
    logger.warn(`Got a request thats not an ACME-challenge: ${req.url}`);
    return Output.BadRequest(req, res);
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
    return Output.NotFound(req, res);
  }

  // No token in request
  if (!token) {
    logger.warn("Got a request without an included token");
    return Output.NotFound(req, res);
  }
  logger.trace(`Validating challenge for token: ${token}`);

  // Find the challenge in the database
  const db = await Models.LetsEncryptChallenges();
  const dbEntry = await db.findOne({
    where: { index: normalizeIndex(req.headers.host, token) },
  });

  // No outstanding challenge
  if (!dbEntry) {
    logger.trace(`No outstanding challenge found for token: ${token}`);
    return Output.NotFound(req, res);
  }

  // Respond with the key corresponding to the token from the outstanding challenges
  return Output.Ok(req, res, dbEntry.toJSON().key);
}

/** Helper function to turn a hostname and token into a string used to index the challenges collection */
function normalizeIndex(hostname: string, token: string): string {
  return `${hostname}_${token.replace(/\W-/g, "")}`;
}
