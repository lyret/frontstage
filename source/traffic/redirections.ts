import * as HTTP from "node:http";
import * as Path from "node:path";
import * as Output from "./httpHandlers";
import { Models } from "../database";
import { createLogger } from "../messages";

/** Logger */
const logger = createLogger("Redirections");

/**
 * Handles operations that needs to be performed on redirections
 */
export async function performOperations(
  operations: Manager.Operations["redirections"]
) {
  const db = await Models.Redirections();

  // Destroy all removed entries
  for (const redirection of operations.removed) {
    await db.destroy({
      where: { hostname: redirection.hostname },
    });
    logger.warn(
      `Removed the redirection from ${redirection.hostname} to ${redirection.target}`
    );
  }

  // Update all moved entries
  for (const redirection of operations.moved) {
    await db.update(redirection, { where: { hostname: redirection.hostname } });
    logger.success(
      `Updated the redirection from ${redirection.hostname} to ${redirection.target}`
    );
  }

  // Add new entries
  for (const redirection of operations.added) {
    await db.create(redirection);
    logger.success(
      `Added a redirection from ${redirection.hostname} to ${redirection.target}`
    );
  }
}

/**
 * Respond to a http(s) request with an redirection to an external URL if
 * there is a redirection configuration available
 * Returns true if the request was handled and false otherwise
 */
export async function handleHTTPRequest(
  hostname: string,
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse
): Promise<boolean> {
  const redirection = await get(hostname);
  if (!redirection) {
    logger.trace(`No redirection exists for the hostname ${hostname}`);
    return false;
  }
  if (!req.headers.host?.includes(redirection.hostname)) {
    throw new Error("The host header does not match " + hostname);
  }

  // Handle the redirection
  const targetUrl = req.url || "";
  const targetHref =
    "https://" + Path.join(redirection.target, targetUrl).replace(/\\/g, "/");

  Output.Redirected(req, res, targetHref);
  return true;
}

/**
 * Returns a single registered redirection, if it exists
 */
async function get(hostname: string): Promise<Routes.Redirection | undefined> {
  const db = await Models.Redirections();
  const result = await db.findOne({ where: { hostname } });
  return result?.toJSON();
}
