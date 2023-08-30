import * as Path from 'node:path';
import { HTTPServer } from '../http/';
import { REDIRECTION_PROXY_PORT } from '../config/settings';
import { NotFound, Redirected } from '../http/_handlers';

// Keep a reference to any previously created redirection proxy between re-reads of the apps.yaml
// so that it can be stopped gracefully
let cachedProxy: ReturnType < typeof HTTPServer > | null = null

/** Creates a http-server that redirects the given hostnames to new https addresses */
export async function startRedirectionProxy(redirects: Array < { from: Hostname, to: Hostname } > ) {

	// Stop any previously existing proxy
	if (cachedProxy) {
		cachedProxy.close();
	}

	// Create the server and cache it so that it can be closed later
	cachedProxy = HTTPServer({
		interface: 'localhost',
		port: REDIRECTION_PROXY_PORT,
		name: "Internal Redirection Server",
		on: {
			request: (req, res) => {
				for (const { from, to } of redirects) {
					if (req.headers.host?.includes(from)) {
						const targetUrl = req.url || '';
						const targetHref = 'https://' + Path.join(to, targetUrl).replace(/\\/g, '/');
						
						return Redirected(req, res, targetHref);
					}
				}
				
				return NotFound(req, res);
			}
		}
	});
}