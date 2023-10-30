import * as HTTP from "node:http";
import * as HTTPS from "node:https";
import * as NET from "node:net";
import * as Path from "node:path";
import * as InternalRoutes from "./traffic/internalRoutes";
import * as Redirections from "./traffic/redirections";
import * as Output from "./traffic/httpHandlers";
import * as Certificates from "./certificates";
import { createLogger } from "./messages";

// PUBLIC WEB SERVER
// This is a subprocess of the server manager, it is loaded and runs in the process manager. It handles all incomming traffic to the server
// FIXME: Its probably in this file that wildcard domains needs to be handled, so that they are routed correctly
// hostnames should be simplyfied in certificates (from *.asda.se to asda.se and handled here ?)

/** Logger */
const logger = createLogger("Public Server");

/**
 * Creates and runs one or two servers for handling the incoming HTTP and HTTPS traffic
 * to the server. Uses the other subsystems (internal routes, redirections, certificates etc)
 * to handle the incoming requests
 */
export async function main() {
  // Create a HTTPS Server if enabled
  if (REVERSE_ROUTER_ENABLE_HTTPS) {
    // Create the https server with serverr name identification and support for resolving a TLS context depending on hostname
    const httpsServer = HTTPS.createServer({
      SNICallback: async (hostname, callback) => {
        // Get the certificate for the incoming hosthane
        const certificate = await Certificates.load(hostname);

        // Resolve SNI using the found certificate
        if (callback) {
          if (certificate) {
            callback(null, certificate.secureContext);
          } else {
            callback(
              new Error("No certificate exists for the hostname: " + hostname)
            );
          }
        }
      },
    });

    // Handle secured incoming requests
    httpsServer.on("request", handleIncomingRequest);

    // Handle incoming web socket upgrades
    httpsServer.on("upgrade", upgradeWebsocketRequest);

    // Handle errors
    httpsServer.on("error", (err) => {
      logger.error(`${err.message} (request error)`, err);
    });
    httpsServer.on("clientError", (err) => {
      logger.error(`${err.message} (client error)`, err);
    });

    // Start listening
    httpsServer.on("listening", () => {
      logger.info(
        `Now listening to web requests on ${REVERSE_ROUTER_HOST}:${REVERSE_ROUTER_HTTPS_PORT}`
      );
    });
    httpsServer.listen(REVERSE_ROUTER_HTTPS_PORT, REVERSE_ROUTER_HOST);
  }

  // Create a server for handling incoming unsecured requests, if HTTPS is enabled, the http server will
  // redirect request to the https server, otherwise they are handled directly
  const httpServer = HTTP.createServer();

  httpServer.on(
    "request",
    REVERSE_ROUTER_ENABLE_HTTPS
      ? redirectFromHTTPtoHTTPS
      : handleIncomingRequest
  );

  // Handle incoming web socket upgrades, the http server can always upgrade directly
  httpServer.on("upgrade", upgradeWebsocketRequest);

  // Handle errors
  httpServer.on("error", (err) => {
    logger.error(`Request error`, err);
  });
  httpServer.on("clientError", (err) => {
    logger.error(`Client error`, err);
  });

  // Start listening
  httpServer.on("listening", () => {
    if (REVERSE_ROUTER_ENABLE_HTTPS) {
      logger.info(
        `Redirecting unsecured web requests to HTTPS on ${REVERSE_ROUTER_HOST}:${REVERSE_ROUTER_HTTP_PORT}`
      );
    } else {
      logger.info(
        `Now listening to web requests over HTTP on ${REVERSE_ROUTER_HOST}:${REVERSE_ROUTER_HTTP_PORT}`
      );
    }
  });
  httpServer.listen(REVERSE_ROUTER_HTTP_PORT, REVERSE_ROUTER_HOST);
}

/**
 * Handles an incoming HTTP/HTTPS request to the public server
 */
async function handleIncomingRequest(
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
) {
  try {
    const hostname = getInboundHostname(req);
    logger.trace(`Got incoming request to ${hostname} `);

    // Handle if the request is a Lets Encrypt challenge
    if (Certificates.isLetsEncryptChallengeRequest(req)) {
      logger.trace(`Routing LetsEncrypt challenge to ${req.url}`);
      await Certificates.handleLetsEncryptChallengeRequest(req, res);
      return;
    }

    // Redirect the request if there is a redirection configuration
    if (await Redirections.handleHTTPRequest(hostname, req, res)) {
      logger.trace(`The request to ${hostname} was redirected`);
      return;
    }

    // Handle the route as an internal route as default/fallback
    if (await InternalRoutes.handleHTTPRequest(hostname, req, res)) {
      logger.trace(`The request to ${hostname} was routed`);
      return;
    }
  } catch (err) {
    logger.warn(`Failed to handle request`, err);
    return Output.NotFound(req, res);
  }
}

/**
 * Allows clients to internal routes to
 * upgrade to websocket through the public server
 */
async function upgradeWebsocketRequest(
  req: HTTP.IncomingMessage,
  socket: NET.Socket,
  head: Buffer | null
) {
  try {
    const hostname = getInboundHostname(req);

    // Handle the route as an internal route
    if (
      await InternalRoutes.handleWebsocketUpgrade(hostname, req, socket, head)
    ) {
      logger.trace(`The websocket upgrade to ${hostname} was routed`);
      return;
    }
  } catch (err) {
    logger.error(`Failed to handle websocket upgrade request`, err);
    return Output.NotFound(req, socket);
  }
}

/**
 * Redirect unsecured web traffic to HTTPS
 * Allows for the special case of unsecured lets encrypt challenges
 */
async function redirectFromHTTPtoHTTPS(
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
) {
  try {
    logger.trace("Upgrading request...");
    // Handle if the request is a Lets Encrypt challenge
    if (Certificates.isLetsEncryptChallengeRequest(req)) {
      logger.trace(`Routing LetsEncrypt challenge to ${req.url}`);
      await Certificates.handleLetsEncryptChallengeRequest(req, res);
      return;
    }

    // Set up the redirect to use the same host, path and and port as the original request
    const targetUrl = req.url || "/";
    const targetPort = REVERSE_ROUTER_HTTPS_PORT;
    const targetHostname =
      getInboundHostname(req) + (targetPort ? ":" + targetPort : "");
    const targetHref =
      "https://" + Path.join(targetHostname, targetUrl).replace(/\\/g, "/");

    // Send a redirection response to the client
    logger.trace(`Redirecting ${targetHostname}${targetUrl} to ${targetHref}`);
    return Output.Redirected(req, res, targetHref);
  } catch (err) {
    logger.error(`Failed to redirect request to https`, err);
    return Output.BadRequest(req, res);
  }
}

/** Utility method for getting the hostname from an incoming request */
function getInboundHostname(req: HTTP.IncomingMessage): string {
  if (REVERSE_ROUTER_PREFER_FORWARDED_HOST) {
    const forwardedHost = req.headers["x-forwarded-host"];

    if (Array.isArray(forwardedHost)) {
      return forwardedHost[0].split(":")[0].toLowerCase();
    }

    if (forwardedHost) {
      return forwardedHost.split(":")[0].toLowerCase();
    }
  }

  if (req.headers.host) {
    return req.headers.host.split(":")[0].toLowerCase();
  }

  throw new Error("Unable to get inbound hostname");
}

// Starts the internal process
main();
