#!/usr/bin/env node

/**
 * Frontstage Development Mode
 * JavaScript equivalent of dev.sh for cross-platform compatibility
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(childProcess.exec);
const spawn = childProcess.spawn;

// Colors for output
const colors = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  PURPLE: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m'
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.BLUE}[DEV]${colors.RESET} ${msg}`),
  success: (msg) => console.log(`${colors.GREEN}[SUCCESS]${colors.RESET} ${msg}`),
  warning: (msg) => console.log(`${colors.YELLOW}[WARNING]${colors.RESET} ${msg}`),
  error: (msg) => console.log(`${colors.RED}[ERROR]${colors.RESET} ${msg}`),
  debug: (msg) => console.log(`${colors.PURPLE}[DEBUG]${colors.RESET} ${msg}`)
};

// Process management
class ProcessManager {
  constructor() {
    this.pidDir = '.';
  }

  async isPortInUse(port) {
    try {
      const { stdout } = await exec(`lsof -i :${port} | grep LISTEN`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async findFreePort(startPort) {
    let port = startPort;
    while (await this.isPortInUse(port)) {
      port++;
    }
    return port;
  }

  writePid(name, pid) {
    fs.writeFileSync(path.join(this.pidDir, `.dev-${name}.pid`), pid.toString());
  }

  writePort(name, port) {
    fs.writeFileSync(path.join(this.pidDir, `.dev-${name}.port`), port.toString());
  }

  readPid(name) {
    try {
      const pidFile = path.join(this.pidDir, `.dev-${name}.pid`);
      if (fs.existsSync(pidFile)) {
        return parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      }
    } catch {
      return null;
    }
    return null;
  }

  readPort(name) {
    try {
      const portFile = path.join(this.pidDir, `.dev-${name}.port`);
      if (fs.existsSync(portFile)) {
        return parseInt(fs.readFileSync(portFile, 'utf8').trim());
      }
    } catch {
      return null;
    }
    return null;
  }

  isProcessRunning(pid) {
    if (!pid) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  killProcess(pid) {
    if (!pid) return false;
    try {
      process.kill(pid, 'SIGTERM');
      return true;
    } catch {
      return false;
    }
  }

  cleanupPidFiles() {
    const pidFiles = fs.readdirSync(this.pidDir).filter(f => f.startsWith('.dev-') && (f.endsWith('.pid') || f.endsWith('.port')));
    pidFiles.forEach(file => {
      fs.unlinkSync(path.join(this.pidDir, file));
    });
  }
}

// Development environment manager
class DevEnvironment {
  constructor() {
    this.pm = new ProcessManager();
    this.testApps = {
      'node-example': {
        dir: 'test-apps/node-example',
        file: 'server.js',
        port: 3000
      },
      'api-example': {
        dir: 'test-apps/api-example',
        file: 'app.py',
        port: 3001
      }
    };
  }

  showBanner() {
    console.log();
    console.log(`${colors.BLUE}╔══════════════════════════════════════════╗${colors.RESET}`);
    console.log(`${colors.BLUE}║        Frontstage Development Mode      ║${colors.RESET}`);
    console.log(`${colors.BLUE}║         Safe Local Testing              ║${colors.RESET}`);
    console.log(`${colors.BLUE}╚══════════════════════════════════════════╝${colors.RESET}`);
    console.log();
  }

  checkEnvironment() {
    log.info('Checking environment...');

    if (!fs.existsSync('launcher.mjs')) {
      log.error('launcher.mjs not found. Please run this script from the Frontstage directory.');
      process.exit(1);
    }

    if (!fs.existsSync('package.json')) {
      log.error('package.json not found. Please run this script from the Frontstage directory.');
      process.exit(1);
    }

    log.success('Environment check passed');
  }

  backupConfig() {
    const configs = [
      { current: 'configuration.yaml', backup: 'configuration.yaml.backup' },
      { current: 'applications.yaml', backup: 'applications.yaml.backup' }
    ];

    configs.forEach(({ current, backup }) => {
      if (fs.existsSync(current) && !fs.existsSync(backup)) {
        fs.copyFileSync(current, backup);
        log.info(`Backed up ${current} to ${backup}`);
      }
    });
  }

  setupDevConfig() {
    log.info('Setting up development configuration...');

    if (!fs.existsSync('configuration.dev.yaml')) {
      log.error('configuration.dev.yaml not found');
      process.exit(1);
    }

    if (!fs.existsSync('applications.dev.yaml')) {
      log.error('applications.dev.yaml not found');
      process.exit(1);
    }

    fs.copyFileSync('configuration.dev.yaml', 'configuration.yaml');
    fs.copyFileSync('applications.dev.yaml', 'applications.yaml');

    log.success('Development configuration activated');
    log.warning('Using non-privileged ports (HTTP: 8080, HTTPS: 8443)');
    log.warning('Certificates and DNS management disabled');
  }

  createTestApps() {
    log.info('Creating test application directories...');

    // Create Node.js test app
    const nodeAppDir = this.testApps['node-example'].dir;
    if (!fs.existsSync(nodeAppDir)) {
      fs.mkdirSync(nodeAppDir, { recursive: true });
    }

    const nodeServerContent = `const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (parsedUrl.pathname === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      service: 'node-example',
      message: 'Hello from Node.js test application!',
      timestamp: new Date().toISOString(),
      port: process.env.PORT || 3000
    }));
  } else if (parsedUrl.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const port = process.env.PORT || 3000;
server.listen(port, '127.0.0.1', () => {
  console.log(\`Node.js test app listening on http://127.0.0.1:\${port}\`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => process.exit(0));
});
`;

    fs.writeFileSync(path.join(nodeAppDir, 'server.js'), nodeServerContent);

    // Create Python test app
    const pythonAppDir = this.testApps['api-example'].dir;
    if (!fs.existsSync(pythonAppDir)) {
      fs.mkdirSync(pythonAppDir, { recursive: true });
    }

    const pythonAppContent = `#!/usr/bin/env python3
import json
import signal
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import os

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)

        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')

        if parsed_path.path == '/':
            self.send_response(200)
            self.end_headers()
            response = {
                'service': 'api-example',
                'message': 'Hello from Python test API!',
                'timestamp': datetime.now().isoformat(),
                'port': os.environ.get('PORT', 3001)
            }
            self.wfile.write(json.dumps(response).encode())
        elif parsed_path.path == '/api/data':
            self.send_response(200)
            self.end_headers()
            response = {
                'data': [
                    {'id': 1, 'name': 'Test Item 1'},
                    {'id': 2, 'name': 'Test Item 2'},
                    {'id': 3, 'name': 'Test Item 3'}
                ],
                'count': 3
            }
            self.wfile.write(json.dumps(response).encode())
        elif parsed_path.path == '/health':
            self.send_response(200)
            self.end_headers()
            response = {'status': 'healthy'}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()
            response = {'error': 'Not found'}
            self.wfile.write(json.dumps(response).encode())

    def log_message(self, format, *args):
        sys.stdout.write(f"[{datetime.now().isoformat()}] {format % args}\\n")

def signal_handler(sig, frame):
    print('Received signal, shutting down gracefully')
    sys.exit(0)

if __name__ == '__main__':
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    port = int(os.environ.get('PORT', 3001))
    server = HTTPServer(('127.0.0.1', port), APIHandler)
    print(f'Python test API listening on http://127.0.0.1:{port}')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
`;

    fs.writeFileSync(path.join(pythonAppDir, 'app.py'), pythonAppContent);

    // Make Python script executable
    try {
      fs.chmodSync(path.join(pythonAppDir, 'app.py'), 0o755);
    } catch (error) {
      log.debug('Could not set execute permissions on Python script');
    }

    log.success('Test applications created');
  }

  async buildProject() {
    log.info('Building project...');
    try {
      const { stdout, stderr } = await exec('node launcher.mjs build');
      if (stdout) log.debug(stdout.trim());
      if (stderr) log.debug(stderr.trim());
      log.success('Project built successfully');
    } catch (error) {
      log.error(`Build failed: ${error.message}`);
      process.exit(1);
    }
  }

  async validateConfig() {
    log.info('Validating configuration...');
    try {
      const { stdout, stderr } = await exec('node launcher.mjs validate');
      if (stdout) log.debug(stdout.trim());
      if (stderr) log.debug(stderr.trim());
      log.success('Configuration validated');
    } catch (error) {
      log.error(`Configuration validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  async startTestApps() {
    log.info('Starting test applications...');

    for (const [name, app] of Object.entries(this.testApps)) {
      const existingPid = this.pm.readPid(name);
      if (existingPid && this.pm.isProcessRunning(existingPid)) {
        log.info(`${name} already running (PID: ${existingPid})`);
        continue;
      }

      const freePort = await this.pm.findFreePort(app.port);
      if (freePort !== app.port) {
        log.warning(`Port ${app.port} in use, using ${freePort} for ${name}`);
      }

      let child;
      const env = { ...process.env, PORT: freePort.toString() };

      if (name === 'node-example') {
        child = spawn('node', [app.file], {
          cwd: app.dir,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });
      } else if (name === 'api-example') {
        child = spawn('python3', [app.file], {
          cwd: app.dir,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false
        });
      }

      if (child) {
        this.pm.writePid(name, child.pid);
        this.pm.writePort(name, freePort);

        child.stdout.on('data', (data) => {
          log.debug(`[${name}] ${data.toString().trim()}`);
        });

        child.stderr.on('data', (data) => {
          log.debug(`[${name}] ${data.toString().trim()}`);
        });

        child.on('exit', (code) => {
          log.debug(`${name} exited with code ${code}`);
        });

        log.success(`Started ${name} on port ${freePort} (PID: ${child.pid})`);
      }
    }

    // Give apps time to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async startFrontstage() {
    log.info('Starting Frontstage internal processes...');

    try {
      // Start internal processes via PM2 directly (skip update to avoid process conflicts)
      const processes = [
        { name: 'SCHEDULER', file: '.bin/+scheduler.js' },
        { name: 'WEBSERVER', file: '.bin/+webServer.js' }
      ];

      for (const process of processes) {
        try {
          // Check if process is already running
          const { stdout: listOutput } = await exec(`pm2 jlist`);
          const processes = JSON.parse(listOutput);
          const existing = processes.find(p => p.name === process.name);

          if (existing && existing.pm2_env.status === 'online') {
            log.info(`${process.name} is already running`);
            continue;
          }

          // Start the process
          const { stdout } = await exec(`pm2 start ${process.file} --name ${process.name}`);
          log.success(`Started ${process.name}`);

        } catch (error) {
          log.error(`Failed to start ${process.name}: ${error.message}`);
        }
      }

      // Give processes time to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test if web server is responding
      try {
        await exec('curl -s --connect-timeout 2 http://localhost:8080');
        log.success('Web server is responding');
      } catch (error) {
        log.warning('Web server may not be fully started yet');
      }

      console.log();
      log.success('Development environment is ready!');
      console.log();
      console.log('  🌐 Frontstage: http://localhost:8080');
      console.log('  🟢 Node.js App: http://app.localhost:8080');
      console.log('  🐍 Python API: http://api.localhost:8080');
      console.log();
      console.log('  📋 Status: node dev.mjs status');
      console.log('  🛑 Stop: node dev.mjs stop');
      console.log();

    } catch (error) {
      log.error(`Failed to start Frontstage: ${error.message}`);
      process.exit(1);
    }
  }

  async stopServices() {
    log.info('Stopping development services...');

    // Stop test applications
    const testServices = ['node-example', 'api-example'];
    let stopped = 0;

    testServices.forEach(service => {
      const pid = this.pm.readPid(service);
      if (pid && this.pm.isProcessRunning(pid)) {
        if (this.pm.killProcess(pid)) {
          log.success(`Stopped ${service} (PID: ${pid})`);
          stopped++;
        } else {
          log.warning(`Failed to stop ${service} (PID: ${pid})`);
        }
      }
    });

    // Stop Frontstage internal processes via PM2
    const frontstageProcesses = ['SCHEDULER', 'WEBSERVER'];

    for (const processName of frontstageProcesses) {
      try {
        const { stdout } = await exec(`pm2 jlist`);
        const processes = JSON.parse(stdout);
        const process = processes.find(p => p.name === processName);

        if (process && process.pm2_env.status === 'online') {
          await exec(`pm2 stop ${processName}`);
          await exec(`pm2 delete ${processName}`);
          log.success(`Stopped ${processName}`);
          stopped++;
        }
      } catch (error) {
        log.debug(`Error stopping ${processName}: ${error.message}`);
      }
    }

    // Clean up PID files
    this.pm.cleanupPidFiles();

    if (stopped > 0) {
      log.success(`Stopped ${stopped} service(s)`);
    } else {
      log.info('No services were running');
    }
  }

  restoreConfig() {
    if (fs.existsSync('configuration.yaml.backup')) {
      fs.copyFileSync('configuration.yaml.backup', 'configuration.yaml');
      log.info('Restored configuration.yaml from backup');
    }

    if (fs.existsSync('applications.yaml.backup')) {
      fs.copyFileSync('applications.yaml.backup', 'applications.yaml');
      log.info('Restored applications.yaml from backup');
    }
  }

  async showStatus() {
    console.log();
    log.info('Development Environment Status');
    console.log();

    // Check test applications
    const testServices = ['node-example', 'api-example'];
    testServices.forEach(service => {
      const pid = this.pm.readPid(service);
      const port = this.pm.readPort(service);

      if (pid && this.pm.isProcessRunning(pid)) {
        const portInfo = port ? ` (port ${port})` : '';
        log.success(`${service}: Running (PID: ${pid})${portInfo}`);
      } else {
        log.warning(`${service}: Not running`);
      }
    });

    // Check Frontstage internal processes
    const frontstageProcesses = ['SCHEDULER', 'WEBSERVER'];
    let frontstageRunning = false;

    for (const processName of frontstageProcesses) {
      try {
        const { stdout } = await exec(`pm2 jlist`);
        const processes = JSON.parse(stdout);
        const process = processes.find(p => p.name === processName);

        if (process && process.pm2_env.status === 'online') {
          log.success(`${processName}: Running (PM2 PID: ${process.pid})`);
          frontstageRunning = true;
        } else {
          log.warning(`${processName}: Not running`);
        }
      } catch (error) {
        log.warning(`${processName}: Status unknown`);
      }
    }

    console.log();

    // Show URLs if services are running
    if (frontstageRunning) {
      console.log('Available endpoints:');
      console.log('  🌐 http://localhost:8080 (Frontstage)');
      console.log('  🟢 http://app.localhost:8080 (Node.js test app)');
      console.log('  🐍 http://api.localhost:8080 (Python API)');
      console.log();
    }
  }

  async cleanup() {
    log.info('Cleaning up development environment...');

    await this.stopServices();

    // Remove test apps
    if (fs.existsSync('test-apps')) {
      fs.rmSync('test-apps', { recursive: true, force: true });
      log.info('Removed test applications');
    }

    // Restore original config
    this.restoreConfig();

    log.success('Cleanup complete');
  }

  showHelp() {
    console.log('Frontstage Development Mode');
    console.log();
    console.log(`Usage: ${path.basename(process.argv[1])} [command]`);
    console.log();
    console.log('Commands:');
    console.log('  start     Start development mode (default)');
    console.log('  stop      Stop all development services');
    console.log('  restart   Restart development services');
    console.log('  status    Show development environment status');
    console.log('  cleanup   Stop services and remove dev files');
    console.log('  build     Build the project');
    console.log('  validate  Validate configuration');
    console.log('  logs      Show Frontstage status and logs');
    console.log('  --help    Show this help message');
    console.log();
    console.log('Development Features:');
    console.log('  • Non-privileged ports (8080 instead of 80)');
    console.log('  • No real certificate generation');
    console.log('  • Built-in process management (no PM2 required)');
    console.log('  • Test applications included');
    console.log('  • Safe for local testing');
    console.log('  • Easy cleanup');
    console.log();
  }
}

// Main execution
async function main() {
  const dev = new DevEnvironment();
  const command = process.argv[2] || 'start';

  try {
    switch (command) {
      case 'start':
        dev.showBanner();
        dev.checkEnvironment();
        dev.backupConfig();
        dev.setupDevConfig();
        dev.createTestApps();
        await dev.buildProject();
        await dev.validateConfig();
        await dev.startTestApps();
        await dev.startFrontstage();
        break;

      case 'stop':
        log.info('Stopping development mode...');
        await dev.stopServices();
        dev.restoreConfig();
        log.success('Development mode stopped');
        break;

      case 'restart':
        log.info('Restarting development mode...');
        await dev.stopServices();
        await new Promise(resolve => setTimeout(resolve, 3000));
        dev.setupDevConfig();
        await dev.startTestApps();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await dev.startFrontstage();
        log.success('Development mode restarted');
        break;

      case 'status':
        await dev.showStatus();
        break;

      case 'cleanup':
        await dev.cleanup();
        break;

      case 'build':
        await dev.buildProject();
        break;

      case 'validate':
        await dev.validateConfig();
        break;

      case 'logs':
        log.info('Showing Frontstage logs...');
        try {
          const { stdout } = await exec('node launcher.mjs status');
          console.log(stdout);
        } catch (error) {
          log.error(`Failed to get logs: ${error.message}`);
        }
        break;

      case '--help':
      case '-h':
        dev.showHelp();
        break;

      default:
        log.error(`Unknown command: ${command}`);
        console.log('Use --help for usage information');
        process.exit(1);
    }
  } catch (error) {
    log.error(`Development script failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log();
  log.info('Received interrupt signal, cleaning up...');
  const dev = new DevEnvironment();
  dev.stopServices().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  log.info('Received termination signal, cleaning up...');
  const dev = new DevEnvironment();
  dev.stopServices().then(() => process.exit(0));
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
