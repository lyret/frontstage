import { State } from "../state";
import * as Colors from "colors/safe";

/** Registry of available log levels */
export const LogLevels = {
  operation: { level: 70, color: Colors.grey, name: "Trace" },
  trace: { level: 60, color: Colors.grey, name: "Trace" },
  debug: { level: 50, color: Colors.blue, name: "Debug" },
  info: { level: 40, color: Colors.green, name: "Info" },
  success: { level: 35, color: Colors.green, name: "Success" },
  warn: { level: 30, color: Colors.yellow, name: "Warning" },
  err: { level: 20, color: Colors.red, name: "Error" },
  fatal: { level: 10, color: Colors.bgRed, name: "Fatal Error" },
};

/** A type of function used to output to stdout */
type LogFunction = (message: string, data?: any) => void;

/** A type of function used to output to stderr */
type ErrorLogFunction = (
  message: string,
  error?: Error | unknown | undefined,
  data?: any
) => void;

/** Utility method that outputs a message and optionally included data at the predetermined log level and context */
function output(
  message: string,
  data: any,
  context: string,
  { level, color, name }: (typeof LogLevels)["debug"]
) {
  // Do not output anything if disabled by the configured log level
  if (!State.Initialized || level > State.Manager.logging.level) {
    return;
  }

  const time = new Date().toLocaleString();
  const output = `${Colors.bold(`${context} ${name}:`)} ${color(
    message
  )} ${JSON.stringify({ time, ...data })}`;

  if (level <= 20) {
    console.error(output);
  } else if (level <= 30) {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/** Utility method that returns a function used for logging at the specified log level */
function createLogFunction(
  type: keyof typeof LogLevels,
  context: string
): LogFunction {
  return (message: string, data: any = {}) =>
    output(message, data, context, LogLevels[type]);
}

/** Utility method that returns a function used for logging an error at the specified log level */
function createErrorLogFunction(
  type: keyof typeof LogLevels,
  context: string
): ErrorLogFunction {
  return (
    message: string,
    error: Error | unknown | undefined,
    data: any = {}
  ) =>
    output(
      `${message} [${(error as Error)?.toString()}]`,
      data,
      context,
      LogLevels[type]
    );
}

/**
 * Creates a logger object for printing to stout/sterr
 * At creation the name is given, useful for
 * identifying the current context of the system
 *
 * @param Name or Context for identifying where the logs are coming from
 */
export function createLogger(name: string): {
  /** Outputs database operations information */
  operation: LogFunction;
  /** Outputs trace information */
  trace: LogFunction;
  /** Outputs debug information */
  debug: LogFunction;
  /** Outputs general information */
  info: LogFunction;
  /** Outputs information for successful operations */
  success: LogFunction;
  /** Outputs a warning */
  warn: LogFunction;
  /** Outputs an error */
  error: ErrorLogFunction;
  /** Outputs a fatal error */
  fatal: ErrorLogFunction;
} {
  return {
    operation: createLogFunction("operation", name),
    trace: createLogFunction("trace", name),
    debug: createLogFunction("debug", name),
    info: createLogFunction("info", name),
    success: createLogFunction("success", name),
    warn: createLogFunction("warn", name),
    error: createErrorLogFunction("err", name),
    fatal: createErrorLogFunction("fatal", name),
  };
}
