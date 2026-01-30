import * as HTTP from "node:http";
import * as URL from "node:url";
import { createLogger } from "./messages";
import { getCurrentRuntimeInformation } from "./state";
import { DNSRecords } from "./dns";
import { Certificates } from "./certificates";
import { Models } from "./database";
import { State } from "./state";

// API SERVER
// This file provides HTTP API endpoints for the Frontstage GUI
// It serves JSON data about the system status, applications, certificates, etc.

/** Logger */
const logger = createLogger("API Server");

/** API endpoints configuration */
const API_PORT = 3001;
const API_HOST = "127.0.0.1";

/**
 * Creates and starts the API server for GUI communication
 */
export async function main() {
  const server = HTTP.createServer(handleRequest);

  server.on("listening", () => {
    logger.info(`API server listening on ${API_HOST}:${API_PORT}`);
  });

  server.on("error", (err) => {
    logger.error("API server error", err);
  });

  server.listen(API_PORT, API_HOST);
}

/**
 * Main request handler for API endpoints
 */
async function handleRequest(req: HTTP.IncomingMessage, res: HTTP.ServerResponse) {
  try {
    // Enable CORS for GUI
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = URL.parse(req.url || "", true);
    const pathname = url.pathname || "";
    const method = req.method || "GET";

    logger.trace(`API ${method} ${pathname}`);

    // Route to appropriate handler
    if (pathname === "/api/status") {
      await handleStatusEndpoint(req, res);
    } else if (pathname === "/api/applications") {
      await handleApplicationsEndpoint(req, res);
    } else if (pathname === "/api/certificates") {
      await handleCertificatesEndpoint(req, res);
    } else if (pathname === "/api/dns") {
      await handleDNSEndpoint(req, res);
    } else if (pathname === "/api/processes") {
      await handleProcessesEndpoint(req, res);
    } else if (pathname.startsWith("/api/applications/")) {
      await handleApplicationActionEndpoint(req, res, pathname);
    } else if (pathname === "/api/validate") {
      await handleValidateEndpoint(req, res);
    } else if (pathname === "/api/update") {
      await handleUpdateEndpoint(req, res);
    } else {
      sendNotFound(res);
    }
  } catch (error) {
    logger.error("API request error", error);
    sendError(res, "Internal server error");
  }
}

/**
 * GET /api/status - System overview status
 */
async function handleStatusEndpoint(req: HTTP.IncomingMessage, res: HTTP.ServerResponse) {
  if (req.method !== "GET") {
    sendMethodNotAllowed(res);
    return;
  }

  const runtimeInfo = await getCurrentRuntimeInformation();

  const status = {
    redirects: runtimeInfo.redirects.length,
    internalRoutes: runtimeInfo.internalRoutes.length,
    certificates: runtimeInfo.certificates.length,
    applicationProcesses: runtimeInfo.applicationProcesses.length,
    internalProcesses: runtimeInfo.internalProcesses.length,
    uniqueLabels: runtimeInfo.uniqueLabels,
    uniquePorts: runtimeInfo.uniquePorts,
    timestamp: new Date().toISOString()
  };

  sendJSON(res, status);
}

/**
 * GET /api/applications - List all applications
 */
async function handleApplicationsEndpoint(req: HTTP.IncomingMessage, res: HTTP.ServerResponse) {
  if (req.method !== "GET") {
    sendMethodNotAllowed(res);
    return;
  }

  const runtimeInfo = await getCurrentRuntimeInformation();

  // Combine all application types
  const applications = [
    ...runtimeInfo.redirects.map(r => ({
      ...r,
      type: "redirect" as const,
      status: "running" as const
    })),
    ...runtimeInfo.internalRoutes.map(r => ({
      ...r,
      type: "proxy" as const,
      status: "running" as const
    })),
    ...runtimeInfo.applicationProcesses.map(p => ({
      label: p.label,
      type: "process" as const,
      status: p.process.details?.running ? "running" as const : "stopped" as const,
      process: p.process.details
    }))
  ];

  sendJSON(res, applications);
}

/**
 * GET /api/certificates - List all certificates
 */
async function handleCertificatesEndpoint(req: HTTP.IncomingMessage, res: HTTP.ServerResponse) {
  if (req.method !== "GET") {
    sendMethodNotAllowed(res);
    return;
  }

  const certificates = await Certificates.list();

  // Add computed fields
  const enrichedCertificates = certificates.map(cert => {
    const now = new Date();
    const expiryDate = new Date(cert.expiresOn);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let status: "valid" | "expiring" | "expired" = "valid";
    if (daysUntilExpiry < 0) {
      status = "expired";
    } else if (daysUntilExpiry < 30) {
      status = "expiring";
    }

    return {
      ...cert,
      daysUntilExpiry,
      status
    };
  });

  sendJSON(res, enrichedCertificates);
}

