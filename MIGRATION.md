# Migration Guide: Shell Scripts → JavaScript Scripts

This document explains the transition from shell scripts (`.sh`) to JavaScript scripts (`.mjs`) in Frontstage for better cross-platform compatibility.

## 🔄 Script Migration

The following shell scripts have been replaced with JavaScript equivalents:

| Old Shell Script | New JavaScript Script | NPM Script Alternative |
|------------------|----------------------|------------------------|
| `./dev.sh` | `node dev.mjs` | `npm run dev` |
| `./diagnose.sh` | `node diagnose.mjs` | `npm run diagnose` |
| `./setup.sh` | `node setup.mjs` | `npm run setup` |

## 📋 Command Migration Table

### Development Commands
| Old Command | New Command | NPM Alternative |
|-------------|-------------|----------------|
| `./dev.sh start` | `node dev.mjs start` | `npm run dev:start` |
| `./dev.sh stop` | `node dev.mjs stop` | `npm run dev:stop` |
| `./dev.sh status` | `node dev.mjs status` | `npm run dev:status` |
| `./dev.sh restart` | `node dev.mjs restart` | `npm run dev:restart` |
| `./dev.sh cleanup` | `node dev.mjs cleanup` | `npm run dev:cleanup` |
| `./dev.sh build` | `node dev.mjs build` | `npm run setup:build` |
| `./dev.sh validate` | `node dev.mjs validate` | - |
| `./dev.sh logs` | `node dev.mjs logs` | - |

### Diagnostic Commands
| Old Command | New Command | NPM Alternative |
|-------------|-------------|----------------|
| `./diagnose.sh` | `node diagnose.mjs` | `npm run diagnose` |
| `./diagnose.sh ports` | `node diagnose.mjs ports` | `npm run diagnose:ports` |
| `./diagnose.sh cleanup` | `node diagnose.mjs cleanup` | `npm run diagnose:cleanup` |

### Setup Commands
| Old Command | New Command | NPM Alternative |
|-------------|-------------|----------------|
| `./setup.sh` | `node setup.mjs` | `npm run setup` |
| - | `node setup.mjs check` | `npm run setup:check` |
| - | `node setup.mjs build` | `npm run setup:build` |
| - | `node setup.mjs service` | `npm run setup:service` |

## 🚀 Quick Migration

### Update Your Existing Commands

If you have scripts or documentation that reference the old shell scripts:

```bash
# Replace these patterns:
./dev.sh → node dev.mjs
./diagnose.sh → node diagnose.mjs  
./setup.sh → node setup.mjs

# Or use npm scripts:
./dev.sh start → npm run dev:start
./dev.sh stop → npm run dev:stop
./setup.sh → npm run setup
```

### Update Aliases (Optional)

If you prefer shorter commands, you can create aliases:

```bash
# Add to your ~/.bashrc or ~/.zshrc
alias dev='node dev.mjs'
alias diagnose='node diagnose.mjs'
alias setup='node setup.mjs'

# Then use:
dev start
dev stop
diagnose
setup
```

## ✨ Improvements in JavaScript Scripts

The new JavaScript scripts offer several advantages:

### Cross-Platform Compatibility
- **Windows**: Full support including WSL detection
- **macOS**: Native LaunchAgent support
- **Linux**: Enhanced systemd integration

### Better Error Handling
- More descriptive error messages
- Colored output for better readability
- Context-aware troubleshooting hints

### Enhanced Features
- **Port Detection**: Automatic port conflict resolution
- **Process Management**: Improved PID file handling
- **Configuration Validation**: Better YAML error reporting
- **Network Checks**: Cross-platform network testing

### Developer Experience
- **Consistent Interface**: Same command structure across platforms
- **NPM Integration**: Use familiar `npm run` commands
- **IDE Support**: JavaScript debugging and IntelliSense
- **Extensibility**: Easier to modify and extend

## 🔧 Troubleshooting

### Old Shell Scripts Not Working?

If you encounter `command not found` errors:

```bash
# Old (may not work):
./dev.sh start

# New (works everywhere):
node dev.mjs start

# Or:
npm run dev:start
```

### Permission Issues?

The JavaScript scripts don't require execute permissions:

```bash
# No need for this anymore:
chmod +x dev.sh

# These work regardless of file permissions:
node dev.mjs start
npm run dev:start
```

### Missing Dependencies?

Ensure you have the required Node.js version:

```bash
# Check Node.js version (requires 18+)
node --version

# Install dependencies
npm install
```

## 📚 Documentation Updates

The following documentation has been updated to reflect the new scripts:

- **QUICKSTART.md**: All shell script references updated
- **TESTING.md**: Development workflow updated
- **README.md**: New development scripts section added
- **CHANGELOG.md**: Migration noted

## 🗂 File Status

### Removed Files
The shell scripts are **deprecated** but may still exist:
- `dev.sh` → Use `node dev.mjs`
- `diagnose.sh` → Use `node diagnose.mjs`
- `setup.sh` → Use `node setup.mjs`

### New Files
- `dev.mjs` - Development environment manager
- `diagnose.mjs` - System diagnostic tool
- `setup.mjs` - Production setup script
- `MIGRATION.md` - This migration guide

## 💡 Best Practices

### For New Users
Start with the JavaScript scripts from the beginning:
```bash
node dev.mjs start    # Start development
node diagnose.mjs     # Check system health
node setup.mjs        # Production setup
```

### For Existing Users
Update your workflows gradually:
```bash
# Old workflow:
./dev.sh start && curl http://localhost:8080

# New workflow:
npm run dev:start && curl http://localhost:8080
```

### For CI/CD
Use the NPM scripts for consistency:
```yaml
# GitHub Actions example
- name: Start development environment  
  run: npm run dev:start

- name: Run diagnostics
  run: npm run diagnose

- name: Stop development environment
  run: npm run dev:stop
```

## ❓ FAQ

### Q: Why the change from shell scripts to JavaScript?
**A**: Better cross-platform support, improved error handling, and easier maintenance for a Node.js project.

### Q: Will the old shell scripts be removed?
**A**: They are deprecated and may be removed in a future version. Please migrate to the JavaScript scripts.

### Q: Can I still use the shell scripts for now?
**A**: Yes, they may still exist but are no longer maintained. We recommend migrating to avoid issues.

### Q: Do I need to reinstall anything?
**A**: No, just use the new commands. The JavaScript scripts use the same underlying functionality.

### Q: Are there any breaking changes?
**A**: The functionality is the same, only the command syntax has changed. Follow the migration table above.

---

For questions or issues with the migration, please check the diagnostic tool:
```bash
node diagnose.mjs
```
