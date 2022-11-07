import * as HTTP from 'node:http';
import * as NET from 'node:net';

/** Ends a request with a OK message */
export const Ok = (_: HTTP.IncomingMessage, res: HTTP.ServerResponse, message: string) => {
  res.writeHead(200);
  res.end(message);
}

/** Ends a request with a Not Found message */
export const NotFound = (_: HTTP.IncomingMessage, res: HTTP.ServerResponse | NET.Socket) => {
  return end(res, 404, 'Not Found');
}

/** Ends a request with a Bad Request message */
export const BadRequest = (_: HTTP.IncomingMessage, res: HTTP.ServerResponse | NET.Socket) => {
  return end(res, 400, 'Bad Request');
}

/** Ends a request with a Redirection message */
export const Redirected = (_: HTTP.IncomingMessage, res: HTTP.ServerResponse, url: string) => {
  res.writeHead(302, { Location: url });
  res.end();
}


/** Utility method for ending either a ongoing Socket or an HTTP request */
const end = (res: HTTP.ServerResponse | NET.Socket, statusCode: number, message: string) => {

  if (!isSocket(res)) {
    res.statusCode = statusCode;
    res.writeHead(statusCode, { "Content-Type": "text/plain" });
  }
  res.end(`HTTP/1.1 ${statusCode} ${message}`);
}

/** Utlity method for determing whenver a variable is a Socket */
function isSocket(res: HTTP.ServerResponse | NET.Socket): res is NET.Socket {
  return (!(res as HTTP.ServerResponse).writeHead);
}