# ⚠️ CRITICAL: New Adopters Must Configure Extensions

## 🚨 SECURITY WARNING

The browser extension files in this directory contain **hardcoded AWS infrastructure references** from the original developer.

**If you use these extensions as-is, you will be connecting to someone else's AWS infrastructure**, which is:
- A security risk
- Not what you want
- May not work or may be disabled

## ✅ Required Setup for New Adopters

Before using these extensions, you MUST:

### 1. Deploy Your Own AWS Infrastructure
Follow the setup guide in `docs/setup/aws-setup.md` to create your own:
- AWS Cognito User Pool and App Client
- API Gateway
- S3 Buckets
- DynamoDB Tables
- CloudFront Distribution

### 2. Configure Your Environment
```bash
# In the project root
cp .env.example .env
# Edit .env with YOUR AWS infrastructure details
```

### 3. Run the Setup Script
```bash
# This updates ALL extension files to use YOUR infrastructure
./scripts/setup-new-adopter-environment.sh
```

### 4. Build and Package Extensions
```bash
npm run build:extensions
./scripts/package-extensions.sh
```

## 🔍 What the Setup Script Does

The setup script (`scripts/setup-new-adopter-environment.sh`) will:

- ✅ Replace hardcoded Cognito User Pool ID in all extension files
- ✅ Replace hardcoded Cognito App Client ID in all extension files
- ✅ Replace hardcoded API Gateway URLs in all extension files
- ✅ Replace hardcoded CloudFront URLs in all extension files
- ✅ Update Chrome extension manifest.json permissions
- ✅ Create backups of all original files (*.backup)

## 🚫 DO NOT Skip This Step

If you skip the configuration step, your extensions will:
- Connect to the wrong AWS infrastructure
- Potentially send your recipe data to someone else's AWS account
- Fail to authenticate properly
- Not work as expected

## 📁 Files That Get Modified

The setup script modifies these files with your AWS configuration:

**Chrome Extension:**
- `chrome/config.js`
- `chrome/env-config.js`
- `chrome/popup.js`
- `chrome/content.js`
- `chrome/background.js`
- `chrome/fix-config.js`
- `chrome/compare-auth-methods.js`
- `chrome/manifest.json`

**Safari Extension:**
- `safari/config.js`
- `safari/env-config.js`
- `safari/popup.js`
- `safari/content.js`

## 🔄 Reverting Changes

If you need to revert changes:
```bash
# Example: restore original Chrome config
mv extensions/chrome/config.js.backup extensions/chrome/config.js
```

## 💡 Why Are Values Hardcoded?

Browser extensions run in isolation and cannot access:
- Local environment variables
- The project's `.env` file
- Node.js modules or build-time configuration

Therefore, AWS configuration must be directly embedded in the extension files themselves.