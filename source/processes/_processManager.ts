import * as ChildProcess from "node:child_process";
import * as Path from "node:path";
import * as OS from "node:os";
import * as FS from "node:fs/promises";
import { createLogger } from "../messages";
import { Models } from "../database";

/** Logger */
const logger = createLogger("Process Manager");

/** Map of running processes */
const runningProcesses = new Map<string, ManagedProcess>();

/** Process monitoring interval */
let monitoringInterval: NodeJS.Timeout | null = null;

/** Interface for managed process */
interface ManagedProcess {
  label: string;
  pid: number;
  process: ChildProcess.ChildProcess;
  options: Process.Options;
  startTime: Date;
  restarts: number;
  unstableRestarts: number;
  lastRestart: Date | null;
  monitoring: {
    memory: number;
    cpu: number;
  };
}

/**
 * Get an array of all processes managed by the process manager
 */
export async function list(): Promise<Array<Process.Status>> {
  const processes: Array<Process.Status> = [];

  for (const [label, managedProcess] of runningProcesses) {
    processes.push(transformToStatus(managedProcess));
  }

  return processes;
}

/**
 * Get a single process by label, if found
 */
export async function find(label: string): Promise<Process.Status | undefined> {
  const managedProcess = runningProcesses.get(label);
  return managedProcess ? transformToStatus(managedProcess) : undefined;
}

/**
 * Start a new process with the given options
 */
export async function start(label: string, options: Process.Options): Promise<Process.Status> {
  logger.info(`Starting process: ${label}`);

  // Stop existing process if running
  if (runningProcesses.has(label)) {
    await stop(label);
  }

  // Resolve script path
  const scriptPath = Path.resolve(options.cwd || ".", options.script);
  const workingDirectory = Path.resolve(options.cwd || ".");

  // Prepare spawn options
  const spawnOptions: ChildProcess.SpawnOptions = {
    cwd: workingDirectory,
    env: { ...process.env, ...options.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  };

  // Determine command and args
  let command: string;
  let args: string[] = [];

  if (options.interpreter) {
    command = options.interpreter;
    args = [options.script];
  } else {
    command = options.script;
  }

  if (options.args) {
    const additionalArgs = typeof options.args === 'string'
      ? options.args.split(' ').filter(arg => arg.trim())
      : options.args;
    args = args.concat(additionalArgs);
  }

  try {
    // Spawn the process
    const childProcess = ChildProcess.spawn(command, args, spawnOptions);

    if (!childProcess.pid) {
      throw new Error('Failed to start process - no PID assigned');
    }

    const managedProcess: ManagedProcess = {
      label,
      pid: childProcess.pid,
      process: childProcess,
      options,
      startTime: new Date(),
      restarts: 0,
      unstableRestarts: 0,
      lastRestart: null,
      monitoring: {
        memory: 0,
        cpu: 0
      }
    };

    // Set up process event handlers
    setupProcessHandlers(managedProcess);

    // Store the process
    runningProcesses.set(label, managedProcess);

    // Save process state to database
    await saveProcessState(managedProcess);

    // Start monitoring if not already running
    startMonitoring();

    logger.success(`Process started: ${label} (PID: ${childProcess.pid})`);
    return transformToStatus(managedProcess);

  } catch (error) {
    logger.error(`Failed to start process ${label}:`, error);
    throw error;
  }
}

/**
 * Stop a running process
 */
export async function stop(label: string): Promise<Process.Status> {
  logger.info(`Stopping process: ${label}`);

  const managedProcess = runningProcesses.get(label);
  if (!managedProcess) {
    throw new Error(`Process not found: ${label}`);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      // Force kill if graceful shutdown fails
      logger.warn(`Force killing process: ${label}`);
      managedProcess.process.kill('SIGKILL');
    }, 5000);

    managedProcess.process.once('exit', () => {
      clearTimeout(timeout);
      runningProcesses.delete(label);
      removeProcessState(label).catch(() => {}); // Don't fail on DB errors
      logger.success(`Process stopped: ${label}`);
      resolve(transformToStatus(managedProcess));
    });

    managedProcess.process.once('error', (error) => {
      clearTimeout(timeout);
      logger.error(`Error stopping process ${label}:`, error);
      reject(error);
    });

    // Send graceful shutdown signal
    managedProcess.process.kill('SIGTERM');
  });
}

/**
 * Restart a running process
 */
