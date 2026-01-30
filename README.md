# Frontstage

> **A foundational layer for your self-hosted web services**

Frontstage is a comprehensive server management system that simplifies hosting and managing web applications on your own infrastructure. Think of it as a more streamlined and opinionated alternative to running Nginx or Apache, with built-in process management, automatic SSL certificates, and DNS integration.

![Frontstage logotype](./assets/frontstage-logo.png)

## 🚀 Features

### Web Traffic Management
- **Web Server**: Routes all incoming web traffic to your applications running locally or on your network
- **HTTPS Termination**: Handles all SSL/TLS encryption so your applications don't need to worry about security
- **Reverse Proxy**: Route requests based on hostname to different applications
- **HTTP to HTTPS Redirect**: Automatically upgrade insecure connections

### Domain & Certificate Management
- **ACME Client**: Automatic SSL certificate generation and renewal via Let's Encrypt
- **Self-Signed Certificates**: Fallback option for development or internal networks
- **Domain Verification**: Validates that your domains are properly configured
- **Dynamic DNS**: Automatic IP address updates for Dynamic DNS providers (DigitalOcean supported)

### Process Management
- **Built-in Process Manager**: Integrated process management (no PM2 dependency required)
- **Background Processes**: Manages your web applications as system services
- **Auto-Restart**: Automatically restarts crashed applications
- **Process Monitoring**: Real-time monitoring of CPU, memory, and uptime
- **Centralized Logging**: Unified logging for all managed processes

### Configuration & Management
- **YAML Configuration**: Simple, readable configuration files
- **CLI Interface**: Powerful command-line tools for management and debugging
- **SQLite Database**: Reliable state storage with automatic backups
- **Validation**: Configuration validation prevents common mistakes

## 📋 Requirements

- **Node.js**: Version 18+ (tested up to 21)
- **Linux/macOS**: Tested on Ubuntu, Debian, CentOS, and macOS

**Note**: PM2 is no longer required - Frontstage now includes built-in process management.

## 🛠 Installation

```bash
# Install required software
# On Ubuntu/Debian:
sudo apt update
sudo apt install nodejs npm

# On CentOS/RHEL:
sudo dnf install nodejs npm

# On macOS:
brew install node

# Clone and install Frontstage
git clone https://github.com/lyret/frontstage.git
cd frontstage
npm clean-install

# Build the project
node launcher.mjs build

# Verify installation
node launcher.mjs verify
```

## ⚙️ Configuration

Frontstage uses two main configuration files:

### 1. Manager Configuration (`configuration.yaml`)

```yaml
logging:
  level: 40  # 10=trace, 20=debug, 30=info, 40=warn, 50=error

web_traffic:
  use_http: true
  http_port: 80
  http_host: 0.0.0.0
  use_https: true
  https_port: 443
  https_host: 0.0.0.0
  use_forwarded_host: false

certificates:
  self_signed_certificates:
    country: "US"
    state: "California"
    locality: "San Francisco"
    organization: "My Organization"
  lets_encrypt:
    contact_email: "admin@example.com"
    use_production_server: true

dns_records:
  loopia:  # Optional: for Dynamic DNS
    username: "your-username"
    password: "your-password"

daemons:
  root_directory: "./apps"
```

### 2. Applications Configuration (`applications.yaml`)

```yaml
# Simple redirect
- label: "redirect/example"
  hostname: "old-site.com"
  redirect: "https://new-site.com"

# Proxy to local application
- label: "app/blog"
  hostname: "blog.example.com"
  port: 3000
  process:
    cwd: "./blog-app"
    script: "npm"
    args: "start"
    env:
      NODE_ENV: "production"
      PORT: 3000

# Static file serving
- label: "static/landing"
  hostname: "example.com"
  serve: "./static-files"

# Application with custom interpreter
- label: "app/api"
  hostname: "api.example.com"
  port: 8080
  process:
    cwd: "./api-server"
    script: "app.py"
    interpreter: "/usr/bin/python3"
    env:
      FLASK_ENV: "production"
      PORT: 8080
```

## 📚 CLI Commands

### Core Commands

```bash
# Show current status
node launcher.mjs status

# Apply configuration changes
node launcher.mjs update

# Validate configuration files
node launcher.mjs validate

# Build from source code
node launcher.mjs build

# Verify installation
node launcher.mjs verify
```

### Information & Debugging

```bash
# List all DNS records
node launcher.mjs dns

# Look up domain configuration
node launcher.mjs lookup --domain example.com

# Check what's using a specific port
node launcher.mjs lookup --port 3000

# Rebuild and run command
node launcher.mjs --build status
```

## 🏗 Architecture

Frontstage follows a modular architecture:

```
┌─────────────────┐    ┌──────────────────┐
│   CLI Interface │    │   Web Server     │
│                 │    │                  │
│  ┌─────────────┐│    │ ┌──────────────┐ │
│  │ launcher.mjs││    │ │ HTTP/HTTPS   │ │
│  └─────────────┘│    │ │ Traffic      │ │
└─────────────────┘    │ │ Handler      │ │
                       │ └──────────────┘ │
┌─────────────────┐    └──────────────────┘
│   Core Modules  │    
│                 │    ┌──────────────────┐
│ ┌─────────────┐ │    │   Process Mgmt   │
│ │ Certificates│ │    │                  │
│ │ DNS Records │ │    │ ┌──────────────┐ │
│ │ Traffic Mgmt│ │    │ │ PM2 Interface│ │
│ │ State Mgmt  │ │    │ │ App Lifecycle│ │
│ └─────────────┘ │    │ └──────────────┘ │
└─────────────────┘    └──────────────────┘
         │                       │
         └───────┐       ┌───────┘
                 │       │
         ┌─────────────────┐
         │ SQLite Database │
         │                 │
         │ ┌─────────────┐ │
         │ │ Config      │ │
         │ │ Certificates│ │
         │ │ State       │ │
         │ └─────────────┘ │
         └─────────────────┘
```

