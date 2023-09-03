// import * as HTTP from 'node:http';
// import * as NET from 'node:net';
// import * as URL from 'node:url';
// import * as HttpProxy from 'http-proxy';
//
// import { Logger } from '../logging';
// import { BadRequest, NotFound } from './_handlers';
// import { InMemoryCollection } from '../storage';
//
//
// /**
//  * A target for the HTTP Proxy service with
//  * the information needed for forwarding a request
//  */
// export interface ProxyTarget {
// 	/** Indicates that this target should be secured by HTTPS, that is between the proxy and the internal target */
// 	secure: boolean
// 	/** The hostname of the target, exluding protocol and port */
// 	hostname: string
// 	/** The port of the target */
// 	port: number
// 	/** Options used to create the target */
// 	options: {
// 		/** If true the proxy will sustitute the target host name for the inbound host name of the request, i.e it is not changed */
// 		useTargetHostHeader ? : boolean
// 		/** If true, The proxy will use https and check the credentials on the target(s) */
// 		secureOutbound ? : boolean
// 	}
// }
//
// /**
//  * A Web proxy allows web requests, http, https & websocket
//  * to be directed between different internal routes
//  */
// export const HTTPProxy: AssetGenerator < {
// 	/** Identifies this proxy */
// 	name: string
// }, {
// 	/** Adds a new possible target for the proxy between the incomming hostname and to the given URL address */
// 	addTarget: (hostname: string, address: string, port: number | undefined, options: ProxyTarget['options']) => void
// 	/** Proxy a http/https request to a registred target */
// 	http: (hostname: string, req: HTTP.IncomingMessage, res: HTTP.ServerResponse) => void
// 	/** Proxy a websockets upgrade request to a registred target */
// 	websocketUpgrade: (
// 		hostname: string,
// 		req: HTTP.IncomingMessage,
// 		socket: NET.Socket,
// 		head: Buffer | null
// 	) => void
// } > = (options) => {
//
// 	// Add a logger
// 	const _logger = Logger({ name: options.name });
//
// 	// Add a in memory collection of registred targets per hostname
// 	const _targets = InMemoryCollection < string,
// 		ProxyTarget > ();
//
// 	// Create the proxy server
// 	const proxy = HttpProxy.createProxyServer({
// 		prependPath: false,
// 		secure: true,
// 		xfwd: true,
// 		autoRewrite: true,
// 	});
//
// 	// Register events for the proxy...
//
// 	// ...makes sure the proxy sets the correct host header
//
// 	proxy.on('proxyReq', (clientRequest: HTTP.ClientRequest, req: HTTP.IncomingMessage) => {
//
// 		if (req.headers && req.headers.host) {
// 			clientRequest.setHeader('host', req.headers.host);
// 		}
// 	});
//
// 	// ..handles errors
//
// 	proxy.on('error', (error, req, res, target) => {
// 		_logger.error('Error', { error: error, target: target });
//
// 		if (res.write) {
// 			return NotFound(req, res as HTTP.ServerResponse);
// 		}
// 	});
//
// 	// Asset
// 	return ({
// 		addTarget: (incommingHostname, outgoingHostname, outgoingPort, options) => {
// 			let targetAddress = outgoingHostname;
//
// 			// See if there is already an target for the given hostname
// 			if (_targets.exists(incommingHostname)) {
// 				throw new Error(`The hostname "${incommingHostname}" has already been added as a target`);
// 			}
//
// 			// Make sure the protocol is included at the start of the address
// 			if (outgoingHostname.search(/^http[s]?\:\/\//i) === -1) {
// 				targetAddress = `http://${targetAddress}`;
// 			}
//
// 			// Make sure the givbn port is included
// 			if (outgoingPort) {
// 				targetAddress = `${targetAddress}:${outgoingPort}`;
// 			}
//
// 			// Convert the string to an URL object
// 			let targetUrl = new URL.URL(targetAddress);
//
// 			// Make sure that all relevant information is included
// 			if (!targetUrl || !targetUrl.protocol || !targetUrl.host) {
// 				throw new Error("Failed to create a proxy target between " + JSON.stringify({ target: targetUrl, from: incommingHostname }));
// 			}
//
// 			// Add the target
// 			_targets.set(incommingHostname, {
// 				hostname: String(targetUrl.hostname),
// 				port: outgoingPort || Number(targetUrl.port),
// 				secure: options.secureOutbound || targetUrl.protocol === 'https:' || false,
// 				options
// 			});
//
// 			_logger.info(`Added a proxy target from ${incommingHostname}`, _targets.get(incommingHostname));
// 		},
// 		http: (hostname, req, res) => {
//
// 			// Find the desired target
// 			const target = _targets.get(hostname);
//
// 			// Log missing routes
// 			if (!target) {
// 				_logger.error(`Missing target for incoming request to ${hostname}`);
// 				return NotFound(req, res);
// 			}
//
// 			// Host headers are passed through from the source by default
// 			// We may want to use the host header of the target instead
// 			// specifically if we have proxies behind us
// 			// or servers that check the host name matches their own
// 			if (target.options.useTargetHostHeader) {
// 				req.headers.host = target.hostname;
// 			}
//
// 			// Pass the request on to the http proxy
// 			const targetUrl = `${target.secure ? 'https://' : 'http://'}${target.hostname}:${target.port}/`
// 			_logger.trace(`Proxying ${hostname} to ${targetUrl}`, { target });
//
// 			proxy.web(req, res, {
// 					target: targetUrl,
// 					secure: target.secure
// 				},
// 				(err, req, res) => {
// 					_logger.error(`Failed to proxy ${req.headers.host} to ${target.hostname}`, err);
// 					return NotFound(req, res);
// 				});
// 		},
// 		websocketUpgrade: (hostname, req, socket, head) => {
//
// 			// Find the desired target
// 			const target = _targets.get(hostname);
//
// 			// Log missing routes
// 			if (!target) {
// 				_logger.error('Missing route for websocket upgrade', { hostname });
// 				return NotFound(req, socket);
// 			}
//
// 			// Log any future websocket errors
// 			socket.on('error', (err) => {
// 				_logger.error('WebSockets error', err);
// 			});
//
// 			// Pass the request on to the http proxy
// 			try {
// 				const targetUrl = `${target.secure ? 'https://' : 'http://'}${target.hostname}:${target.port}/`
// 				_logger.trace(`Upgrading ${hostname} to websockets`, { target, targetUrl });
//
// 				proxy.ws(req, socket, head, {
// 						target: targetUrl,
// 						secure: target.secure
// 					},
// 					(err, req, res) => {
// 						_logger.error(`Failed to proxy ${req.headers.host} to ${target.hostname}`, err);
// 						return NotFound(req, res);
// 					});
// 			} catch (err) {
// 				_logger.error(`Failed to upgrade websockets between ${req.headers.host} and ${target.hostname}`, err);
// 				return BadRequest(req, socket);
// 			}
// 		},
// 		close: () => {
// 			proxy.close();
// 			_targets.close();
// 		}
// 	})
// }
