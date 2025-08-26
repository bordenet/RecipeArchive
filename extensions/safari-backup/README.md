# RecipeArchive Safari Web Extension

## Overview

The RecipeArchive Safari Web Extension provides full feature parity with the Chrome extension, designed to work seamlessly on both **Safari desktop** and **Safari mobile** (iPhone/iPad) browsers.

## Features

### 🍰 Complete Feature Parity

- **One-click recipe capture** from Smitten Kitchen (with more sites coming soon)
- **Authentication system** with secure local storage
- **Cross-device sync** capabilities (future AWS backend integration)
- **Offline access** with local recipe storage
- **Full page HTML archiving** for permanent recipe preservation
- **Clean, ad-free recipe display** optimized for cooking

### 📱 Safari Mobile Optimizations

- **Touch-friendly UI** with 44px minimum touch targets
- **iOS-style design** using Apple's system fonts and colors
- **Dark mode support** that respects system preferences
- **Responsive layout** that works on iPhone and iPad
- **Safari-specific APIs** for optimal performance
- **Smooth scrolling** with `-webkit-overflow-scrolling: touch`

### 💻 Safari Desktop Support

- **Native macOS styling** with system fonts and blur effects
- **Full keyboard navigation** support
- **macOS color schemes** (light and dark mode)
- **Native Safari Web Extension** APIs

## Installation

### Safari Desktop (macOS)

1. Open Safari and go to **Safari > Preferences > Extensions**
2. Enable **Developer** menu: **Develop > Allow Unsigned Extensions** (for development)
3. Click **"+"** and select the Safari extension folder
4. The extension will appear in Safari's toolbar

### Safari Mobile (iOS/iPadOS)

1. In Safari on iOS, go to **Settings > Safari > Extensions**
2. Enable the RecipeArchive extension
3. The extension will be available in the share sheet and toolbar

## Development Setup

### Prerequisites

- macOS with Safari 14+
- iOS/iPadOS 14+ for mobile testing
- Xcode (optional, for advanced debugging)

### Quick Setup

```bash
cd extensions/safari

# Copy sample configuration
cp config.sample.json config.json

# Edit config.json with your credentials
# For testing, use environment variables: RECIPE_TEST_USER and RECIPE_TEST_PASS

# Validate extension structure
npm run validate
```

### Loading in Safari

1. Enable Safari's **Developer** menu
2. Go to **Develop > Allow Unsigned Extensions**
3. Open **Safari Preferences > Extensions**
4. Click **"+"** and select this directory
5. Enable the extension in the list

### Mobile Testing

1. Connect your iOS device to your Mac
2. Enable **Web Inspector** in Safari on iOS
3. Open Safari on Mac and go to **Develop > [Your Device] > Safari**
4. Test the extension on recipe sites

## Authentication Configuration

### Development Credentials

For development/testing, use environment variables:
```bash
export RECIPE_TEST_USER="your-test-username"
export RECIPE_TEST_PASS="your-test-password"
```

### Production Setup

1. Copy `config.sample.json` to `config.json`
2. Update credentials:
   ```json
   {
     "auth": {
       "username": "your-username",
       "password": "your-password"
     },
     "api": {
       "baseUrl": "https://your-api-endpoint.com"
     },
     "safari": {
       "enableMobileSupport": true,
       "enableDesktopSupport": true,
       "debugMode": false
     }
   }
   ```

## Browser Compatibility

### Supported Safari Versions

- **Safari 14+** (macOS Big Sur and later)
- **Safari 14+** (iOS/iPadOS 14 and later)
- **Safari Technology Preview** (latest)

### Cross-Browser API Support

The extension uses cross-browser compatibility shims:

```javascript
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
```

This ensures the same code works in both Safari and Chrome environments.

## Architecture

### Key Differences from Chrome Extension

| Feature            | Chrome                 | Safari                     |
| ------------------ | ---------------------- | -------------------------- |
| **API Namespace**  | `chrome.*`             | `browser.*` or `chrome.*`  |
| **Storage**        | `chrome.storage.local` | `browserAPI.storage.local` |
| **Tabs**           | `chrome.tabs`          | `browserAPI.tabs`          |
| **Styling**        | Material Design        | Apple HIG                  |
| **Colors**         | `#4CAF50`              | `#007AFF` (iOS blue)       |
| **Mobile Support** | Limited                | Full iOS optimization      |

