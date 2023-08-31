Skaru.se behöver stöd för wilda subdomäner vilket inte alls fungerar

# Roadmap

- communicate with the manager directly over ssh

- Use string interpolation to enter variables in the config, like using the port in the shell command

- Remove PM2 and use this program to keep other processes running (after what options are needed has stabilized - is clustering needed?)

# server-test.ts

import \* as HTTP from 'node:http';
import { Observable, Subject } from 'rxjs';

/** Options used to configure a new HTTPServer Asset \*/
interface ServerOptions {
/** Identifies this server _/
name: string
/\*\* Port to listen to _/
port: number
/\*_ (optional) The interface to listen on _/
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
