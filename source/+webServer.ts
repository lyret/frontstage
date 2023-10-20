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
      SNICallback: (hostname, callback) => {
        // Get the certificate for the incoming hosthane
        const certificate = Certificates.find(hostname);

        // Resolve SNI using the found certificate
        if (callback) {
          if (certificate) {
            callback(null, certificate.secureContext);
          } else {
            callback(
              new Error("No certificate loaded for the hostname: " + hostname)
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
      logger.error(`Request error`, err);
    });
    httpsServer.on("clientError", (err) => {
      logger.error(`Client error`, err);
    });

    // Start listening
    httpsServer.on("listening", () => {
      logger.trace(`Now listening to web requests`);
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
      logger.trace(`Redirecting unsecured web requests to HTTPS`);
    } else {
      logger.trace(`Now listening to web requests over HTTP`);
    }
  });
  httpServer.listen(REVERSE_ROUTER_HTTP_PORT, REVERSE_ROUTER_HOST);
}

/**
 * Handles an incoming HTTP/HTTPS request to the public server
 */
function handleIncomingRequest(
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
) {
  try {
    const hostname = getInboundHostname(req);

    // Handle if the request is a Lets Encrypt challenge
    if (Certificates.isLetsEncryptChallengeRequest(req)) {
      logger.trace(`Routing LetsEncrypt challenge to ${req.url}`);
      return Certificates.handleLetsEncryptChallengeRequest(req, res);
    }

    if (Redirections.find(hostname)) {
      return Redirections.handleHTTPRequest(hostname, req, res);
    }

    // Handle the route as an internal route as default/fallback
    return InternalRoutes.handleHTTPRequest(hostname, req, res);
  } catch (err) {
    logger.error(`Failed to handle request`, err);
    return Output.NotFound(req, res);
  }
}

/**
 * Allows clients to internal routes to
 * upgrade to websocket through the public server
 */
function upgradeWebsocketRequest(
  req: HTTP.IncomingMessage,
  socket: NET.Socket,
  head: Buffer | null
) {
  try {
    const hostname = getInboundHostname(req);

    // Handle the route as an internal route
    return InternalRoutes.handleWebsocketUpgrade(hostname, req, socket, head);
  } catch (err) {
    logger.error(`Failed to handle websocket upgrade request`, err);
    return Output.NotFound(req, socket);
  }
}

/**
 * Redirect unsecured web traffic to HTTPS
 * Allows for the special case of unsecured lets encrypt challenges
 */
function redirectFromHTTPtoHTTPS(
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
) {
  try {
    // Handle if the request is a Lets Encrypt challenge
    if (Certificates.isLetsEncryptChallengeRequest(req)) {
      logger.trace(`Routing LetsEncrypt challenge to ${req.url}`);
      return Certificates.handleLetsEncryptChallengeRequest(req, res);
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
