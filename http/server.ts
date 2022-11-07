import * as HTTP from 'node:http';
import * as HTTPS from 'node:https';
import * as NET from 'node:net';
import { SecureContext } from 'node:tls';

import { Logger } from '../logging';
import { NotFound } from './_handlers';

/** Options used to configure a new HTTPServer Asset */
interface ServerOptions {
	/** Identifies this server */
	name: string
	/** Port to listen to */
	port: number
	/** (optional) The interface to listen on */
	interface ? : string
	/** (optional) If set the server uses the HTTPS protocol with these additional options */
	https ? : {
		/* The Server Name Indication callback for the HTTPS Server */
		onServerNameIdentification: (hostname: string, callback: (err: Error | null, ctx ? : SecureContext) => void) => void
	}
	/** Request and event handlers */
	on ? : {
		/** Handler for incomming requests */
		request ? : (req: HTTP.IncomingMessage, res: HTTP.ServerResponse) => void
		/* Handler for upgrading request from http to websocket */
		upgrade ? : (req: HTTP.IncomingMessage, socket: NET.Socket, head: Buffer | null) => void
	}
}

/** TODO: Document */
export const HTTPServer: AssetGenerator < ServerOptions, {
	/** The event handlers to use for this server */
	handlers: Required < ServerOptions > ['on']
} > = (modifiedOptions) => {

	// Add a logger
	const _logger = Logger({ name: modifiedOptions.name });

	// Add custom and default request handlers
	const handlers: Required < typeof modifiedOptions['on'] > = {
		request: (req, res) => {
			_logger.trace(`Unhandled incoming request to ${req.url}`);
			return NotFound(req, res);
		},
		upgrade: (req, socket, _) => {
			_logger.trace(`Unhandled incoming upgrade request to ${req.url}`);
			return NotFound(req, socket);
		},
		...(modifiedOptions.on ? modifiedOptions.on : {})
	};

	// Add default options
	const options = {
		interface: 'localhost',
		on: {},
		...modifiedOptions
	};

	// Create the server
	const server = options.https ? HTTPS.createServer({
		SNICallback: options.https.onServerNameIdentification
	}) : HTTP.createServer();

	// Register given server events
	for (const [requestType, requestHandler] of Object.entries(handlers)) {
		server.on(requestType, requestHandler);
	}

	// Register a handler for the listening event
	server.on('listening', () => {
		const serverAddress = server.address();
		_logger.trace(`listening to requests on ${options.interface}:${options.port}`, serverAddress);
	});

	// Register a handler for the error event
	server.on('error', (err) => {
		_logger.error(`Error`, err);
	});

	// Register a handler for the client error event
	server.on('clientError', (err) => {
		_logger.error(`Client error`, err);
	});

	// Start listening for requests
	server.listen(options.port, options.interface);

	// Asset
	return ({
		handlers: handlers,
		close: () => {
			_logger.close();
			server.close();
		}
	});
}