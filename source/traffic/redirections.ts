import * as HTTP from "node:http";
import * as Path from "node:path";
import * as Output from "./httpHandlers";
import { createLogger } from "../statistics";

/** Logger */
const logger = createLogger("Redirections");

/** In memory collection of registered internal routes sorted by hostname */
const redirections = new Map<string, Routes.Redirection>();

/**
 * Finds a single registered redirection, if it exists
 */
export function find(hostname: string): Routes.Redirection | undefined {
  return redirections.get(hostname);
}

/** Loads a new redirection */
export async function add(redirection: Routes.Redirection) {
  redirections.set(redirection.hostname, redirection);

  logger.success(
    `Added an internal route between ${redirection.hostname} and ${redirection.target}`
  );
}

/** Respond to a http(s) request with an redirection to an external URL  */
export function handleHTTPRequest(
  hostname: string,
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
): void {
  const redirection = redirections.get(hostname);
  if (!redirection) {
    throw new Error("No redirection exists for the hostname " + hostname);
  }
  if (!req.headers.host?.includes(redirection.hostname)) {
    throw new Error("The host header does not match " + hostname);
  }

  const targetUrl = req.url || "";
  const targetHref =
    "https://" + Path.join(redirection.target, targetUrl).replace(/\\/g, "/");

  return Output.Redirected(req, res, targetHref);
}
