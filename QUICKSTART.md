# Frontstage Quick Start Guide

Get Frontstage running in 5 minutes! This guide shows you the fastest way to test and use Frontstage for self-hosting web applications.

## 🚀 Option 1: Local Testing (Recommended First)

Perfect for testing without affecting your system or requiring root access.

```bash
# 1. Validate your setup
node test.mjs

# 2. Start development mode
node dev.mjs start

# 3. Test the interface
curl http://localhost:8080

# 4. Stop when done
node dev.mjs stop
```

**What you get:**
- Safe testing environment on port 8080
- No certificates or DNS changes
- Sample applications to test with
- Web GUI interface
- Easy cleanup

## 🏗 Option 2: Production Setup

For actual hosting with real domains and SSL certificates.

```bash
# 1. Run automated setup
node setup.mjs

# 2. Configure your domains
nano applications.yaml

# 3. Apply configuration
node launcher.mjs update

# 4. Check status
node launcher.mjs status
```

**What you get:**
- Production web server on ports 80/443
- Automatic SSL certificates
- Real domain routing
- Process management
- DNS integration (optional)

## 📋 Requirements

- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org)
- **PM2**: Installed automatically by setup script
- **Linux/macOS**: Tested on Ubuntu, Debian, CentOS, macOS

## ⚡ Quick Commands

```bash
# System status
node launcher.mjs status

# Validate configuration
node launcher.mjs validate

# Apply changes
node launcher.mjs update

# DNS records
node launcher.mjs dns

# Look up domain
node launcher.mjs lookup --domain example.com
```

## 🌐 Example Application Setup

Add to `applications.yaml`:

```yaml
# Simple redirect
- label: "redirect/old-site"
  hostname: "old.example.com"
  redirect: "https://new.example.com"

# Node.js application
- label: "app/blog"
  hostname: "blog.example.com"
  port: 3000
  process:
    cwd: "./blog-app"
    script: "server.js"
    env:
      NODE_ENV: "production"
      PORT: 3000

# Static website
- label: "static/portfolio"
  hostname: "portfolio.example.com"
  serve: "./static-files"
```

## 🔧 Configuration Files

### Manager Settings (`configuration.yaml`)

```yaml
# Basic production config
web_traffic:
  use_https: true
  http_port: 80
  https_port: 443

certificates:
  lets_encrypt:
    contact_email: "admin@example.com"
    use_production_server: true

daemons:
  root_directory: "./apps"
```

### Development Settings (`configuration.dev.yaml`)

```yaml
# Safe development config
web_traffic:
  use_https: false
  http_port: 8080
  http_host: 127.0.0.1

# Certificates disabled for development
development:
  skip_certificates: true
```

## 🎯 Common Use Cases

### Personal Blog
```yaml
- label: "blog/personal"
  hostname: "myblog.com"
  port: 3000
  process:
    cwd: "./my-blog"
    script: "npm"
    args: "start"
```

### Static Portfolio
```yaml
- label: "portfolio/main"
  hostname: "myportfolio.com"
  serve: "./portfolio-build"
```

### API Server
```yaml
- label: "api/backend"
  hostname: "api.myapp.com"
  port: 8080
  process:
    cwd: "./api-server"
    script: "app.py"
    interpreter: "python3"
```

### Multiple Domains
```yaml
- label: "site/main"
  hostnames:
    - "example.com"
    - "www.example.com"
  serve: "./website"
```

## 🐛 Troubleshooting

**Port 80/443 permission denied:**
```bash
# Use development mode instead
node dev.mjs start

# Or run setup as root (not recommended)
sudo node setup.mjs
```

**Configuration errors:**
```bash
# Validate configuration
node launcher.mjs validate

# Check specific domain
node launcher.mjs lookup --domain example.com
```

**Process won't start:**
```bash
# Check PM2 status
pm2 list
pm2 logs

# Restart application
pm2 restart all
```

**SSL certificate issues:**
```bash
# Check certificate status
node launcher.mjs status

# Force certificate renewal
node launcher.mjs update
```

## 📚 Next Steps

1. **Read the full documentation:**
   - [`README.md`](README.md) - Complete overview
   - [`CONFIGURATION.md`](CONFIGURATION.md) - Detailed configuration
   - [`TESTING.md`](TESTING.md) - Development and testing guide

2. **Try the web GUI:**
   - Add GUI to your applications.yaml
   - Visit your configured hostname
   - Manage applications through the interface

3. **Set up SSL certificates:**
   - Configure Let's Encrypt in configuration.yaml
   - Ensure domains point to your server
   - Test with staging before production

4. **Add your applications:**
   - Place application files in `./apps/`
   - Configure in applications.yaml
   - Apply changes with `node launcher.mjs update`

## 🆘 Getting Help

- **Test your setup:** `node test.mjs`
- **Check system status:** `node launcher.mjs status`
- **Validate config:** `node launcher.mjs validate`
- **View logs:** `pm2 logs`
- **Development mode:** `node dev.mjs status`

## 🎉 Success!

If you can access your applications through Frontstage, congratulations! You now have:

✅ **Web server** with automatic routing  
✅ **SSL certificates** managed automatically  
✅ **Process management** with auto-restart  
✅ **Configuration management** with validation  
✅ **Web GUI** for easy administration  
✅ **DNS integration** (if configured)  

You're ready to self-host your web applications with confidence!

---

**Pro Tip:** Start with development mode (`node dev.mjs start`) to learn how everything works, then move to production setup (`node setup.mjs`) when you're ready to host real applications.