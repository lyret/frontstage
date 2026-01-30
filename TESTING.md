# Frontstage Local Testing Guide

This guide helps you test Frontstage locally without affecting your system or creating real certificates. Perfect for development, testing, and learning how Frontstage works.

## 🚀 Quick Start - Local Testing

### Option 1: Automated Development Mode (Recommended)

```bash
# 1. Run the development mode script
node dev.mjs start

# 2. Add test domains to your hosts file
echo "127.0.0.1 localhost redirect.localhost static.localhost app.localhost api.localhost" | sudo tee -a /etc/hosts

# 3. Test the interfaces
curl http://localhost:8080
curl http://redirect.localhost:8080
curl http://static.localhost:8080
```

### Option 2: Manual Testing Setup

```bash
# 1. Run validation tests
node test.mjs

# 2. Build the project
node launcher.mjs build

# 3. Use development configuration
cp configuration.dev.yaml configuration.yaml
cp applications.dev.yaml applications.yaml

# 4. Validate and start
node launcher.mjs validate
node launcher.mjs update
```

## 📋 Prerequisites

Before testing, ensure you have:

- **Node.js 18+**: `node --version`
- **PM2**: `npm install -g pm2` (if not installed)
- **Basic tools**: `curl`, `lsof` (for port checking)
- **Admin access**: For editing `/etc/hosts` (optional but recommended)

## 🧪 Test Validation

Run the built-in test suite to verify everything is ready:

```bash
# Run all validation tests
node test.mjs

# Quick system check
node test.mjs --version

# Get help
node test.mjs --help
```

The test suite checks:
- Node.js version compatibility
- File structure integrity
- Configuration file validity
- Documentation completeness
- Port availability

## 🔧 Development Mode Features

When you run `node dev.mjs start`, you get:

### Safe Configuration
- **Non-privileged ports**: HTTP on 8080, HTTPS on 8443
- **Localhost only**: Binds to 127.0.0.1, not public interfaces  
- **No real certificates**: Skips Let's Encrypt and certificate generation
- **No DNS changes**: Won't modify your DNS settings

### Test Applications
- **Node.js test server**: Simple JSON API on port 3000
- **Python test server**: Basic HTTP server on port 3001
- **Static file serving**: Uses the GUI files as test content
- **Redirect testing**: Test HTTP redirections

### Easy Management
- **Start**: `node dev.mjs start`
- **Stop**: `node dev.mjs stop`
- **Restart**: `node dev.mjs restart`
- **Status**: `node dev.mjs status`
- **Cleanup**: `node dev.mjs cleanup`

## 🌐 Testing URLs

Once development mode is running, test these URLs:

### Basic Functionality
```bash
# Main web server (should show routing info)
curl -v http://localhost:8080

# GUI interface (if configured)
curl http://localhost:8080
```

### With Host Header Testing
```bash
# Test redirect functionality
curl -H "Host: redirect.localhost" http://localhost:8080

# Test static file serving
curl -H "Host: static.localhost" http://localhost:8080

# Test proxy to Node.js app
curl -H "Host: app.localhost" http://localhost:8080

# Test proxy to Python API
curl -H "Host: api.localhost" http://localhost:8080
```

### Browser Testing (Requires /etc/hosts)
Add to `/etc/hosts`:
```
127.0.0.1 localhost redirect.localhost static.localhost app.localhost api.localhost test1.localhost test2.localhost www.localhost
```

Then visit:
- http://localhost:8080 - Main interface
- http://redirect.localhost:8080 - Test redirect
- http://static.localhost:8080 - Static files  
- http://app.localhost:8080 - Node.js app
- http://api.localhost:8080 - Python API

## 🔍 Debugging and Monitoring

### Check System Status
```bash
# Frontstage status
node launcher.mjs status

# Development environment status
node dev.mjs status

# Process status
pm2 list
pm2 logs
```

### Port Monitoring
```bash
# Check what's using ports
lsof -i :8080  # Frontstage web server
lsof -i :3000  # Test Node.js app
lsof -i :3001  # Test Python API

# Check all listening ports
netstat -tulpn | grep LISTEN
```

### Log Files
```bash
# PM2 logs
pm2 logs

# Follow logs in real-time
pm2 logs --follow

# Application-specific logs
pm2 logs frontstage-web-server
```

## 🎛 Configuration Testing

### Test Configuration Changes

1. **Edit configuration**:
   ```bash
   nano configuration.yaml
   ```

2. **Validate changes**:
   ```bash
   node launcher.mjs validate
   ```

3. **Apply changes**:
   ```bash
   node launcher.mjs update
   ```

### Example Configuration Tests

**Add a new redirect**:
```yaml
- label: "test/new-redirect"
  hostname: "test.localhost"
  redirect: "https://example.com"
```

**Add a static site**:
```yaml
- label: "test/static"
  hostname: "mysite.localhost"
  serve: "./my-static-site"
```

**Add a process**:
```yaml
- label: "test/my-app"
  hostname: "myapp.localhost" 
  port: 3002
  process:
    cwd: "./my-app"
    script: "server.js"
    env:
      NODE_ENV: "development"
      PORT: 3002
```

