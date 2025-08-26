# Recipe Archive - Browser Extensions

This directory contains browser extensions for Chrome and Safari that can capture recipes from web pages.

## 🔧 Environment Configuration

The extensions automatically detect and switch between development and production environments:

### Automatic Detection
- **Development Mode**: Automatically enabled when:
  - Page is loaded from `localhost` or `127.0.0.1`
  - Manual override: `localStorage.setItem('recipeArchive.dev', 'true')`
- **Production Mode**: Used for all other cases

### API Endpoints

| Environment | Base URL | Recipes | Diagnostics | Health |
|-------------|----------|---------|-------------|--------|
| Development | `http://localhost:8080` | `/recipes` | `/diagnostics` | `/health` |
| Production | `https://api.recipearchive.com/v1` | `/recipes` | `/diagnostics` | `/health` |

### Manual Environment Control

You can override the environment detection in the browser console:

```javascript
// Enable development mode (use localhost)
RecipeArchiveConfig.enableDevelopment();

// Enable production mode (use AWS)
RecipeArchiveConfig.enableProduction();

// Toggle between environments
RecipeArchiveConfig.toggleEnvironment();

// Check current status
RecipeArchiveConfig.getStatus();
```

## 🚀 Quick Start

### Prerequisites
1. Local development server must be running for development mode:
   ```bash
   cd /path/to/RecipeArchive
   ./dev-tools/start-local-dev.sh
   ```

### Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `extensions/chrome/`
4. The extension will automatically use the appropriate environment

### Safari Extension
1. Open Safari Preferences > Advanced
2. Enable "Show Develop menu in menu bar"
3. Develop > Allow Unsigned Extensions (for development)
4. Load the extension from `extensions/safari/`

## 📁 Project Structure

```
extensions/
├── shared/           # Shared configuration
│   └── config.js     # Environment detection and API configuration
├── chrome/           # Chrome-specific extension
│   ├── config.js     # Symlink to shared/config.js
│   ├── manifest.json # Chrome extension manifest
│   ├── popup.html    # Extension popup UI
│   ├── popup.js      # Popup logic with environment-aware API calls
│   └── content.js    # Content script for recipe extraction
└── safari/           # Safari-specific extension
    ├── config.js     # Symlink to shared/config.js
    ├── manifest.json # Safari extension manifest
    ├── popup.html    # Extension popup UI
    ├── popup.js      # Popup logic with environment-aware API calls
    └── content.js    # Content script for recipe extraction
```

## 🔄 How Environment Switching Works

1. **Automatic Detection**: The `shared/config.js` detects the environment on load
2. **API Routing**: Extensions make API calls to the detected environment
3. **Development Mode**: 
   - Uses `http://localhost:8080` 
   - No authentication required
   - CORS enabled for extension development
4. **Production Mode**: 
   - Uses `https://api.recipearchive.com/v1`
   - Requires authentication (JWT tokens)
   - Rate limited and secure

## 🧪 Testing

### Test Local Development
```bash
# Start local server
./dev-tools/start-local-dev.sh

# Test the health endpoint
curl http://localhost:8080/health

# Test diagnostics endpoint
curl -X POST http://localhost:8080/diagnostics \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Test Production
- Production testing requires AWS credentials and deployed infrastructure
- Use the validation script: `./dev-tools/validate-env.sh`

## 🔍 Debugging

### Check Current Environment
In the browser console:
```javascript
console.log(RecipeArchiveConfig.getStatus());
```

### Monitor API Calls
1. Open browser developer tools
2. Go to Network tab
3. Trigger extension functionality
4. Look for API calls to either `localhost:8080` or `api.recipearchive.com`

### Extension Logs
- Chrome: Right-click extension icon → Inspect popup
- Safari: Develop menu → Show Extension Console

## 🔐 Authentication

### Development Mode
- No authentication required
- Mock authentication available for testing

### Production Mode
- JWT authentication required
- Tokens managed through Chrome/Safari storage
- Setup required through extension popup

## 🚨 Common Issues

### "Failed to fetch" Errors
1. **Development**: Ensure local server is running (`./dev-tools/start-local-dev.sh`)
2. **Production**: Check network connectivity and AWS service status

### Environment Not Switching
1. Clear browser storage: `localStorage.removeItem('recipeArchive.dev')`
2. Reload extension
3. Check console for configuration logs

### CORS Errors in Development
- Local server is configured with CORS headers for extension development
- If issues persist, restart local server

## 📝 Development Notes

- Both extensions share the same configuration system
- API endpoints are automatically selected based on environment
- Local development server mocks AWS API responses
- Production mode requires actual AWS authentication and credentials

## 🎯 Next Steps

- [ ] Implement automatic failover (production → development if AWS unavailable)
- [ ] Add extension settings UI for manual environment override
- [ ] Implement authentication flow for production mode
- [ ] Add offline storage for when neither environment is available
