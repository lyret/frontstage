import * as XMLRPC from "xmlrpc";
import { State } from "../state";

/** Keeps track of the last time the RPC API was called, to keep within the rate limit */
let lastCallTime = 0;

/** Keeps track of the number of api function calls performed within the current limit, 60 calls are allowed per minute */
let nrOfCalls = 0;

/** Keeps track of the number of domain searches performed within the current limit, 15 domain searches are allowed per minute */
let nrOfDomainSearches = 0;

/** The RPC client for Loopia */
const rpcClient = XMLRPC.createSecureClient("https://api.loopia.se/RPCSERV");

/**
 * Returns a list of all dns records from any connected Loopia account, fails if Loopia is not configured
 */
export async function getDNSRecordsFromLoopia() : Promise<Array<DNS.Record>> {
	const results = [];

	const domains = await getDomains();
	for (const domain of domains) {
		const subdomains = await getSubdomains(domain.domain);
		for (const subdomain of subdomains) {
			const zones = await getZoneRecords(domain.domain, subdomain);
			results.push(
				...zones.map((zone) => toDNSRecord(domain, subdomain, zone))
			);
		}
	}

	return results;
}

// INTERNAL METHODS

/** Creates a DNS Zone Record as identified in the manager from the given information from the Loopia API */
function toDNSRecord(domain: Domain, subdomain: string, zone: ZoneRecord) : DNS.Record {
	return {
		source: "loopia",
		id: zone.record_id,
		type: zone.type,
		domain: domain.domain,
		subdomain: subdomain,
		data: zone.rdata,
		priority: zone.priority,
		ttl: zone.ttl
	};
}
/** Creates objects typed for Loopia from a manager DNS Zone Record */
function toLoopiaObjects(record: DNS.Record) : [domain: string, subdomain: string, zone: ZoneRecord] {
	return [record.domain, record.subdomain, {
		record_id: record.id,
		type: record.type,
		rdata: record.data,
		priority: record.priority,
		ttl: record.ttl
	}];
}

/**
 * Calls the getDomains remote function
 * @link https://www.loopia.se/api/getdomains/
 */
async function getDomains(): Promise<Array<Domain>> {
	return callLoopiaRPC("getDomains", []);
}

/**
 * Calls the getDomain remote function
 * @link https://www.loopia.se/api/getdomain/
 */
async function getDomain(domain: string): Promise<Domain> {
	return callLoopiaRPC("getDomain", [domain]);
}

/**
 * Calls the domainIsFree remote function
 * @link https://www.loopia.se/api/domainisfree/
 */
async function domainIsFree(domain: string): Promise<Status> {
	return callLoopiaRPC("domainIsFree", [domain], true);
}

/**
 * Calls the getSubdomains remote function
 * @link https://www.loopia.se/api/getsubdomains/
 */
async function getSubdomains(domain: string): Promise<Array<string>> {
	return callLoopiaRPC("getSubdomains", [domain]);
}

/**
 * Calls the addSubdomain remote function
 * @link https://www.loopia.se/api/addsubdomain/
 */
async function addSubdomain(
	domain: string,
	subdomain: string
): Promise<Status> {
	return callLoopiaRPC("addSubdomain", [domain, subdomain]);
}

/**
 * Calls the removeSubdomain remote function
 * @link https://www.loopia.se/api/removesubdomain/
 */
async function removeSubdomain(
	domain: string,
	subdomain: string
): Promise<Status> {
	return callLoopiaRPC("removeSubdomain", [domain, subdomain]);
}

/**
 * Calls the getZoneRecords remote function
 * @link https://www.loopia.se/api/getzonerecords/
 */
async function getZoneRecords(
	domain: string,
	subdomain: string
): Promise<Array<ZoneRecord>> {
	return callLoopiaRPC("getZoneRecords", [domain, subdomain]);
}

/**
 * Calls the addZoneRecord remote function
 * @link https://www.loopia.se/api/addzonerecord/
 */
async function addZoneRecord(
	domain: string,
	subdomain: string,
	zone: ZoneRecord
): Promise<Status> {
	return callLoopiaRPC("addZoneRecord", [domain, subdomain, zone]);
}

/**
 * Calls the updateZoneRecord remote function
 * @link https://www.loopia.se/api/updatezonerecord/
 */
async function updateZoneRecord(
	domain: string,
	subdomain: string,
	zone: ZoneRecord
): Promise<Status> {
	return callLoopiaRPC("updateZoneRecord", [domain, subdomain, zone]);
}

/**
 * Calls the removeZoneRecord remote function
 * @link https://www.loopia.se/api/removezonerecord/
 */
