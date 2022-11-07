import * as HTTP from 'node:http';
import { Observable, Subject } from 'rxjs';



/** Options used to configure a new HTTPServer Asset */
interface ServerOptions {
	/** Identifies this server */
	name: string
	/** Port to listen to */
	port: number
	/** (optional) The interface to listen on */
	interface ? : string
}

type Value = [req: HTTP.IncomingMessage | null, res: HTTP.ServerResponse | null, err: Error | null];

const a = (options: ServerOptions) => {

	const o = {
		interface: 'localhost',
		...options
	};

	const server = HTTP.createServer();
	const subject = new Subject<{ req : HTTP.IncomingMessage, res: HTTP.ServerResponse }>();



	// Register a handler for the listening event
	server.on('listening', () => {
		console.log('listening', server.address());
	});
	// Register a handler for the request event
	server.on('request', (req, res) => {
		subject.next({ req, res });
	});

	// Register a handler for the error event
	server.on('error', (err) => {
		subject.error(err);
	});

	// Register a handler for the client error event
	server.on('clientError', (err) => {
		subject.error(err);
	});

	// Start listening for requests
	server.listen(o.port, o.interface);
	
	return subject;
}


const b = a({
	name: "test",
	port: 3000
});

b.subscribe({
	next: (({ req, res }) => {
		console.log("here!");
	}),
	error
});
b.subscribe({
	next: (({ req, res }) => {
		console.log("haa!");
	})
});