export async function restart(label: string): Promise<Process.Status> {
  logger.info(`Restarting process: ${label}`);

  const managedProcess = runningProcesses.get(label);
  if (!managedProcess) {
    throw new Error(`Process not found: ${label}`);
  }

  const options = managedProcess.options;
  await stop(label);

  // Wait a moment before restarting
  await new Promise(resolve => setTimeout(resolve, 1000));

  return await start(label, options);
}

/**
 * Remove a process completely
 */
export async function remove(label: string): Promise<void> {
  logger.info(`Removing process: ${label}`);

  if (runningProcesses.has(label)) {
    await stop(label);
  }

  await removeProcessState(label);
  logger.success(`Process removed: ${label}`);
}

/**
 * Initialize the process manager (replaces PM2 connect)
 */
export async function connect(): Promise<void> {
  logger.info("Initializing process manager");

  // Load saved process states from database
  await loadProcessStates();

  // Start monitoring
  startMonitoring();

  logger.success("Process manager initialized");
}

/**
 * Cleanup and shutdown (replaces PM2 disconnect)
 */
export async function disconnect(): Promise<void> {
  logger.info("Shutting down process manager");

  // Stop monitoring
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  // Stop all processes gracefully
  const stopPromises = Array.from(runningProcesses.keys()).map(label =>
    stop(label).catch(error => {
      logger.error(`Error stopping process ${label} during shutdown:`, error);
    })
  );

  await Promise.all(stopPromises);

  logger.success("Process manager shutdown complete");
}

/**
 * Save current process list to database for persistence
 */
export async function dump(): Promise<void> {
  logger.info("Saving process states");

  const savePromises = Array.from(runningProcesses.values()).map(managedProcess =>
    saveProcessState(managedProcess).catch(error => {
      logger.error(`Error saving process state for ${managedProcess.label}:`, error);
    })
  );

  await Promise.all(savePromises);
  logger.success("Process states saved");
}

/**
 * Set up event handlers for a managed process
 */
function setupProcessHandlers(managedProcess: ManagedProcess): void {
  const { label, process: childProcess } = managedProcess;

  // Handle process exit
  childProcess.on('exit', async (code, signal) => {
    logger.warn(`Process exited: ${label} (code: ${code}, signal: ${signal})`);

    runningProcesses.delete(label);

    // Check if this was an unexpected exit (crash)
    const uptime = Date.now() - managedProcess.startTime.getTime();
    const isUnstableRestart = uptime < 30000; // Less than 30 seconds

    if (isUnstableRestart) {
      managedProcess.unstableRestarts++;
    } else {
      managedProcess.restarts++;
    }

    // Auto-restart if process crashed (non-zero exit code)
    if (code !== 0 && code !== null) {
      // Don't restart if too many unstable restarts
      if (managedProcess.unstableRestarts >= 5) {
        logger.error(`Process ${label} has too many unstable restarts, not restarting`);
        await removeProcessState(label);
        return;
      }

      logger.info(`Auto-restarting crashed process: ${label}`);

      try {
        // Wait before restarting to prevent tight restart loops
        await new Promise(resolve => setTimeout(resolve, 2000));
        await start(label, managedProcess.options);
      } catch (error) {
        logger.error(`Failed to auto-restart process ${label}:`, error);
      }
    } else {
      // Clean exit, remove from database
      await removeProcessState(label);
    }
  });

  // Handle process errors
  childProcess.on('error', (error) => {
    logger.error(`Process error for ${label}:`, error);
  });

  // Log stdout/stderr
  if (childProcess.stdout) {
    childProcess.stdout.on('data', (data) => {
      logger.trace(`${label} [stdout]: ${data.toString().trim()}`);
    });
  }

  if (childProcess.stderr) {
    childProcess.stderr.on('data', (data) => {
      logger.trace(`${label} [stderr]: ${data.toString().trim()}`);
    });
  }
}

/**
 * Start process monitoring for resource usage
 */
function startMonitoring(): void {
  if (monitoringInterval) {
    return; // Already monitoring
  }

  monitoringInterval = setInterval(async () => {
    for (const managedProcess of runningProcesses.values()) {
      try {
        const stats = await getProcessStats(managedProcess.pid);
        managedProcess.monitoring = stats;
      } catch (error) {
        // Process might have died, monitoring will handle cleanup
      }
    }
  }, 5000); // Monitor every 5 seconds
}

/**
 * Get process statistics (memory, CPU)
 */
