import * as HTTP from 'node:http';
import * as NET from 'node:net';
import * as Path from 'node:path';

import {
  REVERSE_ROUTER_HTTP_PORT,
  REVERSE_ROUTER_HTTPS_PORT,
  REVERSE_ROUTER_HOST,
  REVERSE_ROUTER_PREFER_FORWARDED_HOST,
  REVERSE_ROUTER_ENABLE_HTTPS
} from '../config/settings';

import { Logger } from '../logging/logger';
import { Certificates, LetsEncryptService } from '../certificates';
import { HTTPServer, HTTPProxy, ProxyTarget } from '../http';
import { Redirected } from './_handlers';


/**
 * TODO: Document
 */
export const ReverseRouter: AssetGeneratorWithoutOptions < {
  /**
   * Allows the registration of a new route between an incomming hostname to the router, that will be
   * forwarded to the outgoing hostname and optional port
   */
  addRoute: (incommingHostname: string, outgoingHostname: string, port: number, options?: ProxyTarget['options']) => void
} > = () => {

  // Add a logger
  const _logger = Logger({ name: "Reverse Router" });

  // Add a web proxy for routing requests
  const _proxy = HTTPProxy({ name: "Reverse Router Proxy" });

  // Add a certificates collection
  const _certificates = !REVERSE_ROUTER_ENABLE_HTTPS ? undefined : Certificates();

  // Add a Lets Encrypt service
  const _letsEncryptService = !REVERSE_ROUTER_ENABLE_HTTPS ? undefined : LetsEncryptService();

  // Add a server for handling incoming requests to be routed
  // If enabled it will use HTTPS and secure connections using
  // the certificates collection
  // adds the SNI (Server Name Indication) callback for resolving certificates
  // and register events
  const _routerServer = HTTPServer({
    name: "Reverse Router Server",
    // Use the correct port depending on HTTP/HTTPS
    port: REVERSE_ROUTER_ENABLE_HTTPS ? REVERSE_ROUTER_HTTPS_PORT : REVERSE_ROUTER_HTTP_PORT,
    interface: REVERSE_ROUTER_HOST,
    https: !REVERSE_ROUTER_ENABLE_HTTPS ? undefined : {
      // The Server Name Indication is handled by the TLS Module. Set up here to handle multiple hostnames
      onServerNameIdentification: (hostname, callback) => {

        // Get the certificate for the hosthane
        const certificate = _certificates?.get(hostname);

        // Resolve SNI using the found certificate
        if (callback) {
          if (certificate) {
            callback(null, certificate.secureContext);
          } else {
            callback(new Error("No certificate found for the hostname: " + hostname))
          }
        }
      }
    },
    on: {
      // Handle incomming requests to the reverse router
      request: (req, res) => {
        try {
          const hostname = getInboundHostname(req);

          // Allow the Lets Encrypt Service to respond to the request
          if (_letsEncryptService?.shouldHandleChallengeResponse(req)) {
            _logger.info(`Routing LetsEncrypt challenge to ${req.url}`);
            return _letsEncryptService.onChallengeResponse(req, res);
          }

          // Let the proxy handle the request
          _proxy.http(hostname, req, res);
        } catch (err) {
          _logger.error(`Failed to route request`, err);
        }
      },
      // Allows clients to upgrade to websocket using the reverse router proxy
      upgrade: (
        req,
        socket: NET.Socket,
        head: Buffer | null
      ) => {
        try {
          const hostname = getInboundHostname(req);

          // Let the proxy handle the request
          _proxy.websocketUpgrade(hostname, req, socket, head);
        } catch (err) {
          _logger.error(`Failed to route upgrade request`, err);
        }
      }
    }
  });

  // If HTTPS routing is enabled, add an additional server for redirecting
  // HTTP requests to the router server that is running over HTTPS instead
  const _redirectionServer = (!REVERSE_ROUTER_ENABLE_HTTPS ? null : HTTPServer({
    name: "Reverse Router Redirection to HTTPS Server",
    port: REVERSE_ROUTER_HTTP_PORT,
    interface: REVERSE_ROUTER_HOST,
    on: {
      // Redirect incomming requests to the same URL but over HTTPS
      request: (req, res) => {
        try {
          // Allow the Lets Encrypt Service to respond to the request
          if (_letsEncryptService && _letsEncryptService.shouldHandleChallengeResponse(req)) {
            _logger.trace(`Routing LetsEncrypt challenge to ${req.url}`);
            return _letsEncryptService.onChallengeResponse(req, res);
          }

          // Set up the redirect to use the same host, path and and port as the original request
          const targetUrl = req.url || '/';
          const targetPort = REVERSE_ROUTER_HTTPS_PORT;
          const targetHostname = getInboundHostname(req) + (targetPort ? ':' + targetPort : '');
          const targetHref = 'https://' + Path.join(targetHostname, targetUrl).replace(/\\/g, '/');

          // Send a redirection response to the client
          _logger.trace(`Redirecting ${targetHostname}${targetUrl} to ${targetHref}`);
          return Redirected(req, res, targetHref);
        } catch (err) {
          _logger.error(`Failed to redirect request to https`, err);
        }
      },
      // The redirection server allows Websocket upgrades directly, use the same handler
      // as the routing server
      upgrade: _routerServer.handlers.upgrade
    }
  }));

  // Asset
  return ({
    addRoute: async (incommingHostname, outgoingHostname, outgoingPort, targetOptions = { secureOutbound: false, useTargetHostHeader: false }) => {
      try {

        // Makes sure that the certificate for the route exists
        _certificates?.ensure(incommingHostname, _letsEncryptService?.getNewCertificate);

        // Add the target to the proxy
        _proxy.addTarget(incommingHostname, outgoingHostname, outgoingPort, targetOptions);

      } catch (err) {
        _logger.error(`Unable to add a route between ${incommingHostname} and ${outgoingHostname}`, err)
        _certificates?.remove(incommingHostname);
      }

    },
    close: () => {
      _letsEncryptService?.close();
      _certificates?.close();
      _redirectionServer?.close();
      _routerServer.close();
    }
  });
}


/** Utility method for getting the hostname from an incoming request */
const getInboundHostname = (req: HTTP.IncomingMessage): string => {

  if (REVERSE_ROUTER_PREFER_FORWARDED_HOST) {
    const forwardedHost = req.headers['x-forwarded-host'];

    if (Array.isArray(forwardedHost)) {
      return forwardedHost[0].split(':')[0].toLowerCase();
    }

    if (forwardedHost) {
      return forwardedHost.split(':')[0].toLowerCase();
    }
  }

  if (req.headers.host) {
    return req.headers.host.split(':')[0].toLowerCase();
  }

  throw new Error("Unable to get inbound hostname");
}