import {
	ReverseRouter
} from '../http/';

// Keep a reference to any previously created reverse router server between re-reads of the apps.yaml
// so that it can be stopped gracefully
let cachedRouter : ReturnType<typeof ReverseRouter> | null = null

/** Create, start and add all given hostnames as routes to a reverse-router to their corresponding localhost ports */
export async function startReverseRouterServer(routes: Array < { hostname: Hostname, port: number } >) {

	// Stop any previously existing router
	if (cachedRouter) {
		cachedRouter.close();
	}
	
	// Create and and start the reverse proxy
	// and cache it
	const router = ReverseRouter();
	cachedRouter = router;
	
	// Add all routes that should be configured
	for (const { hostname, port } of routes) {

		router.addRoute(hostname, 'localhost', port, {
			useTargetHostHeader: false,
			secureOutbound: false
		});
	}
}