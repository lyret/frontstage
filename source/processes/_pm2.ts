import * as Path from "node:path";
import * as PM2 from "pm2";
import { createLogger } from "../statistics";

/** Logger */
const logger = createLogger("Processes");

/**
 * Get an array of all processes managed by PM2
 */
export async function list() {
  await connect();
  return new Promise<Array<Process.Status>>((resolve, reject) => {
    PM2.list((err, list) => {
      if (err) {
        reject(err);
      } else {
        resolve(list.map((proc) => transform(proc)));
      }
      disconnect();
    });
  });
}

/**
 * Get a single process managed by PM2, if found
 */
export async function find(label: string): Promise<Process.Status | undefined> {
  const processes = await list();
  const result = processes.find((process) => process.label == label);
  return result;
}

/**
 * Restart the process with the given label, if found
 */
export async function restart(label: string) {
  await connect();
  return new Promise<Process.Status>((resolve, reject) => {
    PM2.restart(label, (err) => {
      if (err) {
        reject(err);
        disconnect();
      } else {
        // Wait 1 and then resolve
        setTimeout(() => {
          find(label).then((proc) => {
            resolve(proc!);
          });
        });
        disconnect();
      }
    });
  });
}

/**
 * Stops the process with the given label, if found
 */
export async function stop(label: string) {
  await connect();
  return new Promise<Process.Status>((resolve, reject) => {
    PM2.stop(label, (err) => {
      if (err) {
        reject(err);
      } else {
        // Wait 1 and then resolve
        setTimeout(() => {
          find(label).then((proc) => {
            resolve(proc!);
          });
        }, 1000);
        disconnect();
      }
    });
  });
}

/**
 * If found deletes the process with the given label completely from pm2
 */
export async function remove(label: string) {
  await connect();
  return new Promise<void>((resolve, reject) => {
    PM2.delete(label, (err) => {
      if (err) {
        reject(err);
        disconnect();
      } else {
        // Wait 1 and then resolve
        setTimeout(async () => {
          resolve();
        }, 1000);
        disconnect();
      }
    });
  });
}

/**
 * Start a new process with the given options, will restart the process
 * if it already exists and update env variables and other process options,
 * the options 'script', 'interpreter', 'namespace' and the label can not be changed and requires the process to be removed first
 */
export async function start(label: string, options: Process.Options) {
  await connect();
  return new Promise<Process.Status>((resolve, reject) => {
    PM2.start({ name: label, ...options }, (err) => {
      if (err) {
        reject(err);
        disconnect();
      } else {
        // Wait 1 for the process to start
        // to find the running process list
        setTimeout(() => {
          find(label).then((proc) => {
            resolve(proc!);
          });
        }, 1000);
        disconnect();
      }
    });
  });
}

/**
 * Opens a message bus to a process in PM2
 * and sends a message with the given topic and data.
 * returns true if successful
 * @param waitForResponse waits a response with status 200 before resolving
 */
export async function sendMessage(
  proc: Process.Status,
  topic: string,
  data: object = {},
  waitForResponse: boolean = false
) {
  await connect();
  return new Promise<boolean>((resolve, reject) => {
    PM2.sendDataToProcessId(
      proc.index,
      {
        id: proc.index,
        data,
        topic,
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          // Possibly listen to a response message from the process
          // should contain the data { status: 200 } to indicate success
          if (waitForResponse) {
            PM2.launchBus((err, pm2_bus) => {
              if (err) {
                reject(err);
              } else {
                pm2_bus.on(
                  "process:msg",
                  (packet: { data?: { status: any } }) => {
                    pm2_bus.close();
                    disconnect();

                    if (packet.data?.status && packet.data?.status == 200) {
                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  }
                );
              }
            });
          } else {
            resolve(true);
            disconnect();
          }
        }
      }
    );
  });
}

/**
 * Dumps the current process list in PM2 to file so
 * that the same processes will be restored on restart
 */
export async function dump() {
  await connect();
  return new Promise<void>((resolve) => {
    PM2.dump((err) => {
      if (err) {
        logger.error("Couldn't save process list in PM2", err);
        resolve();
      } else {
        resolve();
      }
      disconnect();
    });
  });
}

/**
 * Makes sure that the PM2 daemon is running and that
 * its possible to connect to it
 */
async function connect() {
  return new Promise<void>((resolve, reject) => {
    PM2.connect((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Disconnects from the PM2 daemon, needs to be called
 * to not keep the manager process running indefinitely
 */
async function disconnect() {
  PM2.disconnect();
}

/** Helper function that transforms a process description to PM2 to a standardised format */
function transform(proc: PM2.ProcessDescription | undefined): Process.Status {
  if (!proc) {
    return {
      label: "undefined",
      index: -1,
      pid: -1,
      namespace: "undefined",
    };
  }
  const p = proc as any;
  return {
    label: p.name,
    index: p.pm_id,
    pid: p.pid,
    namespace: p.pm2_env.namespace,
    details: {
      script: p.pm2_env.pm_exec_path,
      cwd: p.pm2_env.pm_cwd,
      restarts: p.pm2_env.restart_time,
      unstable_restarts: p.pm2_env.unstable_restarts,
      uptime: p.pm2_env.pm_uptime,
      createdAt: p.pm2_env.created_at,
      running: p.pm2_env.status == "online",
      memory: p.monit.memory,
      cpu: p.monit.cpu,
    },
  };
}
