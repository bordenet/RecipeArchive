# ⚠️ CRITICAL: New Adopters Must Configure Extensions

## 🚨 SECURITY WARNING

The browser extensions in this directory are designed to work with **YOUR AWS infrastructure**, not the original developer's.

**These extensions will NOT work until you configure them with your own AWS resources.**

The extensions require:
- Your AWS Cognito User Pool and App Client IDs
- Your API Gateway endpoint
- Your CloudFront distribution URL
- Your S3 bucket names

## ✅ Required Setup for New Adopters

### 1. Deploy Your Own AWS Infrastructure

Follow the setup guide in `docs/setup/aws-setup.md` to create your own:
- AWS Cognito User Pool and App Client
- API Gateway
- S3 Buckets
- CloudFront Distribution (for Flutter web app)
- Lambda Functions (for backend processing)

### 2. Configure Your Environment

```bash
# In the project root directory
cp .env.example .env

# Edit .env with YOUR AWS infrastructure details
# Required variables:
#   - AWS_REGION
#   - COGNITO_USER_POOL_ID (from AWS Cognito Console)
#   - COGNITO_APP_CLIENT_ID (from your User Pool's App Clients)
#   - API_BASE_URL (your API Gateway URL)
#   - WEB_APP_URL (your CloudFront distribution URL)
#   - S3_RECIPE_STORAGE_BUCKET (your S3 bucket name)
```

### 3. Run the Setup Script

```bash
# This generates extension configuration files from your .env
./scripts/setup-new-adopter-environment.sh
```

### 4. Build Extensions

```bash
# Build parser bundle and generate all configuration files
npm run build:extensions
```

### 5. Install Extensions

**Chrome:**
```bash
# Load unpacked extension from:
extensions/chrome/
```

**Safari:**
Requires Xcode and Safari developer certificate. See `docs/technical/SAFARI_WEB_EXTENSION_SETUP.md` for details.

## 🔍 How Configuration Works

The setup process generates **gitignored configuration files** that contain your AWS infrastructure details:

**Generated Files (never committed to git):**
- `extensions/chrome/env-config.js` - Your AWS configuration
- `extensions/chrome/manifest.json` - Chrome manifest with your API endpoints
- `extensions/safari/env-config.js` - Your AWS configuration
- `extensions/safari/manifest.json` - Safari manifest
- `extensions/shared/env-config.js` - Shared configuration

**Source Files (committed to git):**
- `extensions/chrome/manifest.template.json` - Template for manifest generation
- `extensions/chrome/config.js` - Loads configuration from env-config.js
- All other extension source code

## 🏗️ Build Process Architecture

```
.env (your secrets)
  ↓
npm run build:extension-env
  ↓
generates → env-config.js (gitignored, contains your AWS values)
generates → manifest.json (gitignored, contains your API permissions)
  ↓
config.js loads values from env-config.js at runtime
```

**Key Benefits:**
- ✅ Source code remains clean and generic
- ✅ Your AWS credentials never get committed to git
- ✅ No forks required - just configure .env and build
- ✅ Easy to update configuration by re-running build

## 🚫 DO NOT Skip Configuration

If you skip the configuration step, your extensions will:
- Fail to load (missing env-config.js)
- Show error messages about missing configuration
- Not authenticate with AWS
- Not work at all

## 💡 Why This Architecture?

Browser extensions run in isolation and cannot access:
- Local environment variables at runtime
- The project's `.env` file
- Node.js modules

Therefore, we use a **build-time code generation** approach:
1. Your secrets live in `.env` (gitignored)
2. Build script reads `.env` and generates `env-config.js` (gitignored)
3. Extensions load `env-config.js` at runtime
4. Source code stays clean and generic in git

## 🔄 Updating Your Configuration

If you change AWS infrastructure:

```bash
# 1. Update .env with new values
vim .env

# 2. Regenerate configuration files
npm run build:extension-env

# 3. Reload extension in browser
```

No source code changes needed!

## 📦 Distribution to Other Users

If you want to share built extensions with your users:

```bash
# Package extensions with your configuration
./scripts/extensions/package.sh

# Distributes:
# - extensions/chrome/ → chrome-extension-<version>.zip
# - extensions/safari/ → safari-extension-<version>.zip
```

**Note:** Built extensions will contain YOUR AWS infrastructure configuration. Only distribute to users who should have access to YOUR RecipeArchive instance.
