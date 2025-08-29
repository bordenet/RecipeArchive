# RecipeArchive Mobile PWA

A Progressive Web App (PWA) that brings RecipeArchive functionality to iPhone, iPad, and Android devices.

## 🚀 Quick Start

### For Your Friends (Easy Setup)

1. **Start the mobile server:**
   ```bash
   cd mobile
   npm install
   npm start
   ```

2. **Open on mobile device:**
   - Visit `http://your-computer-ip:3000` on their phone/tablet
   - Or use ngrok for external access: `npx ngrok http 3000`

3. **Install as app:**
   - **iPhone/iPad**: Safari → Share → "Add to Home Screen"
   - **Android**: Chrome → Menu → "Add to Home screen"

### For Production (Advanced)

Deploy to Vercel, Netlify, or any hosting service that supports Node.js.

## 📱 How It Works

### Supported Mobile Browsers
- ✅ **Safari on iOS/iPadOS** - Full PWA support
- ✅ **Chrome on Android** - Full PWA support  
- ✅ **Firefox on Android** - Good PWA support
- ⚠️ **Chrome on iOS** - Basic web app (no extensions)

### Features
- 📱 **Install as native app** - Add to home screen for app-like experience
- 🔄 **Offline functionality** - Service worker caches app for offline use
- 🌐 **Recipe URL capture** - Paste recipe URLs to extract and save
- 📤 **Share integration** - Use device share sheet to capture recipes
- 🔍 **Site support detection** - Shows which recipe sites are supported
- ☁️ **Cloud sync** - Saves to same AWS backend as desktop extensions

### User Experience
1. User opens mobile app (PWA)
2. Pastes a recipe URL from a supported site
3. App extracts recipe data using same parsers as desktop
4. Saves to AWS backend with same authentication
5. Recipe appears in their collection across all devices

## 🛠️ Technical Details

### Architecture
- **Frontend**: Vanilla HTML/CSS/JS PWA
- **Backend**: Express.js API server
- **Offline**: Service Worker with IndexedDB storage
- **Parsing**: Reuses TypeScript parser logic from desktop extensions
- **Authentication**: Integrates with existing AWS Cognito setup

### API Endpoints
```
POST /api/mobile/capture     # Capture recipe from URL
GET  /api/mobile/supported-sites # Get list of supported sites  
GET  /api/mobile/health      # Health check
```

### File Structure
```
mobile/
├── index.html          # PWA main interface
├── manifest.json       # PWA manifest for installation
├── sw.js              # Service worker for offline functionality
├── api.js             # Express server and recipe parsing logic
├── package.json       # Node.js dependencies
└── README.md          # This file
```

## 🔧 Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Or start production server
npm start
```

### Testing on Mobile
1. **Same WiFi Network:**
   - Find your computer's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
   - Visit `http://192.168.1.xxx:3000` on mobile device

2. **External Access (ngrok):**
   ```bash
   # Install ngrok: npm install -g ngrok
   npm start
   # In another terminal:
   ngrok http 3000
   # Use the https URL provided by ngrok
   ```

3. **Mobile Browser DevTools:**
   - Chrome: `chrome://inspect` → Remote devices
   - Safari: Enable Web Inspector on iOS device

### Customization
- Modify `index.html` for UI changes
- Update `manifest.json` for app metadata (name, icons, colors)
- Extend `api.js` for additional recipe sites or features
- Edit `sw.js` for offline behavior customization

## 📋 Supported Recipe Sites

Same sites as desktop extensions:
- Smitten Kitchen
- Food Network  
- NYT Cooking
- Food52
- AllRecipes
- Serious Eats
- Love & Lemons
- Epicurious
- Food & Wine
- Washington Post
- Damn Delicious

## 🚀 Deployment Options

### Free Hosting Services
1. **Vercel** (Recommended)
   ```bash
   npm install -g vercel
   vercel --prod
   ```

2. **Netlify**
   - Connect GitHub repo
   - Build command: `npm install`
   - Publish directory: `mobile`

3. **Railway**
   ```bash
   npm install -g @railway/cli
   railway login
   railway deploy
   ```

4. **Heroku**
   ```bash
   git subtree push --prefix mobile heroku main
   ```

### Self-Hosting
- Any VPS with Node.js support
- Use PM2 for process management
- Setup nginx reverse proxy
- Enable HTTPS for PWA features

## 🔍 Troubleshooting

### PWA Not Installing
- Ensure HTTPS (required for PWA features)
- Check browser support for PWA installation
- Verify manifest.json is accessible

### Recipe Extraction Failing  
- Check if site is in supported list
- Verify API server is running
- Check network connectivity
- Look at browser console for errors

### Offline Functionality Not Working
- Ensure service worker is registered
- Check if site was visited while online first
- Verify IndexedDB is supported in browser

## 🎯 Future Enhancements

### Short Term
- Enhanced recipe parsing for more sites  
- Better offline recipe management
- Photo capture for recipe cards
- Improved mobile UI/UX

### Long Term
- Native iOS app (App Store distribution)
- Native Android app (Google Play)
- OCR for recipe cards and cookbooks
- Voice input for manual recipe entry
- Social features and recipe sharing

---

*This PWA provides immediate mobile access to RecipeArchive functionality while the desktop extensions remain the primary full-featured experience.*