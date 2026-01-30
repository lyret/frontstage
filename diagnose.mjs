#!/usr/bin/env node

/**
 * Frontstage Diagnostic Tool
 * JavaScript equivalent of diagnose.sh for cross-platform compatibility
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';

const exec = promisify(childProcess.exec);

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
  info: (msg) => console.log(`${colors.BLUE}[INFO]${colors.RESET} ${msg}`),
  success: (msg) => console.log(`${colors.GREEN}[PASS]${colors.RESET} ${msg}`),
  warning: (msg) => console.log(`${colors.YELLOW}[WARN]${colors.RESET} ${msg}`),
  error: (msg) => console.log(`${colors.RED}[FAIL]${colors.RESET} ${msg}`),
  debug: (msg) => console.log(`${colors.PURPLE}[DEBUG]${colors.RESET} ${msg}`)
};

class DiagnosticTool {
  constructor() {
    this.issues = [];
    this.warnings = [];
  }

  showBanner() {
    console.log();
    console.log(`${colors.BLUE}╔══════════════════════════════════════════╗${colors.RESET}`);
    console.log(`${colors.BLUE}║      Frontstage Diagnostic Tool         ║${colors.RESET}`);
    console.log(`${colors.BLUE}║        Development Troubleshooting      ║${colors.RESET}`);
    console.log(`${colors.BLUE}╚══════════════════════════════════════════╝${colors.RESET}`);
    console.log();
  }

  async checkPort(port) {
    try {
      if (os.platform() === 'win32') {
        // Windows
        const { stdout } = await exec(`netstat -an | findstr :${port}`);
        if (stdout.trim()) {
          console.log(`Port ${port} is in use: ${stdout.trim().split('\n')[0]}`);
          return true;
        }
      } else {
        // Unix-like systems
        try {
          const { stdout } = await exec(`lsof -i :${port} 2>/dev/null | grep LISTEN`);
          if (stdout.trim()) {
            console.log(`Port ${port} is in use by: ${stdout.trim()}`);
            return true;
          }
        } catch {
          // Try netstat as fallback
          const { stdout } = await exec(`netstat -tuln 2>/dev/null | grep :${port}`);
          if (stdout.trim()) {
            console.log(`Port ${port} is in use: ${stdout.trim()}`);
            return true;
          }
        }
      }
      console.log(`Port ${port} is available`);
      return false;
    } catch (error) {
      console.log(`Could not check port ${port}: ${error.message}`);
      return false;
    }
  }

  async checkEnvironment() {
    log.info('Checking system environment...');

    // Check Node.js
    try {
      const { stdout } = await exec('node --version');
      const version = stdout.trim();
      const major = parseInt(version.replace('v', '').split('.')[0]);

      if (major >= 18) {
        log.success(`Node.js version: ${version}`);
      } else {
        log.warning(`Node.js version ${version} (recommended: 18+)`);
        this.warnings.push(`Node.js version ${version} is older than recommended`);
      }
    } catch (error) {
      log.error('Node.js not found');
      this.issues.push('Node.js is not installed or not in PATH');
    }

    // Check Python
    try {
      const { stdout } = await exec('python3 --version');
      const version = stdout.trim();
      log.success(`Python available: ${version}`);
    } catch (error) {
      log.warning('Python3 not found (needed for test applications)');
      this.warnings.push('Python3 not available for test applications');
    }

    // Check useful tools
    const tools = [
      { cmd: 'lsof --version', name: 'lsof', desc: 'port checking' },
      { cmd: 'curl --version', name: 'curl', desc: 'HTTP testing' },
      { cmd: 'git --version', name: 'git', desc: 'version control' }
    ];

    for (const tool of tools) {
      try {
        await exec(tool.cmd);
        log.success(`${tool.name} available for ${tool.desc}`);
      } catch (error) {
        log.warning(`${tool.name} not found (useful for ${tool.desc})`);
      }
    }

    // Check npm packages
    try {
      if (fs.existsSync('node_modules')) {
        log.success('node_modules directory exists');

        // Check if package.json dependencies are installed
        if (fs.existsSync('package.json')) {
          const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

          let missingDeps = 0;
          Object.keys(deps || {}).forEach(dep => {
            if (!fs.existsSync(path.join('node_modules', dep))) {
              missingDeps++;
            }
          });

          if (missingDeps === 0) {
            log.success('All npm dependencies appear to be installed');
          } else {
            log.warning(`${missingDeps} npm dependencies may be missing`);
            this.warnings.push('Run npm install to ensure all dependencies are installed');
          }
        }
      } else {
        log.warning('node_modules directory not found (run npm install)');
        this.warnings.push('npm dependencies not installed');
      }
    } catch (error) {
      log.warning(`Could not check npm dependencies: ${error.message}`);
    }
  }

  checkProjectStructure() {
    log.info('Checking Frontstage project structure...');

    // Essential files
    const essentialFiles = [
      'launcher.mjs',
      'package.json',
      'configuration.dev.yaml',
      'applications.dev.yaml',
      'tsconfig.json'
    ];

    essentialFiles.forEach(file => {
      if (fs.existsSync(file)) {
        log.success(`${file} exists`);
      } else {
        log.error(`${file} missing`);
        this.issues.push(`Essential file ${file} is missing`);
      }
    });

    // Essential directories
    const essentialDirs = [
      'source',
      '.bin',
      'apps',
      'gui'
    ];

    essentialDirs.forEach(dir => {
      if (fs.existsSync(dir) && fs.lstatSync(dir).isDirectory()) {
        log.success(`${dir}/ directory exists`);
      } else {
        log.error(`${dir}/ directory missing`);
        this.issues.push(`Essential directory ${dir}/ is missing`);
      }
    });

    // Check if built
    if (fs.existsSync('.bin/+program.js')) {
      log.success('Project appears to be built');
    } else {
      log.warning('Project may need building (run: node launcher.mjs build)');
      this.warnings.push('Project needs to be built');
    }

    // Check source files
    if (fs.existsSync('source')) {
      try {
        const sourceFiles = this.countFiles('source', ['.ts', '.mts', '.js', '.mjs']);
        if (sourceFiles > 0) {
          log.success(`Found ${sourceFiles} source files in source/`);
        } else {
          log.warning('No TypeScript/JavaScript files found in source/');
        }
      } catch (error) {
        log.warning(`Could not scan source directory: ${error.message}`);
      }
    }
  }

  countFiles(dir, extensions) {
    let count = 0;
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stat = fs.lstatSync(itemPath);

      if (stat.isDirectory()) {
        count += this.countFiles(itemPath, extensions);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          count++;
        }
      }
    });

    return count;
  }

  async checkPorts() {
    log.info('Checking port availability...');

    const ports = [8080, 3000, 3001, 443, 80];
    let issues = 0;

    for (const port of ports) {
      const inUse = await this.checkPort(port);
      if (inUse) {
        if (port === 8080) {
          log.error(`Port ${port} (Frontstage dev) is in use`);
          issues++;
        } else if (port === 80 || port === 443) {
          log.info(`Port ${port} (standard web) is in use (normal)`);
        } else {
          log.warning(`Port ${port} (test app) is in use`);
        }
      } else {
        log.success(`Port ${port} is available`);
      }
    }

    if (issues > 0) {
      log.warning('Port conflicts detected. Development script will handle this automatically.');
      this.warnings.push('Some ports are in use but development mode can work around this');
    }
  }

  checkDevProcesses() {
    log.info('Checking development processes...');

    const pidFiles = ['.dev-frontstage.pid', '.dev-node-example.pid', '.dev-api-example.pid'];
    let runningProcesses = 0;

    pidFiles.forEach(pidFile => {
      if (fs.existsSync(pidFile)) {
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());

          try {
            process.kill(pid, 0); // Check if process exists
            log.success(`${pidFile}: Process ${pid} is running`);
            runningProcesses++;
          } catch (error) {
            log.warning(`${pidFile}: Stale PID file (process ${pid} not running)`);
            fs.unlinkSync(pidFile);
          }
        } catch (error) {
          log.warning(`${pidFile}: Invalid PID file`);
          fs.unlinkSync(pidFile);
        }
      }
    });

    if (runningProcesses === 0) {
      log.info('No development processes currently running');
    } else {
      log.info(`Found ${runningProcesses} development process(es) running`);
    }

    // Check for potential orphaned processes (cross-platform)
    this.checkOrphanedProcesses();
  }

  async checkOrphanedProcesses() {
    try {
      let nodeCmd, pythonCmd;

      if (os.platform() === 'win32') {
        nodeCmd = 'tasklist /FI "IMAGENAME eq node.exe" /FO CSV';
        pythonCmd = 'tasklist /FI "IMAGENAME eq python.exe" /FO CSV';
      } else {
        nodeCmd = 'ps aux | grep -E "node.*server\\.js" | grep -v grep';
        pythonCmd = 'ps aux | grep -E "python.*app\\.py" | grep -v grep';
      }

      try {
        const { stdout: nodeOutput } = await exec(nodeCmd);
        const nodeLines = nodeOutput.trim().split('\n').filter(line => line.length > 0);
        if (nodeLines.length > (os.platform() === 'win32' ? 1 : 0)) { // Account for header in Windows
          const count = os.platform() === 'win32' ? nodeLines.length - 1 : nodeLines.length;
          if (count > 0) {
            log.warning(`Found ${count} potential orphaned Node.js test process(es)`);
          }
        }
      } catch (error) {
        // No orphaned Node.js processes or command failed
      }

      try {
        const { stdout: pythonOutput } = await exec(pythonCmd);
        const pythonLines = pythonOutput.trim().split('\n').filter(line => line.length > 0);
        if (pythonLines.length > (os.platform() === 'win32' ? 1 : 0)) {
          const count = os.platform() === 'win32' ? pythonLines.length - 1 : pythonLines.length;
          if (count > 0) {
            log.warning(`Found ${count} potential orphaned Python test process(es)`);
          }
        }
      } catch (error) {
        // No orphaned Python processes or command failed
      }
    } catch (error) {
      log.debug(`Could not check for orphaned processes: ${error.message}`);
    }
  }

  checkConfiguration() {
    log.info('Checking configuration files...');

    // Check if development configuration exists
    if (fs.existsSync('configuration.yaml')) {
      try {
        const configContent = fs.readFileSync('configuration.yaml', 'utf8');
        if (configContent.includes('http_port: 8080')) {
          log.success('Development configuration active (port 8080)');
        } else {
          log.warning('Production configuration may be active');
          this.warnings.push('Production configuration detected - use development mode for testing');
        }
      } catch (error) {
        log.error(`Could not read configuration.yaml: ${error.message}`);
        this.issues.push('Configuration file is not readable');
      }
    } else {
      log.warning('configuration.yaml not found');
      this.warnings.push('Main configuration file missing');
    }

    // Check development configuration templates
    ['configuration.dev.yaml', 'applications.dev.yaml'].forEach(file => {
      if (fs.existsSync(file)) {
        log.success(`${file} template exists`);
      } else {
        log.error(`${file} template missing`);
        this.issues.push(`Development configuration template ${file} is missing`);
      }
    });

    // Check test applications configuration
    if (fs.existsSync('applications.yaml')) {
      try {
        const appConfig = fs.readFileSync('applications.yaml', 'utf8');
        const redirectCount = (appConfig.match(/redirect:/g) || []).length;
        const serveCount = (appConfig.match(/serve:/g) || []).length;
        const portCount = (appConfig.match(/port:/g) || []).length;

        log.info(`Configuration contains: ${redirectCount} redirects, ${serveCount} static serves, ${portCount} port mappings`);
      } catch (error) {
        log.warning(`Could not analyze applications.yaml: ${error.message}`);
      }
    } else {
      log.warning('applications.yaml not found');
    }
  }

  checkTestApps() {
    log.info('Checking test applications...');

    // Check Node.js test app
    const nodeAppPath = 'test-apps/node-example/server.js';
    if (fs.existsSync(nodeAppPath)) {
      log.success('Node.js test app exists');

      // Try syntax check
      try {
        childProcess.execSync(`node -c "${nodeAppPath}"`, { stdio: 'pipe' });
        log.success('Node.js test app syntax is valid');
      } catch (error) {
        log.error('Node.js test app has syntax errors');
        this.issues.push('Node.js test app has syntax errors');
      }
    } else {
      log.warning('Node.js test app missing (will be created on dev start)');
    }

    // Check Python test app
    const pythonAppPath = 'test-apps/api-example/app.py';
    if (fs.existsSync(pythonAppPath)) {
      log.success('Python test app exists');

      // Try syntax check
      try {
        childProcess.execSync(`python3 -m py_compile "${pythonAppPath}"`, { stdio: 'pipe' });
        log.success('Python test app syntax is valid');
      } catch (error) {
        log.warning('Python test app may have syntax issues');
      }
    } else {
      log.warning('Python test app missing (will be created on dev start)');
    }

    // Check test-apps directory permissions
    if (fs.existsSync('test-apps')) {
      try {
        const stats = fs.lstatSync('test-apps');
        if (stats.isDirectory()) {
          log.success('test-apps directory exists and is accessible');
        }
      } catch (error) {
        log.warning(`test-apps directory exists but has permission issues: ${error.message}`);
      }
    }
  }

  async checkNetwork() {
    log.info('Checking network connectivity...');

    // Test localhost connectivity
    try {
      const { stdout } = await exec('curl --version');
      if (stdout) {
        // Test if anything responds on development port
        try {
          await exec('curl -s --connect-timeout 2 http://localhost:8080');
          log.info('Something is responding on http://localhost:8080');
        } catch (error) {
          log.info('No response on http://localhost:8080 (normal if dev mode not running)');
        }
      }
    } catch (error) {
      log.debug('Skipping network tests (curl not available)');
    }

    // Check hosts file for development domains (Unix-like systems)
    if (os.platform() !== 'win32') {
      try {
        const hostsContent = fs.readFileSync('/etc/hosts', 'utf8');
        const devDomains = ['app.localhost', 'api.localhost', 'static.localhost'];
        const foundDomains = devDomains.filter(domain => hostsContent.includes(domain));

        if (foundDomains.length > 0) {
          log.success(`Found ${foundDomains.length} development domains in /etc/hosts`);
        } else {
          log.info('No development domains found in /etc/hosts (add manually if needed)');
        }
      } catch (error) {
        log.debug('Could not check /etc/hosts file');
      }
    }
  }

  showRecommendations() {
    console.log();
    log.info('Recommendations:');

    if (this.issues.length > 0) {
      console.log();
      log.error('Critical Issues to Fix:');
      this.issues.forEach(issue => {
        console.log(`  • ${issue}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log();
      log.warning('Warnings to Address:');
      this.warnings.forEach(warning => {
        console.log(`  • ${warning}`);
      });
    }

    console.log();
    console.log('General Recommendations:');

    // Tool installation recommendations
    const platform = os.platform();
    if (platform === 'darwin') {
      console.log('  • Install missing tools via Homebrew:');
      console.log('    - brew install lsof curl git');
    } else if (platform === 'linux') {
      console.log('  • Install missing tools via package manager:');
      console.log('    - Ubuntu/Debian: sudo apt install lsof curl git');
      console.log('    - CentOS/RHEL: sudo yum install lsof curl git');
    } else if (platform === 'win32') {
      console.log('  • Install missing tools:');
      console.log('    - Git for Windows (includes curl)');
      console.log('    - Windows Subsystem for Linux for better compatibility');
    }

    if (!fs.existsSync('.bin/+program.js')) {
      console.log('  • Build the project: node launcher.mjs build');
    }

    console.log('  • Start development mode: node dev.mjs start');
    console.log('  • Check development status: node dev.mjs status');
    console.log('  • Clean restart: node dev.mjs cleanup && node dev.mjs start');
  }

  async cleanupOrphanedProcesses() {
    log.info('Cleaning up orphaned processes...');

    let killed = 0;

    try {
      if (os.platform() === 'win32') {
        // Windows cleanup
        try {
          const { stdout } = await exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
          // Parse and kill relevant processes (simplified for safety)
          log.debug('Windows process cleanup requires manual intervention for safety');
        } catch (error) {
          log.debug('Could not list Windows processes');
        }
      } else {
        // Unix-like cleanup
        try {
          const { stdout } = await exec('ps aux | grep -E "node.*server\\.js" | grep -v grep | awk \'{print $2}\'');
          const nodePids = stdout.trim().split('\n').filter(pid => pid);

          for (const pid of nodePids) {
            try {
              process.kill(parseInt(pid), 'SIGTERM');
              killed++;
            } catch (error) {
              log.debug(`Could not kill process ${pid}`);
            }
          }
        } catch (error) {
          // No processes to kill
        }

        try {
          const { stdout } = await exec('ps aux | grep -E "python.*app\\.py" | grep -v grep | awk \'{print $2}\'');
          const pythonPids = stdout.trim().split('\n').filter(pid => pid);

          for (const pid of pythonPids) {
            try {
              process.kill(parseInt(pid), 'SIGTERM');
              killed++;
            } catch (error) {
              log.debug(`Could not kill process ${pid}`);
            }
          }
        } catch (error) {
          // No processes to kill
        }
      }
    } catch (error) {
      log.debug(`Error during cleanup: ${error.message}`);
    }

    // Clean up stale PID files
    try {
      const pidFiles = fs.readdirSync('.').filter(f => f.startsWith('.dev-') && (f.endsWith('.pid') || f.endsWith('.port')));
      pidFiles.forEach(file => fs.unlinkSync(file));
    } catch (error) {
      log.debug(`Could not clean PID files: ${error.message}`);
    }

    if (killed > 0) {
      log.success(`Cleaned up ${killed} orphaned process(es)`);
    } else {
      log.info('No orphaned processes found');
    }
  }

  showHelp() {
    console.log('Frontstage Diagnostic Tool');
    console.log();
    console.log(`Usage: ${path.basename(process.argv[1])} [command]`);
    console.log();
    console.log('Commands:');
    console.log('  check     Run full diagnostic check (default)');
    console.log('  cleanup   Clean up orphaned processes and files');
    console.log('  ports     Check port availability only');
    console.log('  --help    Show this help message');
    console.log();
    console.log('This tool helps diagnose common issues with Frontstage development setup.');
  }

  async runFullDiagnostic() {
    this.showBanner();

    await this.checkEnvironment();
    console.log();
    this.checkProjectStructure();
    console.log();
    await this.checkPorts();
    console.log();
    this.checkDevProcesses();
    console.log();
    this.checkConfiguration();
    console.log();
    this.checkTestApps();
    console.log();
    await this.checkNetwork();

    this.showRecommendations();

    console.log();
    const status = this.issues.length > 0 ? 'issues found' : 'looks good';
    log.info(`Diagnostic complete. Status: ${status}`);

    if (this.issues.length > 0) {
      log.info('Run node dev.mjs cleanup if needed, then node dev.mjs start');
    }
  }
}

// Main execution
async function main() {
  const diagnostic = new DiagnosticTool();
  const command = process.argv[2] || 'check';

  try {
    switch (command) {
      case 'check':
        await diagnostic.runFullDiagnostic();
        break;

      case 'cleanup':
        await diagnostic.cleanupOrphanedProcesses();
        break;

      case 'ports':
        await diagnostic.checkPorts();
        break;

      case '--help':
      case '-h':
        diagnostic.showHelp();
        break;

      default:
        console.log(`Unknown command: ${command}`);
        diagnostic.showHelp();
        process.exit(1);
    }
  } catch (error) {
    log.error(`Diagnostic failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
