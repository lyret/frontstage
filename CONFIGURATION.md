# Frontstage Configuration Guide

This document provides detailed information about configuring Frontstage for your specific needs.

## Configuration Files

Frontstage uses two main YAML configuration files:

1. **`configuration.yaml`** - Server and system settings
2. **`applications.yaml`** - Application definitions and routing

## Manager Configuration (`configuration.yaml`)

### Logging Configuration

```yaml
logging:
  level: 40  # Log level: 10=trace, 20=debug, 30=info, 40=warn, 50=error
```

**Log Levels:**
- `10` (trace): Very detailed debugging information
- `20` (debug): Debugging information
- `30` (info): General information messages
- `40` (warn): Warning messages (default)
- `50` (error): Error messages only

### Web Traffic Configuration

```yaml
web_traffic:
  use_http: true          # Enable HTTP server
  http_port: 80           # HTTP port (usually 80)
  http_host: "0.0.0.0"    # HTTP bind address (0.0.0.0 = all interfaces)
  use_https: true         # Enable HTTPS server
  https_port: 443         # HTTPS port (usually 443)
  https_host: "0.0.0.0"   # HTTPS bind address
  use_forwarded_host: false # Use X-Forwarded-Host header for routing
```

**Important Notes:**
- If `use_https` is true and `use_http` is true, HTTP requests will redirect to HTTPS
- If only `use_http` is true, all traffic will be served over HTTP
- `use_forwarded_host` should be enabled if Frontstage is behind a reverse proxy

### Certificate Configuration

#### Self-Signed Certificates

```yaml
certificates:
  self_signed_certificates:
    country: "US"                    # Country code (2 letters)
    state: "California"              # State/Province
    locality: "San Francisco"        # City
    organization: "My Company Inc"   # Organization name
```

#### Let's Encrypt Configuration

```yaml
certificates:
  lets_encrypt:
    contact_email: "admin@example.com"    # Required: Contact email for Let's Encrypt
    use_production_server: true          # false = staging, true = production
```

**Let's Encrypt Notes:**
- Always test with `use_production_server: false` first
- Production server has strict rate limits (5 certificates per domain per week)
- Staging certificates won't be trusted by browsers but are good for testing
- Email is required for certificate expiry notifications

### DNS Records Configuration

Currently supports Loopia for Dynamic DNS updates:

```yaml
dns_records:
  loopia:
    username: "your-loopia-username"
    password: "your-loopia-api-password"
```

**DNS Provider Support:**
- **Loopia**: Full support for listing and updating A records
- Other providers can be added by implementing the DNS interface

### Process Management

```yaml
daemons:
  root_directory: "./apps"  # Base directory for application files
```

The `root_directory` is where Frontstage will look for your application files when using relative paths in process configurations.

## Application Configuration (`applications.yaml`)

Applications are defined as an array of objects. Each application can be one of several types:

### 1. HTTP Redirections

Simple redirects from one domain to another:

```yaml
- label: "redirect/old-site"
  hostname: "old-site.com"
  redirect: "https://new-site.com"
```

**Multiple hostnames:**
```yaml
- label: "redirect/multiple"
  hostnames:
    - "old-site.com"
    - "www.old-site.com"
  redirect: "https://new-site.com"
```

### 2. Reverse Proxy to Local Applications

Route requests to applications running on localhost:

```yaml
- label: "app/blog"
  hostname: "blog.example.com"
  port: 3000
```

**With process management:**
```yaml
- label: "app/blog"
  hostname: "blog.example.com"
  port: 3000
  process:
    cwd: "./blog-app"           # Working directory (relative to root_directory)
    script: "server.js"         # Script to execute
    args: "--production"        # Command line arguments
    interpreter: "node"         # Optional: specific interpreter
    env:                        # Environment variables
      NODE_ENV: "production"
      PORT: 3000
      DATABASE_URL: "sqlite:./data.db"
```

### 3. Static File Serving

Serve static files directly:

```yaml
- label: "static/portfolio"
  hostname: "portfolio.example.com"
  serve: "./static-files"       # Directory to serve (relative to root_directory)
```

## Process Configuration Options

### Basic Process Options

```yaml
process:
  cwd: "./app-directory"        # Working directory
  script: "app.js"              # Main script file
  args: "--port 3000"           # Command line arguments
  interpreter: "node"           # Interpreter (optional)
```

### Environment Variables

```yaml
process:
  env:
    NODE_ENV: "production"
    PORT: 3000
    API_KEY: "your-secret-key"
    DATABASE_URL: "postgresql://user:pass@localhost/db"
```

### Advanced Process Options

```yaml
process:
  cwd: "./app"
  script: "server.py"
  interpreter: "/usr/bin/python3"
  args: "--workers 4 --bind 0.0.0.0:8000"
  env:
    FLASK_ENV: "production"
    WORKERS: 4
```

## Application Examples

### Node.js Web Application

```yaml
- label: "app/web-store"
  hostname: "store.example.com"
  port: 3000
  process:
    cwd: "./web-store"
    script: "npm"
    args: "start"
    env:
      NODE_ENV: "production"
      PORT: 3000
      STRIPE_SECRET_KEY: "sk_live_..."
```

