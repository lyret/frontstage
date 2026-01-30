# Changelog

All notable changes to Frontstage will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-30

### 🎉 Initial Release

This is the first complete release of Frontstage, a foundational layer for self-hosted web services.

### 🔥 Major Changes in v1.0.0
- **Removed PM2 Dependency**: Frontstage now includes a built-in process manager, eliminating the need for PM2
- **Self-Contained Process Management**: All process lifecycle management is now handled internally
- **Systemd Integration**: Direct systemd service support without external process managers

### ✨ Features Added

#### Core System
- **Web Server**: Complete HTTP/HTTPS server with SNI support
- **Reverse Proxy**: Route requests to local applications based on hostname
- **SSL Certificates**: Automatic certificate management (self-signed and Let's Encrypt)
- **Process Management**: Built-in process manager with auto-restart, monitoring, and persistence
- **DNS Management**: Dynamic DNS updates via Loopia API
- **Configuration Management**: YAML-based configuration with validation
- **Database**: SQLite integration for persistent state storage

#### Command Line Interface
- `status` - Display comprehensive system status
- `update` - Apply configuration changes and restart services
- `validate` - Validate configuration files for errors
- `lookup` - Look up domain and port information
- `dns` - List and manage DNS records
- `build` - Compile TypeScript source code
- `verify` - Verify system installation and requirements

#### Web GUI
- **Dashboard**: Real-time system overview with status cards
- **Applications**: Manage web applications, redirects, and static sites
- **Certificates**: Monitor SSL certificate status and expiration
- **Responsive Design**: Works on desktop and mobile devices
- **API Integration**: RESTful API for programmatic access

#### Configuration Features
- **Multi-hostname Support**: Route multiple domains to the same application
- **Static File Serving**: Serve static websites directly
- **HTTP Redirects**: Simple domain redirections
- **Environment Variables**: Process-specific environment configuration
- **Working Directory**: Configurable working directories for applications
- **Custom Interpreters**: Support for Node.js, Python, and other runtimes

#### Security Features
- **HTTPS Termination**: Handle SSL/TLS encryption for all applications
- **Certificate Auto-renewal**: Automatic renewal before expiration
- **Self-signed Fallback**: Generate self-signed certificates when Let's Encrypt fails
- **HTTP to HTTPS Redirect**: Automatic upgrade of insecure connections

### 🛠 Technical Implementation

#### Architecture
- **Modular Design**: Separate modules for certificates, DNS, processes, traffic, and state
- **TypeScript**: Fully typed codebase with comprehensive type definitions
- **Build System**: ESBuild-based compilation for fast builds
- **Error Handling**: Comprehensive error handling and logging throughout
- **State Management**: Centralized state management with database persistence

#### Dependencies
- **SQLite**: Lightweight database for configuration and state
- **ACME Client**: Let's Encrypt certificate management
- **Node Forge**: SSL certificate generation
- **YAML Parser**: Human-readable configuration files
- **HTTP Proxy**: Reverse proxy implementation
- **Built-in Process Manager**: Custom process management (inspired by PM2)

### 📚 Documentation

#### Comprehensive Guides
- **README.md**: Complete installation and usage guide
- **CONFIGURATION.md**: Detailed configuration documentation with examples
- **Setup Script**: Automated installation script (`setup.mjs`)
- **Architecture Diagrams**: Visual representation of system components
- **API Documentation**: Complete API reference for GUI integration

#### Examples and Templates
- **Configuration Templates**: Example configurations for common use cases
- **Application Setups**: Examples for Node.js, Python, static sites, and more
- **Security Best Practices**: Guidelines for secure deployment
- **Troubleshooting Guide**: Solutions for common issues

### 🏗 Development Tools

#### Build and Development
- **TypeScript Compilation**: Automated build system
- **Hot Reload**: Development mode with automatic rebuilds
- **Logging System**: Structured logging with configurable levels
- **Configuration Validation**: Prevent common configuration errors

#### Quality Assurance
- **Type Safety**: Full TypeScript coverage
- **Error Boundaries**: Graceful error handling
- **Input Validation**: Sanitize and validate all user inputs
- **Configuration Schema**: YAML schema validation

### 🚀 Deployment Ready

#### Production Features
- **Process Monitoring**: Automatic restart on crashes
- **Database Backups**: Automatic SQLite database backups
- **Log Management**: Structured logging for production debugging
- **Performance Optimized**: Efficient handling of concurrent requests

#### System Integration
- **Systemd Service**: Direct systemd service integration
- **Firewall Setup**: Automated firewall rule configuration
- **Built-in Process Management**: No external dependencies required
- **User Management**: Non-root user deployment support

### 📊 Statistics

- **Lines of Code**: ~15,500+ lines of TypeScript
- **Files**: 50+ source files across 8 modules
- **Configuration Options**: 20+ configuration parameters
- **CLI Commands**: 6 main commands with options
- **API Endpoints**: 8 REST endpoints for GUI integration
- **Dependencies**: 24 production dependencies (removed PM2)
- **Documentation**: 1,000+ lines of documentation

### 🎯 Use Cases

Frontstage is designed for:

- **Personal Servers**: Self-host your own websites and applications
- **Small Businesses**: Host multiple websites with automatic SSL
- **Development Teams**: Staging environments with easy configuration
- **Home Labs**: Raspberry Pi and home server deployments
- **Educational Projects**: Learn about web hosting and server management

### 🔧 System Requirements

- **Node.js**: Version 18+ (tested up to 21)
- **PM2**: Process manager for Node.js applications
- **Operating System**: Linux (Ubuntu, Debian, CentOS) or macOS
- **Memory**: Minimum 512MB RAM (1GB recommended)
- **Storage**: 100MB for application + space for your websites
- **Network**: Public IP address for Let's Encrypt certificates

### ⚠️ Known Limitations

- **Single Server**: No clustering support (planned for v2.0)
- **Limited DNS Providers**: Currently only supports Loopia
- **Manual SSL Setup**: Let's Encrypt requires manual domain verification
- **No Built-in Analytics**: External analytics required (e.g., GoatCounter)

### 🔮 Future Plans

See TODO.md for detailed roadmap, including:

- Multi-server clustering
- Built-in analytics dashboard
- Additional DNS provider support
- Automated testing suite
- Docker integration
- Plugin system

### 🙏 Acknowledgments

- **PM2 Team**: Process management concepts and patterns adapted from [PM2](https://pm2.keymetrics.io/) by Unitech
- Uses ACME client for seamless Let's Encrypt integration
- Inspired by the need for simpler self-hosting solutions
- Community feedback and testing

**Special Thanks**: The built-in process management system incorporates design patterns and concepts from PM2, adapted for Frontstage's specific requirements. Full credit to the PM2 team for their excellent work on Node.js process management.

### 📄 License

This project is unlicensed - see LICENSE.md for details.

---

**Note**: This is the first stable release with built-in process management. While production-ready for small to medium deployments, expect regular updates and improvements. The removal of PM2 dependency makes Frontstage truly self-contained.