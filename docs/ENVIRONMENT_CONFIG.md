# Recipe Archive - Environment Configuration Summary

## 🧹 Project Cleanup Complete

### Organized Directory Structure
```
RecipeArchive/
├── dev-tools/               # 🆕 All development scripts and docs
│   ├── setup.sh            # Universal setup with OS detection
│   ├── setup-local-env.sh  # Cross-platform local environment
│   ├── start-local-dev.sh  # Start local server
│   ├── stop-local-dev.sh   # Stop local server
│   ├── test-local-env.sh   # Test environment
│   ├── validate-env.sh     # Comprehensive validation
│   └── *.md                # All development documentation
├── extensions/              # Browser extensions
│   ├── shared/             # 🆕 Shared configuration
│   │   └── config.js       # Environment detection & API routing
│   ├── chrome/             # Chrome extension
│   │   ├── config.js       # 🆕 Symlink to shared config
│   │   └── ...            # Extension files
│   └── safari/             # Safari extension
│       ├── config.js       # 🆕 Symlink to shared config
│       └── ...            # Extension files
└── setup.sh               # 🆕 Convenience script → dev-tools/setup.sh
```

## 🔄 Browser Extension Environment Configuration

### Automatic Environment Detection

Both **Chrome** and **Safari** extensions now automatically detect and switch between:

#### 🏠 Development Mode (localhost)
- **Trigger**: Automatically enabled when:
	- Page loads from `localhost` or `127.0.0.1`
	- Manual override: `localStorage.setItem('recipeArchive.dev', 'true')`
- **API Base**: `http://localhost:8080`
- **Endpoints**:
	- Health: `http://localhost:8080/health`
