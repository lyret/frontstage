#!/usr/bin/env node

/**
 * Frontstage Setup Script
 * JavaScript equivalent of setup.sh for cross-platform compatibility
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';
import * as readline from 'node:readline';

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
  success: (msg) => console.log(`${colors.GREEN}[SUCCESS]${colors.RESET} ${msg}`),
  warning: (msg) => console.log(`${colors.YELLOW}[WARNING]${colors.RESET} ${msg}`),
  error: (msg) => console.log(`${colors.RED}[ERROR]${colors.RESET} ${msg}`)
};

class FrontstageSetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  showBanner() {
    console.log();
    console.log(`${colors.BLUE}╔══════════════════════════════════════════╗${colors.RESET}`);
    console.log(`${colors.BLUE}║         Frontstage Setup Script         ║${colors.RESET}`);
    console.log(`${colors.BLUE}║       Production Environment Setup      ║${colors.RESET}`);
    console.log(`${colors.BLUE}╚══════════════════════════════════════════╝${colors.RESET}`);
    console.log();
  }

  async checkRoot() {
    if (process.getuid && process.getuid() === 0) {
      log.warning('Running as root. It\'s recommended to run Frontstage as a non-root user.');
      const response = await this.question('Continue anyway? (y/N): ');
      if (!response.match(/^[Yy]$/)) {
        process.exit(1);
      }
    }
  }

  async checkRequirements() {
    log.info('Checking system requirements...');

    // Check Node.js
    try {
      const { stdout } = await exec('node --version');
      const version = stdout.trim();
      const major = parseInt(version.replace('v', '').split('.')[0]);

      if (major < 18) {
        log.error(`Node.js ${version} is too old. Please install Node.js 18+ first.`);
        log.info('Visit https://nodejs.org/ to download the latest version.');
        process.exit(1);
      }
      log.success(`Node.js ${version} is compatible`);
    } catch (error) {
      log.error('Node.js is not installed. Please install Node.js 18+ first.');
      log.info('Visit https://nodejs.org/ to download Node.js.');
      process.exit(1);
    }

    // Check npm
    try {
      const { stdout } = await exec('npm --version');
      log.success(`npm ${stdout.trim()} is available`);
    } catch (error) {
      log.error('npm is not available. Please ensure npm is installed with Node.js.');
      process.exit(1);
    }

    // Check Git (optional but recommended)
    try {
      const { stdout } = await exec('git --version');
      log.success(`Git is available: ${stdout.trim()}`);
    } catch (error) {
      log.warning('Git is not installed (recommended for updates and version control)');
    }

    // Check Python (for test applications)
    try {
      const { stdout } = await exec('python3 --version');
      log.success(`Python3 available: ${stdout.trim()}`);
    } catch (error) {
      log.warning('Python3 not found (needed for Python test applications)');
    }

    // Platform-specific checks
    await this.checkPlatformSpecific();
  }

  async checkPlatformSpecific() {
    const platform = os.platform();

    if (platform === 'linux') {
      await this.checkLinuxRequirements();
    } else if (platform === 'darwin') {
      await this.checkMacOSRequirements();
    } else if (platform === 'win32') {
      await this.checkWindowsRequirements();
    }
  }

  async checkLinuxRequirements() {
    log.info('Checking Linux-specific requirements...');

    // Check if systemctl is available (for service management)
    try {
      await exec('systemctl --version');
      log.success('systemd is available for service management');
    } catch (error) {
      log.warning('systemd not available (service management will be limited)');
    }

    // Check common tools
    const tools = ['curl', 'wget', 'lsof', 'netstat'];
    for (const tool of tools) {
      try {
        await exec(`${tool} --version`);
        log.success(`${tool} is available`);
      } catch (error) {
        log.warning(`${tool} not found (install with: sudo apt install ${tool} or equivalent)`);
      }
    }
  }

  async checkMacOSRequirements() {
    log.info('Checking macOS-specific requirements...');

    // Check if Homebrew is available
    try {
      await exec('brew --version');
      log.success('Homebrew is available for package management');
    } catch (error) {
      log.warning('Homebrew not found (install from https://brew.sh for easier tool management)');
    }

    // Check for commonly needed tools
    const tools = ['curl', 'lsof'];
    for (const tool of tools) {
      try {
        await exec(`which ${tool}`);
        log.success(`${tool} is available`);
      } catch (error) {
        log.warning(`${tool} not found in PATH`);
      }
    }
  }

  async checkWindowsRequirements() {
    log.info('Checking Windows-specific requirements...');

    log.warning('Windows support is experimental. Consider using WSL for better compatibility.');

    // Check if WSL is available
    try {
      await exec('wsl --version');
      log.success('WSL is available (recommended for development)');
    } catch (error) {
      log.info('WSL not detected (install Windows Subsystem for Linux for better compatibility)');
    }
  }

  checkProjectStructure() {
    log.info('Checking project structure...');

    const requiredFiles = [
      'launcher.mjs',
      'package.json',
      '_constants.mjs'
    ];

    const requiredDirs = [
      'source',
      'gui',
      'apps'
    ];

    let missing = [];

    requiredFiles.forEach(file => {
      if (!fs.existsSync(file)) {
        missing.push(`file: ${file}`);
      }
    });

    requiredDirs.forEach(dir => {
      if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) {
        missing.push(`directory: ${dir}/`);
      }
    });

    if (missing.length > 0) {
      log.error('Missing required project files/directories:');
      missing.forEach(item => console.log(`  • ${item}`));
      log.error('Please ensure you are running this script from the Frontstage project root.');
      process.exit(1);
    }

    log.success('Project structure is valid');
  }

  async installDependencies() {
    log.info('Installing npm dependencies...');

    try {
      const { stdout, stderr } = await exec('npm install', { maxBuffer: 1024 * 1024 });
      if (stdout) log.success('Dependencies installed successfully');
      if (stderr) log.info(stderr.trim());
    } catch (error) {
      log.error(`Failed to install dependencies: ${error.message}`);
      log.info('Try running: npm install --verbose');
      process.exit(1);
    }
  }

  async buildProject() {
    log.info('Building Frontstage...');

    try {
      const { stdout, stderr } = await exec('node launcher.mjs build');
      if (stdout) log.info(stdout.trim());
      if (stderr) log.info(stderr.trim());
      log.success('Project built successfully');
    } catch (error) {
      log.error(`Build failed: ${error.message}`);
      log.info('Check the build output above for specific errors.');
      process.exit(1);
    }
  }

  async setupConfiguration() {
    log.info('Setting up configuration...');

    // Check if configuration files exist
    const hasConfig = fs.existsSync('configuration.yaml');
    const hasApps = fs.existsSync('applications.yaml');

    if (!hasConfig && fs.existsSync('configuration.dev.yaml')) {
      log.info('Creating production configuration from development template...');
      fs.copyFileSync('configuration.dev.yaml', 'configuration.yaml');
      log.warning('Please review and update configuration.yaml for production use');
    }

    if (!hasApps && fs.existsSync('applications.dev.yaml')) {
      log.info('Creating applications configuration from development template...');
      fs.copyFileSync('applications.dev.yaml', 'applications.yaml');
      log.warning('Please review and update applications.yaml for your applications');
    }

    // Validate configuration
    try {
      const { stdout, stderr } = await exec('node launcher.mjs validate');
      if (stdout) log.info(stdout.trim());
      log.success('Configuration validation passed');
    } catch (error) {
      log.error('Configuration validation failed');
      log.error(error.message);
      log.info('Please fix configuration errors before continuing');
      process.exit(1);
    }
  }

  async createDirectories() {
    log.info('Creating necessary directories...');

    const dirs = [
      '.bin',
      '.cache',
      '.database',
      'apps',
      'gui/build',
      'assets/certificates',
      'assets/logs'
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log.success(`Created directory: ${dir}/`);
      }
    });
  }

  async setupSystemService() {
    const platform = os.platform();

    if (platform === 'linux') {
      await this.setupLinuxService();
    } else if (platform === 'darwin') {
      await this.setupMacOSService();
    } else if (platform === 'win32') {
      log.warning('Automatic service setup not supported on Windows');
      log.info('You can run Frontstage manually with: node launcher.mjs start');
    } else {
      log.warning(`Service setup not implemented for platform: ${platform}`);
    }
  }

  async setupLinuxService() {
    if (process.getuid && process.getuid() !== 0) {
      log.warning('Root privileges required for systemd service setup');
      const response = await this.question('Skip service setup? (y/N): ');
      if (response.match(/^[Yy]$/)) {
        return;
      }
    }

    log.info('Setting up systemd service...');

    const serviceContent = `[Unit]
Description=Frontstage Server Management
After=network.target
Wants=network.target

[Service]
Type=simple
User=${os.userInfo().username}
Group=${os.userInfo().username}
WorkingDirectory=${process.cwd()}
ExecStart=/usr/bin/node ${path.join(process.cwd(), 'launcher.mjs')} start
ExecStop=/usr/bin/node ${path.join(process.cwd(), 'launcher.mjs')} stop
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=frontstage

[Install]
WantedBy=multi-user.target
`;

    try {
      fs.writeFileSync('/etc/systemd/system/frontstage.service', serviceContent);
      await exec('systemctl daemon-reload');
      log.success('Systemd service created');
      log.info('To start Frontstage: sudo systemctl start frontstage');
      log.info('To enable on boot: sudo systemctl enable frontstage');
    } catch (error) {
      log.error(`Failed to create systemd service: ${error.message}`);
      log.info('You can run Frontstage manually with: node launcher.mjs start');
    }
  }

  async setupMacOSService() {
    log.info('Setting up macOS LaunchAgent...');

    const userHome = os.homedir();
    const launchAgentsDir = path.join(userHome, 'Library', 'LaunchAgents');
    const plistPath = path.join(launchAgentsDir, 'com.frontstage.server.plist');

    if (!fs.existsSync(launchAgentsDir)) {
      fs.mkdirSync(launchAgentsDir, { recursive: true });
    }

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.frontstage.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${path.join(process.cwd(), 'launcher.mjs')}</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${process.cwd()}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(process.cwd(), 'assets', 'logs', 'frontstage.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(process.cwd(), 'assets', 'logs', 'frontstage.error.log')}</string>
</dict>
</plist>
`;

    try {
      fs.writeFileSync(plistPath, plistContent);
      log.success('LaunchAgent created');
      log.info('To start Frontstage: launchctl load ~/Library/LaunchAgents/com.frontstage.server.plist');
      log.info('To stop Frontstage: launchctl unload ~/Library/LaunchAgents/com.frontstage.server.plist');
    } catch (error) {
      log.error(`Failed to create LaunchAgent: ${error.message}`);
      log.info('You can run Frontstage manually with: node launcher.mjs start');
    }
  }

  async performSecurityChecks() {
    log.info('Performing security checks...');

    // Check file permissions
    const sensitiveFiles = ['configuration.yaml', 'applications.yaml'];

    sensitiveFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const stats = fs.lstatSync(file);
        const mode = stats.mode & parseInt('777', 8);

        if (mode > parseInt('644', 8)) {
          log.warning(`${file} has overly permissive permissions (${mode.toString(8)})`);
          log.info(`Consider: chmod 644 ${file}`);
        } else {
          log.success(`${file} has appropriate permissions`);
        }
      }
    });

    // Check for default passwords or keys (placeholder for now)
    if (fs.existsSync('configuration.yaml')) {
      const config = fs.readFileSync('configuration.yaml', 'utf8');
      if (config.includes('changeme') || config.includes('password123')) {
        log.warning('Configuration may contain default passwords - please review');
      }
    }
  }

  async finalizeSetup() {
    log.info('Finalizing setup...');

    // Create a simple status check
    try {
      const { stdout } = await exec('node launcher.mjs status');
      log.success('Frontstage appears to be ready');
    } catch (error) {
      log.warning('Status check failed - this may be normal if not started yet');
    }

    console.log();
    log.success('Setup completed successfully!');
    console.log();
    console.log('Next steps:');
    console.log('1. Review configuration files:');
    console.log('   • configuration.yaml - Server settings');
    console.log('   • applications.yaml - Application routing');
    console.log();
    console.log('2. Start Frontstage:');

    const platform = os.platform();
    if (platform === 'linux') {
      console.log('   • sudo systemctl start frontstage');
      console.log('   • sudo systemctl enable frontstage (for auto-start)');
    } else if (platform === 'darwin') {
      console.log('   • launchctl load ~/Library/LaunchAgents/com.frontstage.server.plist');
    } else {
      console.log('   • node launcher.mjs start');
    }

    console.log();
    console.log('3. Test the setup:');
    console.log('   • node launcher.mjs status');
    console.log('   • curl http://localhost (adjust port as configured)');
    console.log();
    console.log('📚 Documentation:');
    console.log('   • README.md - Overview and usage');
    console.log('   • CONFIGURATION.md - Detailed configuration guide');
    console.log('   • TESTING.md - Development and testing');
    console.log();
  }

  async runFullSetup() {
    this.showBanner();

    await this.checkRoot();
    await this.checkRequirements();
    this.checkProjectStructure();
    await this.installDependencies();
    await this.buildProject();
    this.createDirectories();
    await this.setupConfiguration();
    await this.setupSystemService();
    await this.performSecurityChecks();
    await this.finalizeSetup();

    this.rl.close();
  }

  showHelp() {
    console.log('Frontstage Setup Script');
    console.log();
    console.log(`Usage: ${path.basename(process.argv[1])} [command]`);
    console.log();
    console.log('Commands:');
    console.log('  setup     Run full setup process (default)');
    console.log('  check     Check system requirements only');
    console.log('  build     Build project only');
    console.log('  service   Setup system service only');
    console.log('  --help    Show this help message');
    console.log();
    console.log('This script sets up Frontstage for production use.');
    console.log('For development, use: node dev.mjs start');
  }

  async checkOnly() {
    this.showBanner();
    await this.checkRequirements();
    this.checkProjectStructure();
    log.success('System requirements check completed');
    this.rl.close();
  }

  async buildOnly() {
    await this.installDependencies();
    await this.buildProject();
    log.success('Build completed');
    this.rl.close();
  }

  async serviceOnly() {
    await this.setupSystemService();
    log.success('Service setup completed');
    this.rl.close();
  }
}

// Main execution
async function main() {
  const setup = new FrontstageSetup();
  const command = process.argv[2] || 'setup';

  try {
    switch (command) {
      case 'setup':
        await setup.runFullSetup();
        break;

      case 'check':
        await setup.checkOnly();
        break;

      case 'build':
        await setup.buildOnly();
        break;

      case 'service':
        await setup.serviceOnly();
        break;

      case '--help':
      case '-h':
        setup.showHelp();
        setup.rl.close();
        break;

      default:
        console.log(`Unknown command: ${command}`);
        setup.showHelp();
        setup.rl.close();
        process.exit(1);
    }
  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    setup.rl.close();
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log();
  log.info('Setup interrupted by user');
  process.exit(0);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