### Python Flask API

```yaml
- label: "api/backend"
  hostname: "api.example.com"
  port: 5000
  process:
    cwd: "./flask-api"
    script: "app.py"
    interpreter: "python3"
    env:
      FLASK_ENV: "production"
      DATABASE_URL: "postgresql://localhost/mydb"
```

### Static React Build

```yaml
- label: "frontend/app"
  hostname: "app.example.com"
  serve: "./react-build"
```

### Ghost Blog

```yaml
- label: "blog/ghost"
  hostname: "blog.example.com"
  port: 2368
  process:
    cwd: "./ghost-blog"
    script: "ghost"
    args: "run"
    env:
      NODE_ENV: "production"
      url: "https://blog.example.com"
```

### WordPress with PHP-FPM

```yaml
- label: "blog/wordpress"
  hostname: "wordpress.example.com"
  serve: "./wordpress"  # Serve PHP files directly if using PHP-FPM
```

## Hostname Configuration

### Single Hostname

```yaml
hostname: "example.com"
```

### Multiple Hostnames

```yaml
hostnames:
  - "example.com"
  - "www.example.com"
  - "alt.example.com"
```

### Wildcard Subdomains

```yaml
hostname: "*.example.com"  # Matches any subdomain
```

## Certificate Management

### Automatic Certificate Assignment

Frontstage automatically creates certificates for all configured hostnames:

- If Let's Encrypt is configured and working, it will be used
- Otherwise, self-signed certificates are generated
- Certificates are automatically renewed before expiry

### Certificate Renewal

```yaml
certificates:
  lets_encrypt:
    contact_email: "admin@example.com"
    use_production_server: true
  # Certificates renew automatically 30 days before expiry
```

### Manual Certificate Renewal

```bash
# Force renewal of all certificates
node launcher.mjs update
```

## Security Best Practices

### 1. Firewall Configuration

```bash
# Ubuntu/Debian with ufw
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# CentOS/RHEL with firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. User Permissions

```bash
# Create dedicated user
sudo useradd -m -s /bin/bash frontstage
sudo su - frontstage

# Install Frontstage as this user
```

### 3. Environment Variables

Never put secrets directly in configuration files:

```yaml
# BAD
env:
  API_KEY: "secret-key-here"

# GOOD
env:
  API_KEY: "${API_KEY}"  # Load from environment
```

### 4. File Permissions

```bash
# Secure configuration files
chmod 600 configuration.yaml applications.yaml
```

## Troubleshooting Configuration

### Validation

Always validate configuration before applying:

```bash
node launcher.mjs validate
```

### Common Configuration Errors

**Duplicate Labels:**
```yaml
# ERROR: Same label used twice
- label: "app/blog"
  hostname: "blog1.com"
- label: "app/blog"  # Duplicate!
  hostname: "blog2.com"
```

**Port Conflicts:**
```yaml
# ERROR: Same port used twice
- label: "app/one"
  hostname: "one.com"
  port: 3000
- label: "app/two"
  hostname: "two.com"
  port: 3000  # Conflict!
```

**Invalid Paths:**
```yaml
# ERROR: Path doesn't exist
process:
  cwd: "./nonexistent-directory"
```

### Debugging Configuration

```bash
# Check what's configured for a domain
node launcher.mjs lookup --domain example.com

# Check what's using a port
node launcher.mjs lookup --port 3000

# See current status
node launcher.mjs status
```

## Performance Considerations

### Application Resource Management

```yaml
# For resource-intensive applications
process:
  env:
    NODE_OPTIONS: "--max-old-space-size=4096"  # Increase memory limit
    UV_THREADPOOL_SIZE: 16                     # Increase thread pool
```

### Process Monitoring

```bash
# Monitor processes with PM2
pm2 monit

# View process logs
pm2 logs app-name
```

## Environment-Specific Configuration

### Development

```yaml
logging:
  level: 20  # Debug level

certificates:
  lets_encrypt:
    use_production_server: false  # Use staging

web_traffic:
  use_https: false  # HTTP only for development
  http_port: 8080   # Non-standard port
```

### Staging

```yaml
certificates:
  lets_encrypt:
    use_production_server: false  # Still use staging
    contact_email: "staging@example.com"
```

### Production

```yaml
logging:
  level: 40  # Warn level

certificates:
  lets_encrypt:
    use_production_server: true
    contact_email: "admin@example.com"

web_traffic:
  use_https: true
  use_http: true  # Redirect to HTTPS
```

## Migration and Backup

### Configuration Backup

```bash
# Backup configuration
cp configuration.yaml configuration.yaml.backup
cp applications.yaml applications.yaml.backup

# Backup database
cp -r .database .database.backup
```

### Migrating Applications

When moving applications, update the paths in `applications.yaml`:

```yaml
# Before
process:
  cwd: "./old-location/app"

# After
process:
  cwd: "./new-location/app"
```

Then apply changes:

```bash
node launcher.mjs update
```
