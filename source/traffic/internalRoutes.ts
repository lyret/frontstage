import * as HTTP from "node:http";
import * as NET from "node:net";
import * as URL from "node:url";
import * as HttpProxy from "http-proxy";
import * as Output from "./httpHandlers";
import { Models } from "../database";
import { createLogger } from "../messages";

/** Logger */
const logger = createLogger("Internal Routes");

/** Web Proxy used for forwarding to internal routes */
let loadedProxy: HttpProxy | null = null;

/**
 * Forward a http(s) request to a registered internal route if its available
 * Returns true if the request was handled and false otherwise
 */
export async function handleHTTPRequest(
  hostname: string,
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
): Promise<boolean> {
  // Find the internal route
  const db = await Models.InternalRoutes();
  const route = (await db.findOne({ where: { hostname } }))?.toJSON();

  // Handle missing internal route
  if (!route) {
    logger.trace(`No internal route for incoming request to ${hostname}`);
    return false;
  }

  // Make sure that the proxy exists
  const proxy = getProxy();

  // Host headers are passed through from the source by default
  // We may want to use the host header of the target instead
  // specifically if we have proxies behind us
  // or servers that check the host name matches their own
  // NOTE: target host header has been removed for now
  // if (route.useTargetHostHeader) {
  //   req.headers.host = route.hostname;
  // }
  // NOTE: always localhost, see TODO below
  const targetHostname = "localhost";

  // Pass the request on to the http proxy
  const targetUrl = `${
    route.secure ? "https://" : "http://"
  }${targetHostname}:${route.port}/`;
  logger.trace(`Forwarding from ${hostname} to ${targetUrl}`);

  proxy.web(
    req,
    res,
    {
      target: targetUrl,
      secure: route.secure,
    },
    (err, req, res) => {
      logger.error(
        `Failed to forward request from ${req.headers.host} to ${route.hostname}`,
        err
      );
      return Output.NotFound(req, res);
    }
  );
  return true;
}

/**
 * Forward a upgrade request for websockets to an internal route if its available
 * Returns true if the request was handled and false otherwise
 */
export async function handleWebsocketUpgrade(
  hostname: string,
  req: HTTP.IncomingMessage,
  socket: NET.Socket,
  head: Buffer | null
): Promise<boolean> {
  // Find the internal route
  const db = await Models.InternalRoutes();
  const route = (await db.findOne({ where: { hostname } }))?.toJSON();

  // Handle missing internal route
  if (!route) {
    logger.trace(`No internal route for incoming request to ${hostname}`);
    return false;
  }

  // Make sure that the proxy exists
  const proxy = getProxy();

  // Log any future websocket errors
  socket.on("error", (err) => {
    logger.error("WebSocket error when forwarding", err);
  });

  // Pass the request on to the http proxy
  const targetUrl = `${route.secure ? "https://" : "http://"}${
    route.hostname
  }:${route.port}/`;
  try {
    logger.trace(
      `Upgrading websocket request between ${hostname} and ${targetUrl}`
    );

    proxy.ws(
      req,
      socket,
      head,
      {
        target: targetUrl,
        secure: route.secure,
      },
      (err, req, res) => {
        logger.error(
          `Failed to upgrade websockets from ${req.headers.host} to ${targetUrl}`,
          err
        );
        return Output.NotFound(req, res);
      }
    );
    return true;
  } catch (err) {
    logger.error(
      `Failed to upgrade websockets from ${req.headers.host} to ${targetUrl}`,
      err
    );
    Output.BadRequest(req, socket);
    return true;
  }
}

/**
 * Handles operations that needs to be performed on internal routes
 */
export async function performOperations(
  operations: State.Operations["internalRoutes"]
) {
  const db = await Models.InternalRoutes();

  // Destroy all removed entries
  for (const route of operations.removed) {
    await db.destroy({
      where: { hostname: route.hostname },
    });
    logger.warn(
      `Removed the internal route from ${route.hostname} to ${route.port}`
    );
  }

  // Update all moved entries
  for (const route of operations.moved) {
    await db.update(route, { where: { hostname: route.hostname } });
    logger.success(
      `Updated the internal route from ${route.hostname} to ${route.port}`
    );
  }

  // Add new entries
  for (const route of operations.added) {
    await db.create(route);
    logger.success(
      `Added an internal route from ${route.hostname} to ${route.port}`
    );
  }
}

/**
 * Adds a new internal route for forwarding web requests (http, https & websocket) to a hostname
 * to the the given target
 */
// TODO: Currently internal routes can only go to a localhost port
// When added to the database the target address should be determined
// also re-add support for "secure", "forward host header" and add a field
// for internal address.
// NOTE: Possibly Redirections and InternalRoutes can share database table,
// as it would speed up the look-up query
// async function add(hostname: string, outgoingPort: number) {
//   // NOTE: this has always been hardcoded to localhost, but
//   // to create internal routes between different local nodes
//   // this should be changable
//   let targetAddress = "localhost";
//
//   // Make sure the protocol is included at the start of the target address
//   if (targetAddress.search(/^http[s]?\:\/\//i) === -1) {
//     targetAddress = `http://${targetAddress}`;
//   }
//
//   // Make sure the given port is included in the target address
//   targetAddress = `${targetAddress}:${outgoingPort}`;
//
//   // Convert the string to an URL object
//   let targetUrl = new URL.URL(targetAddress);
//
//   // Make sure that all relevant information exists for routing
//   if (!targetUrl || !targetUrl.protocol || !targetUrl.host) {
//     throw new Error(
//       `Failed to create a internal route from ${hostname} to ${targetUrl}`
//     );
//   }
//
//   logger.success(
//     `Added an internal route between ${hostname} and ${targetAddress}`
//   );
// }

/**
 * Loads and returns the proxy used for internal redirections if it does not already exists
 * in-memory.
 */
function getProxy() {
  if (loadedProxy) {
    return loadedProxy;
  }
  // Create the proxy server
  loadedProxy = HttpProxy.createProxyServer({
    prependPath: false,
    secure: true,
    xfwd: true,
    autoRewrite: true,
  });

  // Make sure the proxy sets the correct host header when forwarding requests
  loadedProxy.on(
    "proxyReq",
    (clientRequest: HTTP.ClientRequest, req: HTTP.IncomingMessage) => {
      if (req.headers && req.headers.host) {
        clientRequest.setHeader("host", req.headers.host);
      }
    }
  );

  // Handles errors
  loadedProxy.on("error", (error, req, res, target) => {
    logger.error("Routing error", { error: error, target: target });

    if (res.write) {
      return Output.NotFound(req, res as HTTP.ServerResponse);
    }
  });

  // Return it
  return loadedProxy;
}
