# 🍽️ RecipeArchive End-to-End Integration Guide

## Overview

This document describes the complete end-to-end workflow from browser extension recipe capture to cloud storage in the RecipeArchive system.

## Architecture

```
Browser Extension → Recipe Extraction → Authentication → Local/AWS Backend → Storage
      ↓                    ↓                  ↓              ↓            ↓
   User clicks         Bypasses paywall   Mock/JWT tokens   API calls   Recipe database
   "Capture Recipe"    with saved cookies                                
```

## Components

### 1. 🔐 Authentication System
- **Washington Post Cookies**: `wapost-subscription-cookies.json` (480 cookies)
- **Purpose**: Bypass paywall for subscription-only recipes
- **Usage**: Automatically loaded by Playwright-based extraction

### 2. 🌐 Recipe Extraction
- **Engine**: Playwright browser automation
- **Target**: https://www.washingtonpost.com/recipes/chili-oil-noodles-steamed-bok-choy/
- **Method**: JSON-LD and DOM parsing
- **Output**: Structured recipe data (title, ingredients, instructions, etc.)

### 3. 🔄 Browser Extensions
- **Chrome**: `extensions/chrome/`
- **Safari**: `extensions/safari/`
- **Features**: Recipe capture, cloud sync, diagnostic mode
- **Configuration**: Auto-detects development vs production environment

### 4. ☁️ Backend APIs
- **Local Development**: `http://localhost:8080` (Go server, in-memory storage)
- **AWS Production**: `https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod`
- **Authentication**: Mock tokens (dev) / Cognito JWT (prod)

## Quick Start

### Prerequisites
1. Node.js and npm installed
2. Go installed for local backend
3. Washington Post subscription (for authenticated testing)

### Setup Steps

1. **Start Local Backend**
   ```bash
   cd aws-backend/functions/local-server
   go run main.go
   ```

2. **Capture Authentication (Optional)**
   ```bash
   node capture-wapost-cookies.js
   # Follow prompts to log into Washington Post
   ```

3. **Test Recipe Extraction**
   ```bash
   node dev-tools/test-wapost-extraction.js
   ```

4. **Run End-to-End Demo**
   ```bash
   ./dev-tools/demo-end-to-end.sh
   ```

### Manual Testing with Browser Extension

1. **Load Chrome Extension**
   - Open Chrome → More tools → Extensions
   - Enable "Developer mode"
   - Click "Load unpacked" → Select `extensions/chrome/`

2. **Test Recipe Capture**
   - Navigate to: https://www.washingtonpost.com/recipes/chili-oil-noodles-steamed-bok-choy/
   - Click extension icon
   - Click "Capture Recipe"
   - Review extracted data
   - Click "Save to Cloud"

3. **Verify Storage**
   ```bash
   curl "http://localhost:8080/api/recipes" \
     -H "Authorization: Bearer test-user-token"
   ```

## Environment Configuration

### Development Mode (Default)
- **Backend**: http://localhost:8080
- **Authentication**: Mock tokens (username-extension-token)
- **Storage**: In-memory (resets on restart)
- **Switch**: localStorage.setItem('recipeArchive.dev', 'true')

### Production Mode
- **Backend**: AWS API Gateway + Lambda
- **Authentication**: Cognito JWT tokens
- **Storage**: DynamoDB + S3
- **Switch**: localStorage.setItem('recipeArchive.dev', 'false')

## API Endpoints

### Local Development Server
```
GET  /health                    # Health check
POST /diagnostics               # Diagnostic data (no auth)
GET  /api/recipes               # List recipes (auth required)
POST /api/recipes               # Create recipe (auth required)
GET  /api/recipes/{id}          # Get recipe (auth required)
PUT  /api/recipes/{id}          # Update recipe (auth required)
DELETE /api/recipes/{id}        # Delete recipe (auth required)
```

### AWS Production
```
GET  /health                    # Health check (no auth)
POST /diagnostics               # Diagnostic data (no auth)
POST /recipes                   # Create recipe (Cognito JWT required)
GET  /recipes                   # List recipes (Cognito JWT required)
```

## Data Flow Example

1. **User Action**: Click "Capture Recipe" on Washington Post article
2. **Extension**: Inject content script, extract recipe data
3. **Authentication**: Load saved cookies, bypass paywall
4. **Parsing**: Extract title, ingredients, instructions from JSON-LD
5. **Storage**: Store in extension local storage
6. **Sync**: User clicks "Save to Cloud"
7. **API Call**: POST to backend with authentication header
8. **Backend**: Validate, store in database, return recipe ID
9. **UI Update**: Show success message with recipe ID

## Troubleshooting

### Common Issues

1. **"Missing Authentication Token"**
   - Ensure local backend is running for development mode
   - Check Authorization header format: `Bearer {token}`

2. **"Recipe capture failed"**
   - Verify Washington Post cookies are valid
   - Check browser console for JavaScript errors
   - Ensure content script injection is working

3. **"Sync failed"**
   - Confirm backend endpoint is reachable
   - Verify recipe data is stored locally first
   - Check network requests in browser dev tools

### Debug Commands

```bash
# Check local backend health
curl http://localhost:8080/health

# Check stored recipes
curl http://localhost:8080/api/recipes -H "Authorization: Bearer test-token"

# Test authentication system
node dev-tools/test-wapost-cookies.js

# Run all tests
./dev-tools/run-all-tests.sh
```

## Next Steps

1. **Production Deployment**
   - Implement Cognito authentication in extensions
   - Add user registration/login flow
   - Deploy extensions to Chrome/Safari stores

2. **Enhanced Features**
   - Batch recipe import
   - Recipe search and organization
   - Photo upload to S3
   - Recipe sharing

3. **Monitoring**
   - CloudWatch dashboards
   - Error tracking and alerts
   - Performance monitoring

## Security Notes

- **Development**: Uses mock authentication (not secure)
- **Production**: Requires Cognito JWT tokens
- **Cookies**: Washington Post credentials stored locally
- **CORS**: Configured for extension origins only
- **Rate Limiting**: AWS API Gateway enforced limits

---

*Last updated: August 24, 2025*
*For support: Check GitHub issues or discussion*
