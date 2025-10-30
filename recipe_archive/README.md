# RecipeArchive Flutter App

Cross-platform Flutter application for web, iOS, and Android.

## Quick Start

```bash
# Web development
flutter run -d chrome

# iOS development
cd .. && ./scripts/ios-simulator.sh

# Android development
cd .. && ./scripts/android-run.sh
```

## Production Deployment

**Web App**: https://d1jcaphz4458q7.cloudfront.net

```bash
# Deploy web app
cd .. && ./scripts/web-deploy.sh
```

## Mobile Builds

```bash
# From repository root
cd recipe_archive

# Build for specific platforms
./scripts/build-mobile.sh android release
./scripts/build-mobile.sh ios release
./scripts/build-mobile.sh both release
```

See [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md) for complete mobile build and distribution guide.

## Features

- AWS Cognito authentication
- Real-time recipe sync across devices
- OpenAI-powered recipe normalization
- Full-text search with metadata
- Multi-tenant architecture
- Screen wakelock for hands-free cooking
- Cross-platform (web, iOS, Android)

## Environment Configuration

The app uses `../.env` (main project environment file). See repository root for configuration details.

## Commands Reference

See [../COMMANDS.md](../COMMANDS.md) for complete command reference.
