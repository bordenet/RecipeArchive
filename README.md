# 🍽️ RecipeArchive

**A comprehensive recipe archiving platform for home cooks**

Capture, organize, and access your favorite recipes from 13+ supported websites with intelligent parsing, cross-device synchronization, and a modern web interface. Features OpenAI-powered recipe normalization with automatic time estimates and serving calculations.

## 🚀 Quick Start

### Automatic Setup (macOS)

```bash
# Clone the repository
git clone https://github.com/bordenet/RecipeArchive
cd RecipeArchive

# Run the automated setup script (installs all dependencies)
./scripts/setup-macos.sh

# Set up environment variables
cp .env.template .env
# Edit .env with your AWS credentials (see AWS Setup section below)

# Validate setup
./validate-monorepo.sh
```

### Manual Setup (All Platforms)

If you prefer manual setup or aren't on macOS, install these dependencies:

**Required:**
- [Node.js 18+](https://nodejs.org/) - JavaScript runtime
- [Go 1.19+](https://golang.org/) - Backend services
- [Flutter 3.10+](https://flutter.dev/) - Web app development
- [AWS CLI](https://aws.amazon.com/cli/) - Cloud deployment

**Optional but recommended:**
- [Git](https://git-scm.com/) - Version control
- [Visual Studio Code](https://code.visualstudio.com/) - IDE

After installing dependencies:
```bash
# Install project dependencies
npm install

# Build TypeScript parsers
npm run build:parser-bundle

# Validate setup
./validate-monorepo.sh
```

## 🔐 AWS Setup

RecipeArchive uses AWS for backend services. You'll need:

1. **AWS Account** - [Create one here](https://aws.amazon.com/) (free tier eligible)
2. **Configure AWS CLI:**
   ```bash
   aws configure
   # Enter your Access Key ID, Secret Key, and region (us-west-2)
   ```
3. **Edit `.env` file** with your AWS details:
   ```bash
   cp .env.template .env
   # Edit .env with your actual AWS credentials
   ```

**Expected AWS costs:** ~$1-5/month during development

## 🌐 Components

### **Flutter Web App**
Modern, responsive recipe management interface
```bash
cd recipe_archive
flutter build web      # Production build
```
- **Production App:** https://d1jcaphz4458q7.cloudfront.net

### **Browser Extensions**
Chrome and Safari extensions for recipe capture
- **Chrome:** Load `extensions/chrome/` as unpacked extension
- **Safari:** Load `extensions/safari/` (requires Xcode for iOS/macOS)

### **Recipe Parsers**
TypeScript-based parsing system supporting 13+ recipe websites
```bash
npm run build:parser-bundle  # Build parsers
npm run test:parsers         # Run parser tests
```

### **AWS Backend**
Serverless Go functions with S3 storage
```bash
cd aws-backend
cdk deploy  # Deploy infrastructure
```

## 🎯 Supported Recipe Sites

✅ **Currently Supported (13 sites):**
- Smitten Kitchen, Food Network, NYT Cooking, Food52
- AllRecipes, Epicurious, Serious Eats, Love & Lemons  
- Washington Post, Food & Wine, Damn Delicious, Alexandra's Kitchen

All sites have comprehensive JSON-LD and HTML parsing with full test coverage.

## 🧪 Development Workflow

```bash
# Full monorepo validation (recommended before commits)
./validate-monorepo.sh

# Individual component testing
npm run lint           # Code quality checks
npm run test:parsers   # Parser functionality
npm run test:go        # Backend services

# Build and deploy
npm run build:parser-bundle  # Compile parsers
cd aws-backend && cdk deploy # Deploy infrastructure
```

## 🏗️ Architecture

- **Extensions:** Chrome/Safari with TypeScript parsers + AWS Cognito auth
- **Parsers:** Registry system for 13+ recipe sites with JSON-LD + HTML extraction
- **Content Normalization:** OpenAI GPT-4o-mini integration for recipe enhancement at ingestion
  - Title standardization, ingredient normalization, instruction clarity
  - Metadata inference (cuisine type, cooking methods, dietary info, difficulty)
  - Graceful fallback when OpenAI unavailable
- **Backend:** Go serverless functions (AWS Lambda) + S3 storage + Cognito auth  
- **Frontend:** Flutter web app with responsive design + CloudFront deployment

## 📚 Documentation

### Setup Guides
- [Flutter Web Deployment](docs/flutter-web-deployment.md) - Step-by-step deployment guide
- [AWS Setup Guide](docs/setup/aws-setup.md) - Detailed AWS configuration
- [Environment Setup](docs/setup/ENVIRONMENT_SETUP.md) - Environment variable configuration

### Development
- [CLAUDE.md](CLAUDE.md) - Current project status and priorities
- [API Documentation](docs/api/openapi.yaml) - Backend API specification
- [Test Coverage](#) - Comprehensive validation across all components

## 🛡️ Security

- **No hardcoded secrets** - All credentials via environment variables
- **TruffleHog scanning** - Automated secret detection in CI/CD
- **AWS best practices** - IAM roles, VPC, encryption at rest

## 🚀 Current Status

**✅ Production Ready:**
- Chrome & Safari extensions with 13-site parser support
- AWS serverless backend with S3 storage  
- Flutter web app with responsive design
- OpenAI-powered recipe normalization with automatic time estimates
- Comprehensive Flutter integration tests replacing unreliable Playwright tests
- Fixed test suite with accurate counting and meaningful validation

**🔧 Active Development:**
- Mobile apps (iOS native, Android Compose)
- Additional recipe site support
- Recipe import/export features

---

## 🛠️ Tech Stack

**Backend:** Go (AWS Lambda), TypeScript (AWS CDK), AWS Cognito + S3  
**Frontend:** Flutter/Dart (web), JavaScript (browser extensions)  
**Testing:** Jest, Go testing, integration tests, security scanning  
**Infrastructure:** AWS CDK, CloudFront, API Gateway  

---

*Transform your recipe collection with intelligent capture, organization, and cross-device access* 🍳