## 🧹 Cleanup and Reset

### Stop All Services
```bash
# Stop development mode
node dev.mjs stop

# Full cleanup (removes test apps)
node dev.mjs cleanup
```

### Manual Cleanup
```bash
# Stop PM2 processes
pm2 stop all
pm2 delete all

# Kill test applications
pkill -f "node.*server.js"
pkill -f "python.*app.py"

# Remove development config (if you have backups)
rm configuration.yaml applications.yaml
mv configuration.yaml.backup configuration.yaml 2>/dev/null || true
mv applications.yaml.backup applications.yaml 2>/dev/null || true
```

### Reset /etc/hosts
Remove the test domains you added:
```bash
sudo sed -i '' '/redirect.localhost/d' /etc/hosts  # macOS
sudo sed -i '/redirect.localhost/d' /etc/hosts     # Linux
```

## 🐛 Troubleshooting

### Common Issues

**Development script crashes on startup**:
```bash
# Check what went wrong
node dev.mjs status

# Try stopping any running processes first
node dev.mjs stop

# Check for port conflicts
lsof -i :8080 :3000 :3001

# Try restarting
node dev.mjs restart
```

**Port conflicts during startup**:
The dev.mjs script now automatically finds available ports if default ones are busy:
```bash
# Script will show which ports it's using
node dev.mjs start
# Look for messages like: "Port 3000 busy, using port 3002 for Node.js app"
```

**Port 8080 already in use**:
```bash
# Find what's using the port
lsof -i :8080

# Kill the process
sudo kill -9 <PID>

# Or use a different port in configuration.yaml
```

**Permission denied on port 80/443**:
- Development mode uses ports 8080/8443 by design
- Don't run as root - use non-privileged ports

**Test apps won't start**:
```bash
# Check if dependencies are available
node --version
python3 --version

# Check development script status
node dev.mjs status

# Try starting manually to see errors
cd test-apps/node-example && node server.js
cd test-apps/api-example && python3 app.py

# Clean up and try again
node dev.mjs cleanup
node dev.mjs start
```

**Web server fails to start**:
```bash
# Check if Frontstage built correctly
node launcher.mjs build

# Validate configuration
node launcher.mjs validate

# Check if port 8080 is available
lsof -i :8080

# Try with verbose logging
LOG_LEVEL=20 node dev.mjs start
```

**Processes keep running after stop**:
```bash
# Force cleanup all processes
node dev.mjs stop

# Check for remaining processes
ps aux | grep -E "(node|python).*test"

# Kill any remaining processes manually
pkill -f "node.*server.js"
pkill -f "python.*app.py"

# Clean restart
node dev.mjs start
```

**DNS resolution fails**:
```bash
# Check /etc/hosts entries
cat /etc/hosts | grep localhost

# Test DNS resolution
nslookup app.localhost
dig app.localhost
```

**Configuration validation fails**:
```bash
# Check YAML syntax
node -e "console.log(require('yaml').parse(require('fs').readFileSync('configuration.yaml', 'utf8')))"

# Restore default development config
cp configuration.dev.yaml configuration.yaml
```

### Getting Help

1. **Check logs**: `pm2 logs` for detailed error messages
2. **Validate setup**: `node test.mjs` to check system health  
3. **Check status**: `node dev.mjs status` for development environment
4. **Reset everything**: `node dev.mjs cleanup` and start over

## 🚀 Moving to Production

Once you're satisfied with local testing:

1. **Stop development mode**:
   ```bash
   node dev.mjs stop
   ```

2. **Run production setup**:
   ```bash
   node setup.mjs
   ```

3. **Configure for your domain**:
   ```bash
   nano configuration.yaml  # Add your real domains
   nano applications.yaml   # Configure your real apps
   ```

4. **Enable HTTPS and Let's Encrypt**:
   ```yaml
   web_traffic:
     use_https: true
     http_port: 80
     https_port: 443
   
   certificates:
     lets_encrypt:
       contact_email: "your-email@example.com"
       use_production_server: true
   ```

5. **Apply production configuration**:
   ```bash
   node launcher.mjs validate
   node launcher.mjs update
   ```

## ⚡ Quick Reference

### Essential Commands
```bash
# Start development mode
./dev.sh start

# Check status  
./dev.sh status

# Stop and cleanup
./dev.sh cleanup

# Run tests
node test.mjs

# Build and validate
node launcher.mjs build
node launcher.mjs validate
```

### Test URLs (with /etc/hosts configured)
- http://localhost:8080 - Main interface
- http://redirect.localhost:8080 - Redirect test
- http://static.localhost:8080 - Static files
- http://app.localhost:8080 - Node.js proxy
- http://api.localhost:8080 - Python proxy

### Configuration Files
- `configuration.dev.yaml` - Development server settings
- `applications.dev.yaml` - Test application definitions
- `test-apps/` - Sample applications for testing

This testing setup lets you safely explore all of Frontstage's features without affecting your system or requiring real domains and certificates. Perfect for learning and development!