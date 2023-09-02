import * as Path from "node:path";
import * as PM2 from "pm2";

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
    PM2.restart(label, (err, proc: any) => {
      if (err) {
        reject(err);
      } else {
        // Wait 1 and then resolve
        setTimeout(() => resolve(transform(proc[0])), 1000);
      }
    });
  });
}

/**
 * Stops the process with the given label, if found
 */
export async function stop(label: string) {
  return new Promise<Process.Status>((resolve, reject) => {
    PM2.stop(label, (err, proc: any) => {
      if (err) {
        reject(err);
      } else {
        // Wait 1 and then resolve
        setTimeout(() => resolve(transform(proc[0])), 1000);
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
        // Wait 1 and then dump the current list of processes
        // then resolve
        setTimeout(() => {
          dump();
          resolve();
        }, 1000);
      }
    });
  });
}

/**
 * Start a new process with the given options
 */
async function start(label: string, options: Process.Options) {
  return new Promise<Process.Status>((resolve, reject) => {
    PM2.start({ name: label, ...options }, (err) => {
      if (err) {
        reject(err);
      } else {
        // Wait 1 for the process to start and then dump the current pm2 process list
        // so that its maintained on restart
        // Finally find the running process and resolve this operation.
        setTimeout(() => {
          dump();
          find(label).then((proc) => resolve(proc!));
        }, 1000);
      }
    });
  });
}

/**
 * Makes a hard restart of the given process if found, that is first delete it and then
 * re-add it with the given options - this allows environmental variables and execution
 * instructions to be changed
 */
async function hardrestart(
  label: string,
  options: Process.Options
): Promise<Process.Status> {
  const proc = await find(label);
  if (proc) {
    await remove(label);
  }
  return start(label, options);
}

// TODO: re-add?
// async function send({ pm_id }: PM2.Proc, topic: string, data: object = {}) {
//   return new Promise<void>((resolve, reject) => {
//     if (typeof pm_id === "undefined") {
//       reject(new Error("Process is missing field 'pm_id'"));
//       return;
//     }
//     PM2.sendDataToProcessId(
//       pm_id,
//       {
//         id: pm_id,
//         data,
//         topic,
//       },
//       (err) => {
//         if (err) {
//           reject(err);
//         } else {
//           // Listen to messages from application
//           PM2.launchBus((err, pm2_bus) => {
//             if (err) {
//               // TODO: needed here? PM2.disconnect();
//               reject(err);
//             } else {
//               pm2_bus.on("process:msg", (packet: any) => {
//                 console.log({ packet });
//                 pm2_bus.close();
//                 resolve();
//               });
//             }
//           });
//         }
//       }
//     );
//   });
// }

/**
 * Starts the manager as a background process in PM2,
 * or restarts it so that the latest build is used.
 *
 * Called to make sure that both PM2 and the daemon of the server
 * manager is running and is up-to-date.
 */
export async function bootstrap(): Promise<Process.Status> {
  await connect();

  // Start or restart the PM2 process of the server manager daemon
  return hardrestart(PROCESS_MANAGER_LABEL, {
    script: Path.resolve(SOURCE_DIRECTORY, PROCESS_MANAGER_SCRIPT),
    cwd: SOURCE_DIRECTORY,
    namespace: "lol3",
  } as any);
}

/**
 * Makes sure that the PM2 daemon is running and that
 * its possible to connect to it
 */
export async function connect() {
  return new Promise<void>((resolve, reject) => {
    PM2.connect((err) => {
      if (err) {
        reject();
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

/**
 * Dumps the current process list in PM2 to file so
 * that the same processes will be restored on restart
 */
export async function dump() {
  return new Promise<void>((resolve, reject) => {
    PM2.dump((err) => {
      if (err) {
        reject();
      } else {
        resolve();
      }
    });
  });
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
      status: p.pm2_env.status,
      memory: p.monit.memory,
      cpu: p.monit.cpu,
    },
  };
}
