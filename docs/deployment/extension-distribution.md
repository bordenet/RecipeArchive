# Extension Distribution Guide

RecipeArchive browser extensions can be distributed to friends for testing or published to official stores for public availability.

## ✅ Ready for Distribution

Extensions are packaged as ZIP files using the automated packaging script:

```bash
./scripts/package-extensions.sh
```

This creates distribution-ready packages in the `dist/` folder:
- `RecipeArchive-Chrome-YYYYMMDD.zip` (~46KB)
- `RecipeArchive-Safari-YYYYMMDD.zip` (~45KB)

## 🚀 Distribution Options

### Immediate Testing (Easiest for Friends)

#### Chrome Extension
1. Send them `RecipeArchive-Chrome-YYYYMMDD.zip`
2. They extract the ZIP file
3. Open `chrome://extensions/` in Chrome
4. Enable "Developer mode" (toggle in top right corner)
5. Click "Load unpacked" and select the extracted folder

#### Safari Extension
1. Send them `RecipeArchive-Safari-YYYYMMDD.zip`
2. They extract the ZIP file
3. Open `Safari > Preferences > Advanced`
4. Check "Show Develop menu in menu bar"
5. Go to `Develop > Allow Unsigned Extensions`
6. Drag the extracted folder to Safari or use Safari's extension loading

### Production Distribution (Public Release)

#### Chrome Web Store
- **Cost:** $5 one-time developer registration fee
- **Process:** Upload ZIP file to Chrome Developer Dashboard
- **Timeline:** Review process typically takes 1-7 days
- **Requirements:** Google Developer account

#### Safari App Store
- **Cost:** $99/year Apple Developer Program membership
- **Process:** Upload ZIP to App Store Connect (Apple converts automatically)
- **Timeline:** Review process typically takes 1-7 days
- **Requirements:** Apple Developer Program membership

### Advanced Distribution (For Power Users)

#### Chrome .crx Files
Create installable `.crx` files:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Pack extension"
4. Select extension folder
5. Chrome creates `.crx` file and private key

**Security Note:** Keep the `.pem` private key file secure - it's needed for updates.

#### Safari Developer ID Signing
With Safari 18.4+, properly signed extensions work without "Allow Unsigned Extensions":
- Requires Apple Developer ID certificate
- Must be notarized through Apple's notary service
- Extensions are recognized as legitimate by Safari

## 🔧 Development Workflow

### 1. Testing Phase
- Use developer/unsigned installation methods
- Gather feedback from friends and beta testers
- Iterate based on user experience

### 2. Pre-Production
- Test on multiple browser versions
- Verify all supported sites work correctly
- Ensure authentication flow is smooth

### 3. Store Submission
- Register developer accounts when ready for public distribution
- Prepare store listings (descriptions, screenshots, etc.)
- Submit to Chrome Web Store and/or Safari App Store

### 4. Post-Launch
- Monitor user reviews and feedback
- Update extensions based on site changes
- Maintain compatibility with browser updates

## 📋 Extension Features

The current extensions include:

### Core Functionality
- ✅ **Dynamic button states** - Enabled/disabled based on site support
- ✅ **AWS recipe ID display** - Shows unique identifier in success messages
- ✅ **Full authentication integration** - AWS Cognito sign-in with JWT tokens
- ✅ **TypeScript parser system** - Supports 11+ recipe sites with fallback parsing

### Technical Features
- ✅ **Failed parsing diagnostics** - HTML submission to dedicated S3 bucket for debugging
- ✅ **Site detection** - Real-time checking of supported vs unsupported sites
- ✅ **Cross-browser compatibility** - Works in both Chrome and Safari with unified codebase
- ✅ **Production-ready authentication** - Secure token management and storage

### Supported Recipe Sites
- Smitten Kitchen
- Love and Lemons
- Food52
- Food Network
- Epicurious
- NYT Cooking
- AllRecipes
- Serious Eats
- Washington Post
- Food & Wine
- Damn Delicious

## 🛠️ Maintenance

### Regular Updates
Run the packaging script anytime to create fresh distributions:
```bash
./scripts/package-extensions.sh
```

### Version Management
- Update `manifest.json` version numbers before packaging
- Maintain changelog for user-facing updates
- Test thoroughly before each release

### Debugging
- Failed parsing data is automatically submitted to AWS S3
- Console logs provide detailed extraction information
- Diagnostic endpoints help identify parsing issues

---

*For technical implementation details, see the [Browser Extension PRD](../requirements/browser-extension.md) and [AWS Backend PRD](../requirements/aws-backend.md).*