### File Structure

```
safari/
├── manifest.json          # Safari Web Extension manifest
├── content.js             # Recipe extraction (cross-browser)
├── popup.html             # Main UI (Safari-optimized)
├── popup.js              # Popup logic (Safari APIs)
├── setup.html            # Auth setup (iOS-optimized)
├── setup.js              # Auth handling (cross-browser)
├── background.js         # Service worker (minimal)
├── config.sample.json    # Configuration template
├── config.json          # Local config (gitignored)
├── icon*.png            # Cake-themed icons (all sizes)
└── README.md            # This file
```

## Testing

### Manual Testing Checklist

- [ ] Extension loads without errors in Safari
- [ ] Authentication setup works on desktop and mobile
- [ ] Recipe capture works on Smitten Kitchen
- [ ] Popup displays correctly on desktop and mobile
- [ ] Dark mode switches properly
- [ ] Touch interactions work smoothly on iOS
- [ ] Data persists between browser sessions
- [ ] Offline access works without internet

### Debug Mode

Enable debug mode in `config.json`:

```json
{
  "safari": {
    "debugMode": true
  }
}
```

This enables:

- Verbose console logging
- Additional error information
- Performance timing logs

## Known Limitations

### Current MVP Restrictions

- **Single-site support:** Only Smitten Kitchen currently supported
- **Basic authentication:** Simple username/password (AWS Cognito coming)
- **No tests:** Test suite not yet implemented for Safari
- **Manual installation:** Not available in Safari Extensions Gallery

### Safari-Specific Notes

- **iOS Restrictions:** Some APIs limited on mobile Safari
- **Unsigned Extensions:** Requires developer mode for local development
- **Content Script Injection:** Slight delay on initial load
- **File Downloads:** HTML archive downloads work differently on iOS

## Future Enhancements

### Planned Features

- **Multi-site support:** Washington Post, NYT Cooking, Food & Wine
- **AWS Backend:** Full cloud sync and storage
- **Native App Integration:** Deep linking with future iOS app
- **Advanced Authentication:** AWS Cognito integration
- **Push Notifications:** Recipe sync and backup alerts

### iOS-Specific Improvements

- **Share Sheet Integration:** Capture recipes from Safari share sheet
- **Siri Shortcuts:** Voice-activated recipe capture
- **Widget Support:** Recent recipes widget for home screen
- **iCloud Sync:** Native Apple ecosystem integration

## Contributing

### Safari-Specific Guidelines

1. **Test on both platforms:** Always verify desktop and mobile Safari
2. **Use Apple HIG:** Follow Apple's Human Interface Guidelines
3. **Responsive design:** Ensure layouts work on all screen sizes
4. **Touch accessibility:** Maintain 44px minimum touch targets
5. **Performance:** Optimize for mobile Safari's memory constraints

### Code Style

- Use **Apple system fonts:** `-apple-system, BlinkMacSystemFont`
- Use **iOS colors:** `#007AFF` for primary actions
- Use **Safari-safe APIs:** Check compatibility before using new APIs
- Use **cross-browser patterns:** Always use `browserAPI` wrapper

## Security & Privacy

### Data Handling

- **Local storage only:** All data stored locally in Safari
- **No tracking:** Extension does not track user behavior
- **HTTPS required:** All external requests use secure connections
- **Credential protection:** Passwords stored in browser secure storage

### Permissions Used

- `storage` - Local recipe and credential storage
- `activeTab` - Recipe extraction from current page
- `scripting` - Content script injection for extraction
- `<all_urls>` - Access to recipe sites (host permissions)

---

## Support

### Getting Help

- **Issues:** [GitHub Issues](https://github.com/your-username/RecipeArchive/issues)
- **Documentation:** [Main README](../../README.md)
- **Development:** See [claude-context.md](../../docs/development/claude-context.md) for technical details

### Safari-Specific Issues

When reporting Safari issues, please include:

- Safari version and build number
- macOS or iOS version
- Device type (Mac, iPhone, iPad)
- Console error messages (if any)
- Steps to reproduce

**Built with 🍰 for recipe lovers using Safari**