async function getProcessStats(pid: number): Promise<{ memory: number; cpu: number }> {
  try {
    if (process.platform === 'linux') {
      return await getLinuxProcessStats(pid);
    } else if (process.platform === 'darwin') {
      return await getMacProcessStats(pid);
    } else {
      // Fallback for other platforms
      return { memory: 0, cpu: 0 };
    }
  } catch (error) {
    return { memory: 0, cpu: 0 };
  }
}

/**
 * Get process stats on Linux
 */
async function getLinuxProcessStats(pid: number): Promise<{ memory: number; cpu: number }> {
  try {
    const statContent = await FS.readFile(`/proc/${pid}/stat`, 'utf8');
    const statusContent = await FS.readFile(`/proc/${pid}/status`, 'utf8');

    // Parse memory from status file
    const memoryMatch = statusContent.match(/VmRSS:\s+(\d+)\s+kB/);
    const memory = memoryMatch ? parseInt(memoryMatch[1]) * 1024 : 0; // Convert to bytes

    // CPU calculation would require previous values, for now return 0
    const cpu = 0;

    return { memory, cpu };
  } catch (error) {
    return { memory: 0, cpu: 0 };
  }
}

/**
 * Get process stats on macOS
 */
async function getMacProcessStats(pid: number): Promise<{ memory: number; cpu: number }> {
  return new Promise((resolve) => {
    ChildProcess.exec(`ps -o rss,pcpu -p ${pid}`, (error, stdout) => {
      if (error) {
        resolve({ memory: 0, cpu: 0 });
        return;
      }

      const lines = stdout.trim().split('\n');
      if (lines.length < 2) {
        resolve({ memory: 0, cpu: 0 });
        return;
      }

      const stats = lines[1].trim().split(/\s+/);
      const memory = parseInt(stats[0]) * 1024; // Convert KB to bytes
      const cpu = parseFloat(stats[1]);

      resolve({ memory: memory || 0, cpu: cpu || 0 });
    });
  });
}

/**
 * Transform ManagedProcess to Process.Status
 */
function transformToStatus(managedProcess: ManagedProcess): Process.Status {
  const uptime = Date.now() - managedProcess.startTime.getTime();
  const isRunning = !managedProcess.process.killed && managedProcess.process.exitCode === null;

  return {
    label: managedProcess.label,
    index: 0, // Not used in our implementation
    pid: managedProcess.pid,
    namespace: managedProcess.options.namespace || 'default',
    details: {
      script: managedProcess.options.script,
      cwd: managedProcess.options.cwd || process.cwd(),
      args: managedProcess.options.args,
      env: managedProcess.options.env,
      interpreter: managedProcess.options.interpreter,
      restarts: managedProcess.restarts,
      unstable_restarts: managedProcess.unstableRestarts,
      uptime,
      createdAt: managedProcess.startTime.getTime(),
      running: isRunning,
      memory: managedProcess.monitoring.memory,
      cpu: managedProcess.monitoring.cpu
    }
  };
}

/**
 * Save process state to database
 */
async function saveProcessState(managedProcess: ManagedProcess): Promise<void> {
  try {
    const db = await Models.ProcessStates();
    await db.upsert({
      label: managedProcess.label,
      pid: managedProcess.pid,
      options: JSON.stringify(managedProcess.options),
      startTime: managedProcess.startTime,
      restarts: managedProcess.restarts,
      unstableRestarts: managedProcess.unstableRestarts
    });
  } catch (error) {
    logger.error(`Failed to save process state for ${managedProcess.label}:`, error);
  }
}

/**
 * Remove process state from database
 */
async function removeProcessState(label: string): Promise<void> {
  try {
    const db = await Models.ProcessStates();
    await db.destroy({ where: { label } });
  } catch (error) {
    logger.error(`Failed to remove process state for ${label}:`, error);
  }
}

/**
 * Load process states from database and restart them
 */
async function loadProcessStates(): Promise<void> {
  try {
    const db = await Models.ProcessStates();
    const savedStates = await db.findAll();

    for (const savedState of savedStates) {
      const stateData = savedState.toJSON();
      const options = JSON.parse(stateData.options);

      logger.info(`Restoring process: ${stateData.label}`);

      try {
        await start(stateData.label, options);
      } catch (error) {
        logger.error(`Failed to restore process ${stateData.label}:`, error);
        // Remove invalid state
        await removeProcessState(stateData.label);
      }
    }

    logger.success(`Restored ${savedStates.length} processes from database`);
  } catch (error) {
    logger.error('Failed to load process states:', error);
  }
}
