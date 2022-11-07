import * as Path from 'path';
// TODO: document

// RUNTIME ENVIRONMENT

export const PRODUCTION : boolean = false;


// LOGGING

/** 
 * The verbosity of output that should be emitted by the manager
 * 10: Outputs on fatal exceptions
 * 20: Also outputs on non-fatal errors
 * 30: Also outputs warnings
 * 40: Also outputs generally useful information from the manager processes
 * 50: Also outputs additional trace information
 * 60: Also outputs information useful for debugging
 */
export const LOG_LEVEL = 50;


// REVERSE ROUTER

/**
 * When HTTPS is enabled the router will redirect http requests to https
 * and use the lets encrypt service to add certificates for any registred routes
 */
export const REVERSE_ROUTER_ENABLE_HTTPS : boolean = true;

/** The port to use for incoming HTTP requests */
export const REVERSE_ROUTER_HTTP_PORT = 80;

/** The port to use for incoming HTTPS requests */
export const REVERSE_ROUTER_HTTPS_PORT = 443;

/** The network interface to to listen on */
export const REVERSE_ROUTER_HOST = "0.0.0.0";

/**
 * If the reverse router is behind any additional routers this
 * settings is useful for reverse routing using the x-forwarded-host header,
 * instead of the one from the previous proxy the request passed through
 */
export const REVERSE_ROUTER_PREFER_FORWARDED_HOST = false;

// LETS ENCRYPT

/** 
 * Use Lets Encrypts production servers to request certificates from
 *
 * If too many failed requests are made to the Lets Encrypt
 * production servers, the account will be 
 * blocked for a period of time.
 * Only start using the production servers
 * once the application server is confirmed to be reachable and
 * requests are processed correctly
 */
export const LETS_ENCRYPT_PRODUCTION : boolean = true;
export const LETS_ENCRYPT_SELF_SIGN_ENABLED : boolean = false;
export const LETS_ENCRYPT_EMAIL : string = "viktor@lyresten.se";
export const LETS_ENCRYPT_SELF_SIGN_COUNTRY : string = "Sweden";
export const LETS_ENCRYPT_SELF_SIGN_STATE : string = "Västra Götaland";
export const LETS_ENCRYPT_SELF_SIGN_LOCALITY : string = "Uddebo";
export const LETS_ENCRYPT_SELF_SIGN_ORGANZIATION : string = "Testgrupp";

// REDIRECTION PROXY

export const REDIRECTION_PROXY_PORT = 8001;
export const PROCESS_MANAGER_LABEL = "sys/server-manager";


// PATHS

const APPS_DIRECTORY = "..";
const DIST_DIRECTORY = ".dist";
const CERTIFICATE_DIRECTORY = ".certificates";


export const PATH_TO_MANAGER = Path.resolve(__dirname, "..");
export const PATH_TO_RUNTIME = Path.resolve(PATH_TO_MANAGER, DIST_DIRECTORY);
export const PATH_TO_EXECUTABLE = Path.resolve(PATH_TO_RUNTIME, "index.js");
export const PATH_TO_CERTIFICATES = Path.resolve(PATH_TO_MANAGER, CERTIFICATE_DIRECTORY);
export const PATH_TO_APPS = Path.resolve(PATH_TO_MANAGER, APPS_DIRECTORY);