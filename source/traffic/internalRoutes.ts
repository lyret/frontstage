import * as HTTP from "node:http";
import * as NET from "node:net";
import * as URL from "node:url";
import * as HttpProxy from "http-proxy";
import * as Output from "./httpHandlers";
import { createLogger } from "../messages";

/** Logger */
const logger = createLogger("Internal Routes");

/** In memory collection of registered internal routes sorted by hostname */
const internalRoutes = new Map<string, Routes.InternalRoute>();

/** Web Proxy used for forwarding to internal routes */
let proxy: HttpProxy | null = null;

/**
 * Adds a new internal route for forwarding web requests (http, https & websocket) to a hostname
 * to the the given target
 *
 * @param hostname The hostname to route from
 * @param targetAddress The web address (hostname / url) to route requests to
 * @param targetPort (Optional) The port of the target to route redirect requests to
 * @param options (Optional) TODO: document
 */
export async function add(
  hostname: string,
  targetAddress: string,
  outgoingPort: number | undefined = undefined,
  options: Routes.Options = {}
) {
  // Fail if there already is target for the given hostname
  if (internalRoutes.has(hostname)) {
    throw new Error(
      `The hostname "${hostname}" has already been added as a internal route`
    );
  }

  // Make sure the protocol is included at the start of the target address
  if (targetAddress.search(/^http[s]?\:\/\//i) === -1) {
    targetAddress = `http://${targetAddress}`;
  }

  // Make sure the given port is included in the target address
  if (outgoingPort) {
    targetAddress = `${targetAddress}:${outgoingPort}`;
  }

  // Convert the string to an URL object
  let targetUrl = new URL.URL(targetAddress);

  // Make sure that all relevant information exists for routing
  if (!targetUrl || !targetUrl.protocol || !targetUrl.host) {
    throw new Error(
      "Failed to create a internal route" +
        JSON.stringify({ from: hostname, to: targetUrl })
    );
  }

  // Add the target to the in memory collection
  internalRoutes.set(hostname, {
    hostname: String(targetUrl.hostname),
    port: outgoingPort || Number(targetUrl.port),
    secure: options.secureOutbound || targetUrl.protocol === "https:" || false,
    options,
  });

  logger.success(
    `Added an internal route between ${hostname} and ${targetAddress}`
  );
}

/** Forward a http(s) request to a registered internal route */
export function handleHTTPRequest(
  hostname: string,
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
): void {
  // Find the target
  const target = internalRoutes.get(hostname);

  // Handle missing internal route
  if (!target) {
    throw new Error(`No internal route for incoming request to ${hostname}`);
  }

  // Make sure that the proxy is initialised
  if (!proxy) {
    logger.warn(`The http proxy has not been initialised`);
    return Output.NotFound(req, res);
  }

  // Host headers are passed through from the source by default
  // We may want to use the host header of the target instead
  // specifically if we have proxies behind us
  // or servers that check the host name matches their own
  if (target.options.useTargetHostHeader) {
    req.headers.host = target.hostname;
  }

  // Pass the request on to the http proxy
  const targetUrl = `${target.secure ? "https://" : "http://"}${
    target.hostname
  }:${target.port}/`;
  logger.trace(`Forwarding from ${hostname} to ${targetUrl}`);

  proxy.web(
    req,
    res,
    {
      target: targetUrl,
      secure: target.secure,
    },
    (err, req, res) => {
      logger.error(
        `Failed to forward request from ${req.headers.host} to ${target.hostname}`,
        err
      );
      return Output.NotFound(req, res);
    }
  );
}

/** Forward a upgrade request for websockets to an internal route */
export function handleWebsocketUpgrade(
  hostname: string,
  req: HTTP.IncomingMessage,
  socket: NET.Socket,
  head: Buffer | null
): void {
  // Find the target
  const target = internalRoutes.get(hostname);

  // Handle missing internal route
  if (!target) {
    throw new Error(`No internal route for incoming request to ${hostname}`);
  }

  // Make sure that the proxy is initialised
  if (!proxy) {
    logger.warn(`The http proxy has not been initialised`);
    return Output.NotFound(req, socket);
  }

  // Log any future websocket errors
  socket.on("error", (err) => {
    logger.error("WebSocket error when forwarding", err);
  });

  // Pass the request on to the http proxy
  const targetUrl = `${target.secure ? "https://" : "http://"}${
    target.hostname
  }:${target.port}/`;
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
        secure: target.secure,
      },
      (err, req, res) => {
        logger.error(
          `Failed to upgrade websockets from ${req.headers.host} to ${targetUrl}`,
          err
        );
        return Output.NotFound(req, res);
      }
    );
  } catch (err) {
    logger.error(
      `Failed to upgrade websockets from ${req.headers.host} to ${targetUrl}`,
      err
    );
    return Output.BadRequest(req, socket);
  }
}

/**
 * Loads and registers all the configured internal routes to the in memory collection
 * Should be called once during initialisation
 */
export function bootstrap() {
  // Initialise the proxy server
  proxy = HttpProxy.createProxyServer({
    prependPath: false,
    secure: true,
    xfwd: true,
    autoRewrite: true,
  });

  // Make sure the proxy sets the correct host header when forwarding requests
  proxy.on(
    "proxyReq",
    (clientRequest: HTTP.ClientRequest, req: HTTP.IncomingMessage) => {
      if (req.headers && req.headers.host) {
        clientRequest.setHeader("host", req.headers.host);
      }
    }
  );

  // Handles errors
  proxy.on("error", (error, req, res, target) => {
    logger.error("Routing error", { error: error, target: target });

    if (res.write) {
      return Output.NotFound(req, res as HTTP.ServerResponse);
    }
  });

  // TODO: add internal routes
  // TODO: move to bootstrap in some way
  // Add all routes that should be configured
  // for (const { hostname, port } of routes) {
  //   router.addRoute(hostname, "localhost", port, {
  //     useTargetHostHeader: false,
  //     secureOutbound: false,
  //   });
  // }
}
