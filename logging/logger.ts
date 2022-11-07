import { LOG_LEVEL } from '../config/settings';
import * as Colors from 'colors/safe';

/** Registry of available log levels */
export const LogLevels = {
  debug: { level: 60, color: Colors.blue, name: "Debug" },
  trace: { level: 50, color: Colors.grey, name: "Trace" },
  info: { level: 40, color: Colors.green, name: "Info" },
  warn: { level: 30, color: Colors.yellow, name: "Warning" },
  err: { level: 20, color: Colors.red, name: "Error" },
  fatal: { level: 10, color: Colors.bgRed, name: "Fatal Error" },
};

/**
 * Creates a logger asset for printing outputs to stout/sterr
 * At creation the name is given, useful for
 * identifying the current context of the system
 */
export const Logger : AssetGenerator<{
  /** The identifying name of this logger */
  name: string
}, {
  /** Outputs debug information */
  debug: LogFunction
  /** Outputs trace information */
  trace: LogFunction
  /** Outputs general information */
  info: LogFunction
  /** Outputs a warning */
  warn: LogFunction
  /** Outputs an error */
  error: ErrorLogFunction
  /** Outputs a fatal error */
  fatal: ErrorLogFunction
}> = (options) => {

  // Asset
  return ({
    debug: createLogFunction('debug', options.name),
    trace: createLogFunction('trace', options.name),
    info: createLogFunction('info', options.name),
    warn: createLogFunction('warn', options.name),
    error: createErrorLogFunction('err', options.name),
    fatal: createErrorLogFunction('fatal', options.name),
    close: () => {}
  });
}

/** Utility method that outputs a message and optionally included data at the predetermined log level and context */
const output = (
  message: string,
  data: any,
  context: string,
  { level, color, name } : typeof LogLevels['debug']
) => {
  // Do not output anything if disabled by the configured log level
  if (level > LOG_LEVEL) {
    return;
  }

  const time = new Date().toLocaleString();
  const output = `${Colors.bold(`${context} ${name}:`)} ${color(message)} ${JSON.stringify({ time, ...data })}`;

  if (level <= 20) {
    console.error(output);
  } else if (level <= 30) {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/** Utility method that returns a function used for logging at the specified log level */
const createLogFunction = (type: keyof typeof LogLevels, context: string) : LogFunction => (
  message: string,
  data: any = {}
) => output(message, data, context, LogLevels[type]);

/** Utility method that returns a function used for logging an error at the specified log level */
const createErrorLogFunction = (type: keyof typeof LogLevels, context: string) : ErrorLogFunction => (
  message: string,
  error: Error | unknown | undefined,
  data: any = {}
) => output(`${message} [${(error as Error)?.toString()}]`, data, context, LogLevels[type]);

/** A type of function used to output to stdout */
type LogFunction = (message : string, data?: any) => void

/** A type of function used to output to stderr */
type ErrorLogFunction = (message : string, error?: Error | unknown | undefined, data?: any) => void