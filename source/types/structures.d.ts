export {};

/**
 * Contains global type definitions for various data structures
 * used throughout the server manager
 */
declare global {
	/**
	 * Type definitions for the internal state
	 * of the server manager
	 */
	namespace State {
		/** The available configuration objects kept in the database */
		type StoredConfigurations = {
			manager_configuration: Configuration.Manager;
			application_configuration: Array<Configuration.Application>;
			network_configuration: Configuration.Network;
		};

		/**
		 * Operations necessary to perform after changes are made
		 * in the configuration
		 */
		type Operations = {
			redirections: {
				added: Array<Routes.Redirection>;
				removed: Array<Routes.Redirection>;
				moved: Array<Routes.Redirection>;
			};
			internalRoutes: {
				added: Array<Routes.InternalRoute>;
				removed: Array<Routes.InternalRoute>;
				moved: Array<Routes.InternalRoute>;
			};
			certificates: {
				added: Array<{
					label: string;
					renewalMethod: Certificates.LoadedCertificate["renewalMethod"];
					hostname: string;
				}>;
				removed: Array<{
					label: string;
					renewalMethod: Certificates.LoadedCertificate["renewalMethod"];
					hostname: string;
				}>;
				moved: Array<{
					label: string;
					renewalMethod: Certificates.LoadedCertificate["renewalMethod"];
					hostname: string;
				}>;
			};
			internalProcesses: {
				start: Array<{
					label: string;
					process: Process.Options;
				}>;
				restart: Array<{
					label: string;
					process: Process.Options;
				}>;
				remove: Array<{
					label: string;
					process: Process.Options;
				}>;
			};
			applicationProcesses: {
				start: Array<{
					label: string;
					process: Required<Process.Options>;
				}>;
				restart: Array<{
					label: string;
					process: Required<Process.Options>;
				}>;
				remove: Array<string>;
			};
		};
	}

	/**
	 * Type definitions for broadcasted messages
	 */
	namespace Messages {
		/**
		 * A operation queued to be performed on the included timestamp
		 */
		type ScheduledOperation<T = {}> = {
			/** The UNIX timestamp for when the operation should be run */
			timestamp: number;
			/** Indicates that the operation has been performed */
			performed: boolean;
			/**
			 * If an ID is given the scheduled operation is considered unique
			 * in the queue, any operation added with the same ID will replace
			 * any previous ones
			 */
			id?: string;
		} & T;

		/**
		 * An operation that renews the given certificate hostname
		 */
		type ScheduledCertificateRenewal = ScheduledOperation<{
			/* Only one certificate renewal operation
			 * should be scheduled at the same time,
			 * so id must be the same
			 */
			id: "certificate-renewal";
		}>;
	}

	/**
	 * Type definitions for dns records
	 */
	namespace DNS {
		
		/** A Zone Record as communicated though out the manager */
		type Record = {
			/** Id for referencing external services */
			id: number;
			/** Source for the record, i.e external service */
			source: "loopia";
			/** Type of record type */
			type: string;
			/** Subdomain name */
			subdomain: string;
			/** Domain name */
			domain: string;
			/** Time to live, if applicable */
			ttl: number;
			/** Priority for MX records */
			priority: number;
			/** Record data entry */
			data: string;
		}
		
	}

	/**
	 * Type definitions for configurations effecting of the server manager
	 */
	namespace Configuration {
		/** Configuration for the enabled server manager functionality */
		type Manager = {
			/** Configuration options for how to handle logs from internal server manager processes */
			logging: {
				/**
				 * The verbosity of output that should be emitted by the manager
				 * 10: Outputs on fatal exceptions
				 * 20: Also outputs on non-fatal errors
				 * 30: Also outputs warnings
				 * 40: Also outputs generally useful information from the manager processes
				 * 50: Also outputs additional trace information
				 * 60: Also outputs information useful for debugging
				 */
				level: number;
			};
			/** Configuration options for how to handle incoming web traffic */
			web_traffic: {
				/** enables incoming request using HTTP */
				use_http: boolean;
				/** The port to use for incoming HTTP requests */
				http_port: number;
				/** The network interface to to listen on for HTTP */
				http_host: string;
				/** Enabled the manager to listen to incoming HTTPS request, will also redirect all http requests to https if enabled */
				use_https: boolean;
				/** The port to use for incoming HTTPS requests */
				https_port: number;
				/** The network interface to to listen on for HTTPS */
				https_host: string;
				/**
				 * If the server manager is behind any additional routers this
				 * settings is used for reverse routing using the x-forwarded-host header,
				 * instead of the one from the previous proxy the request passed through
				 */
				use_forwarded_host: boolean;
			};
			/** Configuration options for how to manage web encryption certificates */
			certificates: {
				/** Configuration options for enabling the creation of self signed certificates */
				self_signed_certificates: {
					country: string;
					state: string;
					locality: string;
					organization: string;
				};
				/** Configuration options for enabling requesting certificates from Lets Encrypt */
				lets_encrypt?: {
					/**
					 * When disabled the Lets Encrypts staging servers are used instead of production
					 *
					 * If too many failed requests are made to the Lets Encrypt
					 * production servers, the account will be
					 * blocked for a period of time.
					 * Only enable using the production servers
					 * once the application server is confirmed to be reachable and
					 * requests are processed correctly
					 */
					use_production_server: boolean;
					/** The contact email for when registering certificates using lets encrypt */
					contact_email?: string;
				};
			};
			/** Configuration options for how to manage dns records */
			dns_records: {
				/** Additional configuration that enables reading and updating of dns records from Loopia */
				loopia?: {
					/** The username to use when communicating with Loopia */
					username: string;
					/** The password to use when communicating with Loopia */
					password: string;
				};
			};
			/** Configuration options for how to manage running daemon processes of configured applications */
			daemons: {
				root_directory: string;
			};
		};

		/**
		 * Configuration for a managed application
		 */
		type Application = {
			/** Unique identifying name for this application */
			label: string;
			/** A single hostname to use for routing traffic to this application */
			hostname?: Hostname;
			/** A list of several hostnames to use for routing traffic to this application */
			hostnames?: Array<Hostname>;
			/** The renewal method for certificates for hostname(s) of the application */
			certificates: Certificates.LoadedCertificate["renewalMethod"];
			/** (Optional) URL to route incoming web traffic to */
			redirect: string;
			/** (Optional) Directory to serve static files from */
			serve: string;
			/** (Optional) Port to use for internal routing on the same server */
			port: number;
			/**
			 * (Optional) Description for running a program/shell script
			 * as a background processes on the runtime machine
			 */
			// TODO: Document
			process: Omit<Process.Options, "namespace">;
		};

		/**
		 * The current network configuration
		 * for the runtime machine of the server manager
		 */
		type Network = {
			/** The public internet ip-address of this machine */
			publicIp: string;
			/** List of loopback and LAN ip-addresses for this machine */
			internalIps: Array<string>;
			/** List of all ip-addresses that points to this router */
			allIps: Array<string>;
		};
	}

	/**
	 * Type definitions for running processes
	 */
	namespace Process {
		/**
		 * Sanitised process description of a process
		 * registred in PM2
		 */
		type Status = {
			/** Unique process name in PM2 */
			label: string;
			/** Unique process index for reference in PM2 */
			index: number;
			/** Unique process id on the runtime machine */
			pid: number;
			/** The namespace the process is running under in PM2 */
			namespace: string;
			/** Additional details of the process in PM2 */
			details: {
				/** The path to the script being executed */
				script: string;
				/** The arguments passed to the script FIXME: untested */
				args?: string;
				/** FIXME: untested */
				env?: any;
				/** FIXME: untested */
				intepreter?: any;
				/** The working directory the script is executed from */
				cwd: string;
				/** The number of restarts as reported by PM2 */
				restarts: number;
				/** The number of unstable restarts as reported by PM2 */
				unstable_restarts: number;
				/** The uptime for the process in PM2 */
				uptime: number;
				/** The timestamp for when the process was added to PM2 */
				createdAt: number;
				/** The running status of the process in PM2 */
				running: boolean;
				/** The amount of memory being used, as reported by PM2 */
				memory: number;
				/** The percentage of the CPU dedicated to this process, as reported by PM2 */
				cpu: number;
			};
		};

		/**
		 * Options for adding a new process to PM2
		 */
		type Options = {
			/** To what namespace this process should be added */
			namespace: string;
			/** The path to the script to execute */
			script: string;
			/** The path to the working directory to execute from */
			cwd: string;
			/**
			 * The interpreter to use for the script (eg “python”, “ruby”, “bash”, etc)
			 * The value “none” will execute the ‘script’ as a binary executable
			 */
			intepreter?: string | "none";
			/**
			 * A string of composed arguments to pass to the script
			 */
			args?: string;
			/** The environment variables to pass on to the process */
			env?: { [key: string]: string };
		};
	}

	/**
	 * Type definitions for certificates
	 */
	namespace Certificates {
		/** A certificate as stored in the database */
		type StoredCertificate = {
			/** Hostname this certificate is valid for */
			hostname: LoadedCertificate["hostname"];
			/** Label of the application configuration this certificate originated from */
			label: string;
			/** Method used to renew this certificate */
			renewalMethod: LoadedCertificate["renewalMethod"];
			/** The estimated datetime for the expiration of this certificates validity */
			expiresOn: LoadedCertificate["expiresOn"];
			/** The time in milliseconds, before expiration that the certificate should be renewed */
			renewWithin: LoadedCertificate["renewWithin"];
			/** The PEM certificate */
			certificate: string;
			/** The PEM private key */
			privateKey: string;
		};
		/**
		 * Certificate description for available and loaded certificates
		 */
		type LoadedCertificate = {
			/** Hostname this certificate is valid for */
			hostname: string;
			/** Method used to add and renew this certificate */
			renewalMethod: "lets-encrypt" | "self-signed" | "default";
			/** The time in milliseconds, before expiration that the certificate should be renewed */
			renewWithin: number;
			/** The date time for the expiration of this certificates validity */
			expiresOn: Date;
			/** The common name of the certificate */
			commonName: string;
			/** The context object used for https transport */
			secureContext: TLS.SecureContext;
		};
	}

	/**
	 * Type definitions for routing http traffic
	 */
	namespace Routes {
		/**
		 * Definition for an internal route behind the public server
		 * i.e. the information needed for forwarding a request
		 */
		type InternalRoute = {
			/** The hostname of the target, excluding protocol and port */
			hostname: string;
			/** Label of the application configuration this internal route originated from */
			label: string;
			/** The port of the target */
			port: number;
			/**
			 * Indicates that this target should be secured by HTTPS when forwarding
			 * effects the routing between the public server and the internal target,
			 * and not the public server directly
			 */
			secure?: boolean;
		};

		/**
		 * Definition of a redirection from a hostname to an external URL
		 */
		type Redirection = {
			/** Hostname to redirect from */
			hostname: string;
			/** Label of the application configuration this redirection originated from */
			label: string;
			/** Target URL to redirect to */
			target: string;
		};
	}
}