### Key Components

- **Traffic Module**: HTTP/HTTPS routing, reverse proxy, redirections
- **Certificates Module**: SSL certificate management and ACME client
- **DNS Module**: DNS provider integration for Dynamic DNS
- **Process Module**: Application lifecycle management via PM2
- **State Module**: Configuration parsing and state management
- **Database Module**: SQLite integration for persistent state

## 🔧 Development

### Project Structure

```
manager/
├── source/           # TypeScript source code
│   ├── certificates/ # SSL certificate management
│   ├── database/     # SQLite integration
│   ├── dns/         # DNS provider APIs
│   ├── messages/    # Logging and messaging
│   ├── processes/   # Process management
│   ├── state/       # Configuration and state
│   ├── traffic/     # HTTP routing and handling
│   └── types/       # TypeScript definitions
├── apps/            # Directory for managed applications
├── .database/       # SQLite database files
├── .bin/           # Compiled JavaScript output
└── .cache/         # Temporary files and cache
```

### Building and Testing

```bash
# Build from source
node launcher.mjs build

# Run with rebuild
node launcher.mjs --build status

# Test configuration
node launcher.mjs validate

# Check specific domains/ports
node launcher.mjs lookup --domain example.com
node launcher.mjs lookup --port 3000
```

### Development Scripts

Frontstage includes JavaScript-based development tools (replacing the previous shell scripts):

```bash
# Development mode (safe local testing)
node dev.mjs start          # Start development environment
node dev.mjs stop           # Stop all development services
node dev.mjs status         # Check development environment status
node dev.mjs restart        # Restart development services
node dev.mjs cleanup        # Clean up test files and processes

# Diagnostics and troubleshooting
node diagnose.mjs           # Run full system diagnostic
node diagnose.mjs ports     # Check port availability only
node diagnose.mjs cleanup   # Clean up orphaned processes

# Production setup
node setup.mjs              # Run full production setup
node setup.mjs check        # Check system requirements only
node setup.mjs build        # Build project only
node setup.mjs service      # Setup system service only

# Or use npm scripts
npm run dev                 # Same as node dev.mjs start
npm run diagnose            # Run diagnostics
npm run setup               # Run production setup
```

## 🚦 Usage Examples

### Basic Web Application

1. **Prepare your application**:
   ```bash
   mkdir -p apps/my-blog
   cd apps/my-blog
   # ... set up your application
   ```

2. **Add to `applications.yaml`**:
   ```yaml
   - label: "blog/personal"
     hostname: "blog.example.com"
     port: 3000
     process:
       cwd: "./my-blog"
       script: "npm"
       args: "start"
       env:
         NODE_ENV: "production"
         PORT: 3000
   ```

3. **Apply configuration**:
   ```bash
   node launcher.mjs update
   ```

### Static Website

```yaml
- label: "static/portfolio"
  hostname: "portfolio.example.com"
  serve: "./static-portfolio"
```

### API with Database

```yaml
- label: "api/backend"
  hostname: "api.example.com"
  port: 8080
  process:
    cwd: "./api-server"
    script: "server.js"
    interpreter: "node"
    env:
      NODE_ENV: "production"
      DATABASE_URL: "sqlite:./data.db"
      PORT: 8080
```

## 🔒 Security Considerations

- **Firewall**: Configure iptables or similar to only allow necessary ports
- **User Permissions**: Run Frontstage as a dedicated non-root user
- **Certificate Storage**: Private keys are stored securely in the SQLite database
- **Let's Encrypt Rate Limits**: Be aware of Let's Encrypt's rate limiting
- **Domain Verification**: Ensure domains point to your server before adding them

## 🐛 Troubleshooting

### Common Issues

**Port already in use**:
```bash
node launcher.mjs lookup --port 80
# Check what's using the port and stop it
```

**Domain not accessible**:
```bash
node launcher.mjs dns
# Verify DNS records point to your server
```

**Certificate renewal failed**:
```bash
node launcher.mjs lookup --domain example.com
# Check certificate expiry and renewal settings
```

**Application won't start**:
```bash
node launcher.mjs status
# Check application process status and logs
```

### Logs and Debugging

- Application logs are managed by PM2: `pm2 logs`
- Frontstage logs include timestamps and log levels
- Use `--build` flag to rebuild before running commands
- Set logging level in `configuration.yaml` for more verbose output

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly: `node launcher.mjs validate`
5. Submit a pull request

## 📄 License

This project is unlicensed - see the `LICENSE.md` file for details.

### 🙏 Acknowledgments

- **PM2 Team**: Process management functionality inspired by and adapted from [PM2](https://pm2.keymetrics.io/) by Unitech. We deeply appreciate their excellent work on Node.js process management.
- Uses ACME client for seamless Let's Encrypt integration
- Inspired by the need for simpler self-hosting solutions
- Community feedback and testing

**Special Thanks**: The built-in process management system incorporates concepts and patterns from PM2, adapted for Frontstage's specific needs. Full credit to the PM2 team for their innovative approach to Node.js process management.
- Named after the sociological concept of "frontstage" behavior

---

**Note**: Frontstage is designed for small to medium-scale self-hosted deployments. For high-traffic production environments, consider battle-tested solutions like Nginx or Apache with proper load balancing.