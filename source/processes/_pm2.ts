import * as PM2 from "pm2";
import { createLogger } from "../messages";

/** Logger */
const logger = createLogger("Processes");

/**
 * Get an array of all processes managed by PM2
 */
export async function list() {
  return new Promise<Array<Process.Status>>((resolve, reject) => {
    PM2.list((err, list) => {
      if (err) {
        reject(err);
      } else {
        resolve(list.map((proc) => transform(proc)));
      }
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
  return new Promise<Process.Status>((resolve, reject) => {
    PM2.restart(label, (err) => {
      if (err) {
        reject(err);
      } else {
        // Wait 1 and then resolve
        setTimeout(() => {
          find(label).then((proc) => {
            resolve(proc!);
          });
        });
      }
    });
  });
}

/**
 * Stops the process with the given label, if found
 */
export async function stop(label: string) {
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
      }
    });
  });
}

/**
 * If found deletes the process with the given label completely from pm2
 */
export async function remove(label: string) {
  return new Promise<void>((resolve, reject) => {
    PM2.delete(label, (err) => {
      if (err) {
        reject(err);
      } else {
        // Wait 1 and then resolve
        setTimeout(async () => {
          resolve();
        }, 1000);
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
  return new Promise<Process.Status>((resolve, reject) => {
    PM2.start({ name: label, ...options }, (err) => {
      if (err) {
        reject(err);
      } else {
        // Wait 1 for the process to start
        // to find the running process list
        setTimeout(() => {
          find(label).then((proc) => {
            resolve(proc!);
          });
        }, 1000);
      }
    });
  });
}

/**
 * Dumps the current process list in PM2 to file so
 * that the same processes will be restored on restart
 */
export async function dump() {
  return new Promise<void>((resolve) => {
    PM2.dump((err) => {
      if (err) {
        logger.error("Couldn't save process list in PM2", err);
        resolve();
      } else {
        resolve();
      }
    });
  });
}

/**
 * Makes sure that the PM2 daemon is running and that
 * its possible to connect to it
 */
export async function connect() {
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
export async function disconnect() {
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