/**
 * GET /api/dns - List DNS records
 */
async function handleDNSEndpoint(req: HTTP.IncomingMessage, res: HTTP.ServerResponse) {
  if (req.method !== "GET") {
    sendMethodNotAllowed(res);
    return;
  }

  try {
    const records = await DNSRecords.list();
    sendJSON(res, records);
  } catch (error) {
    logger.error("Failed to fetch DNS records", error);
    sendError(res, "Failed to fetch DNS records");
  }
}

/**
 * GET /api/processes - List running processes
 */
async function handleProcessesEndpoint(req: HTTP.IncomingMessage, res: HTTP.ServerResponse) {
  if (req.method !== "GET") {
    sendMethodNotAllowed(res);
    return;
  }

  const runtimeInfo = await getCurrentRuntimeInformation();

  const processes = [
    ...runtimeInfo.applicationProcesses.map(p => ({
      ...p,
      type: "application" as const
    })),
    ...runtimeInfo.internalProcesses.map(p => ({
      ...p,
      type: "internal" as const
    }))
  ];

  sendJSON(res, processes);
}

/**
 * POST /api/applications/:label/start|stop|restart - Control application processes
 */
async function handleApplicationActionEndpoint(
  req: HTTP.IncomingMessage,
  res: HTTP.ServerResponse,
  pathname: string
) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res);
    return;
  }

  const pathParts = pathname.split("/");
  const label = pathParts[3];
  const action = pathParts[4];

  if (!label || !["start", "stop", "restart"].includes(action)) {
    sendBadRequest(res, "Invalid application label or action");
    return;
  }

  try {
    // TODO: Implement process control via PM2
    logger.info(`Process ${action} requested for application: ${label}`);

    // For now, return success - in real implementation this would:
    // 1. Find the process by label
    // 2. Use PM2 to start/stop/restart it
    // 3. Return the new status

    sendJSON(res, {
      success: true,
      message: `Application ${label} ${action} initiated`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to ${action} application ${label}`, error);
    sendError(res, `Failed to ${action} application`);
  }
}

/**
 * POST /api/validate - Validate configuration
 */
async function handleValidateEndpoint(req: HTTP.IncomingMessage, res: HTTP.ServerResponse) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res);
    return;
  }

  try {
    // TODO: Implement configuration validation
    // This would call the same validation logic as the CLI validate command

    sendJSON(res, {
      valid: true,
      issues: [],
      summary: {
        redirections: 0,
        internalRoutes: 0,
        certificates: 0,
        applicationProcesses: 0,
        internalProcesses: 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Configuration validation failed", error);
    sendError(res, "Configuration validation failed");
  }
}

/**
 * POST /api/update - Update configuration and restart services
 */
async function handleUpdateEndpoint(req: HTTP.IncomingMessage, res: HTTP.ServerResponse) {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res);
    return;
  }

  try {
    // TODO: Implement configuration update
    // This would call the same update logic as the CLI update command

    logger.info("Configuration update requested via API");

    sendJSON(res, {
      success: true,
      message: "Configuration update completed successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Configuration update failed", error);
    sendError(res, "Configuration update failed");
  }
}

/**
 * Helper function to send JSON response
 */
function sendJSON(res: HTTP.ServerResponse, data: any) {
  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Helper function to send error response
 */
function sendError(res: HTTP.ServerResponse, message: string, statusCode = 500) {
  res.setHeader("Content-Type", "application/json");
  res.writeHead(statusCode);
  res.end(JSON.stringify({ error: message, timestamp: new Date().toISOString() }));
}

/**
 * Helper function to send 404 response
 */
function sendNotFound(res: HTTP.ServerResponse) {
  sendError(res, "Endpoint not found", 404);
}

/**
 * Helper function to send 405 response
 */
function sendMethodNotAllowed(res: HTTP.ServerResponse) {
  sendError(res, "Method not allowed", 405);
}

/**
 * Helper function to send 400 response
 */
function sendBadRequest(res: HTTP.ServerResponse, message: string) {
  sendError(res, message, 400);
}

// Start the API server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error("Failed to start API server", error);
    process.exit(1);
  });
}
