declare global {
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
  var LOG_LEVEL: number;

  // REVERSE ROUTER

  /**
   * When HTTPS is enabled the router will redirect http requests to https
   * and use the lets encrypt service to add certificates for any registered routes
   */
  var REVERSE_ROUTER_ENABLE_HTTPS: boolean;

  /** The port to use for incoming HTTP requests */
  var REVERSE_ROUTER_HTTP_PORT: number;

  /** The port to use for incoming HTTPS requests */
  var REVERSE_ROUTER_HTTPS_PORT: number;

  /** The network interface to to listen on */
  var REVERSE_ROUTER_HOST: string;

  /**
   * If the reverse router is behind any additional routers this
   * settings is useful for reverse routing using the x-forwarded-host header,
   * instead of the one from the previous proxy the request passed through
   */
  var REVERSE_ROUTER_PREFER_FORWARDED_HOST: boolean;

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
  var LETS_ENCRYPT_PRODUCTION: boolean = true;
  var LETS_ENCRYPT_SELF_SIGN_ENABLED: boolean = false;
  var LETS_ENCRYPT_EMAIL: string = "viktor@lyresten.se";
  var LETS_ENCRYPT_SELF_SIGN_COUNTRY: string = "Sweden";
  var LETS_ENCRYPT_SELF_SIGN_STATE: string = "Västra Götaland";
  var LETS_ENCRYPT_SELF_SIGN_LOCALITY: string = "Uddebo";
  var LETS_ENCRYPT_SELF_SIGN_ORGANIZATION: string = "Testgrupp";

  // REDIRECTION PROXY

  var REDIRECTION_PROXY_PORT: number;

  // PROCESS MANAGEMENT

  var PROCESS_MANAGER_LABEL: string;
  var PROCESS_MANAGER_SCRIPT: string;

  // PATHS

  var SOURCE_DIRECTORY: string;
  var APPS_DIRECTORY: string;
  var APPS_CONFIG_FILE: string;
}

export {};
