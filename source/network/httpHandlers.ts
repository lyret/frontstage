import * as HTTP from "node:http";
import * as NET from "node:net";

// This file contains functions for handling common http requests
// in a uniform way

/** Ends a http request with a OK message */
export function Ok(
  _: HTTP.IncomingMessage,
  res: HTTP.ServerResponse,
  message: string
) {
  res.writeHead(200);
  res.end(message);
}

/** Ends a http request with a Not Found message */
export function NotFound(
  _: HTTP.IncomingMessage,
  res: HTTP.ServerResponse | NET.Socket
) {
  return end(res, 404, "Not Found");
}

/** Ends a http request with a Bad Request message */
export function BadRequest(
  _: HTTP.IncomingMessage,
  res: HTTP.ServerResponse | NET.Socket
) {
  return end(res, 400, "Bad Request");
}

/** Ends a request with a Redirection message */
export function Redirected(
  _: HTTP.IncomingMessage,
  res: HTTP.ServerResponse,
  url: string
) {
  res.writeHead(302, { Location: url });
  res.end();
}

/** Utility method for ending either a ongoing Socket or an HTTP request */
function end(
  res: HTTP.ServerResponse | NET.Socket,
  statusCode: number,
  message: string
) {
  // determine if the given response object is a Socket
  const isSocket: boolean = !(res as HTTP.ServerResponse).writeHead;

  if (!isSocket) {
    (res as HTTP.ServerResponse).statusCode = statusCode;
    (res as HTTP.ServerResponse).writeHead(statusCode, {
      "Content-Type": "text/plain",
    });
  }
  res.end(`HTTP/1.1 ${statusCode} ${message}`);
}