async function removeZoneRecord(
	domain: string,
	subdomain: string,
	zoneId: number
): Promise<Status> {
	return callLoopiaRPC("removeZoneRecord", [domain, subdomain, zoneId]);
}

/**
 * Calls a remote function on the Loopia server with the given arguments,
 * The API is limited to 60 calls per minute, and 15 domain searches per minute,
 * this method waits for
 */
async function callLoopiaRPC<ReturnType>(
	functionName: string,
	args: Array<any> = [],
	isADomainSearch: boolean = false
) {
	const timeSinceLastRequest = Date.now() - lastCallTime;

	// The last API call was a long time ago
	if (timeSinceLastRequest > 1000) {
		nrOfCalls = 0;
		nrOfDomainSearches = 0;
	}
	// A limit has been reached, wait for the limit to reset
	else if (nrOfCalls > 60 || nrOfDomainSearches > 15) {
		const timeToWait = 1000 - timeSinceLastRequest;
		await new Promise((resolve) => setTimeout(resolve, timeToWait));
		nrOfCalls = 0;
		nrOfDomainSearches = 0;
	}

	// Increase the count of calls
	nrOfCalls = nrOfCalls + 1;
	if (isADomainSearch) {
		nrOfDomainSearches = nrOfDomainSearches + 1;
	}

	// Check that Loopia credentials are configured
	if (!State.Manager.dns_records.loopia) {
		console.log(State.Manager.dns_records);
		throw new Error("Loopia is not enabled");
	}

	// Get the configured username and password for the Loopia API */
	const username = State.Manager.dns_records.loopia!.username;
	const password = State.Manager.dns_records.loopia!.password;

	// Call the API
	return new Promise<ReturnType>((resolve, reject) => {
		rpcClient.methodCall(
			functionName,
			[username, password, ...args],
			async (error, result) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			}
		);
	});
}

// TYPES

/**
 * A error code when returned from the api server when function call does not succeed.
 * - 404 Unknown error.
 * - 401 Incorrect login credentials.
 * - 429 Limit has been exceeded.
 * - 620 Method does not exist.
 * - 623 Request parameters do not match the signature.
 * - 631 The request could not be completed. The request is invalid.
 * - 632 Invalid request, no method was performed; the request must include ‘methodName’.
 * - 633 Parameters must include a value.
 * - 634 Incorrect method name.
 * - 637 One of the parameters is not valid.
 * - 639 The method is not allowed for the user.
 * - 40001 Domain is not available.
 * - 40004 Domain is not valid.
 * - 40011 Domain configuration is not valid.
 * - 40014 Account type is not valid.
 * - 40015 Domain configuration is not available for this account type.
 * - 40401 Customer is not associated with a reseller.
 * - 50001 Account parameters are not valid.
 * - 60001 Insufficient funds.
 */
type ErrorCode =
	| 404
	| 401
	| 429
	| 620
	| 623
	| 631
	| 632
	| 633
	| 634
	| 637
	| 639
	| 40001
	| 40004
	| 40011
	| 40014
	| 40015
	| 40401
	| 50001
	| 60001;

/**
 * A Status message returned from function calls that does return any data
 *  - OK: Everything is ok.
 *  - AUTH_ERROR: Wrong username or password.
 *  - DOMAIN_OCCUPIED: The domain name is not available for registration.
 *  - RATE_LIMITED: The maximum number of method calls per time period has been reached.
 *  - BAD_INDATA: One or more parameters have invalid values.
 *  - UNKNOWN_ERROR: Something else went wrong and the action has not been completed.
 *  - INSUFFICIENT_FUNDS: There are not enough funds in the chosen currency to carry out the  * transaction.
 */
type Status =
	| "OK"
	| "AUTH_ERROR"
	| "DOMAIN_OCCUPIED"
	| "RATE_LIMITED"
	| "BAD_INDATA"
	| "UNKNOWN_ERROR"
	| "INSUFFICIENT_FUNDS";

/**
 * A Domain Object
 * @link https://www.loopia.se/api/domain_obj/
 */
type Domain = {
	/** Domain name */
	domain: string;
	/** Payment status for the domain on Loopia */
	paid: boolean;
	/** Registration status for the domain on Loopia) */
	registred: boolean;
	/** Renewal status for the domain */
	renewal_status: string;
	/** Expiration date for the domain on Loopia */
	experiation_date: string;
	/** Reference number */
	reference_no: number;
};

/**
 * A DNS-Zone record as identified by Loopia, not to be identified by 
 * the managers DNS.Record type
 * @link https://www.loopia.se/api/record_obj/
 */
type ZoneRecord = {
	/** Record id */
	record_id: number;
	/** Record type */
	type: string;
	/** Time to live */
	ttl: number;
	/** Priority for MX records */
	priority: number;
	/** Record data entry */
	rdata: string;
};
