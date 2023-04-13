import * as Path from "node:path";
import * as PM2 from "pm2";

/**
 */
async function connect() {
  return new Promise<boolean>((resolve, reject) => {
    PM2.connect((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}

async function list() {
  return new Promise<Array<PM2.ProcessDescription>>((resolve, reject) => {
    PM2.list((err, list) => {
      if (err) {
        reject(err);
      } else {
        resolve(list);
      }
    });
  });
}

async function find(name: string) {
  const processes = await list();
  const result = processes.find((process) => process.name == name);
  return result;
}

async function send({ pm_id }: PM2.Proc, topic: string, data: object = {}) {
  return new Promise<void>((resolve, reject) => {
    if (typeof pm_id === "undefined") {
      reject(new Error("Process is missing field 'pm_id'"));
      return;
    }
    PM2.sendDataToProcessId(
      pm_id,
      {
        id: pm_id,
        data,
        topic,
      },
      (err) => {
        if (err) {
          // TODO: needed here? PM2.disconnect();
          reject(err);
        } else {
          // Listen to messages from application
          PM2.launchBus((err, pm2_bus) => {
            if (err) {
              // TODO: needed here? PM2.disconnect();
              reject(err);
            } else {
              pm2_bus.on("process:msg", (packet: any) => {
                console.log({ packet });
                pm2_bus.close();
                resolve();
              });
            }
          });
        }
      }
    );
  });
}

async function restart(name: string) {
  return new Promise<PM2.Proc>((resolve, reject) => {
    PM2.restart(name, (err, proc: any) => {
      if (err) {
        // TODO: needed here? PM2.disconnect();
        reject(err);
      } else {
        // Output
        // TODO: console.log("\n> Restarted the Server Manager...");

        // Done
        resolve(proc[0]);
      }
    });
  });
}

async function start(options: PM2.StartOptions) {
  return new Promise<PM2.Proc>((resolve, reject) => {
    PM2.start(options, (err, proc) => {
      if (err) {
        // TODO: needed here? PM2.disconnect();
        reject(err);
      } else {
        // Output
        // TODO: console.log("\n> Restarted the Server Manager...");

        // Done
        resolve(proc);
      }
    });
  });
}

/**
 * Starts the manager as a background process in PM2,
 * or restarts it.
 *
 * Called to make sure the process-manager itself is
 * running and is up-to-date.
 */
export async function bootstrap() {
  return new Promise<PM2.Proc>(async (resolve, reject) => {
    try {
      await connect();
      let proc = await find(PROCESS_MANAGER_LABEL);

      // Start or restart the PM2 process of the manager
      if (proc) {
        proc = await restart(PROCESS_MANAGER_LABEL);
        console.log("sending!");
        await new Promise<void>((r) => setTimeout(() => r(), 1000));
        await send(proc, "restarted");
        resolve(proc);
      } else {
        proc = await start({
          name: PROCESS_MANAGER_LABEL,
          script: Path.resolve(SOURCE_DIRECTORY, "cli.mjs"),
          cwd: SOURCE_DIRECTORY,
        });
        resolve(proc);
      }
    } catch (err) {
      reject(err);
      // TODO: Output any errors
      // console.error("> Unable to demonize server-manager");
      //console.error("  its possble its already started\n");
    }
  });
}
