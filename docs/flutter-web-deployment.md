# Flutter Web App Deployment Guide

This document provides step-by-step instructions for deploying the RecipeArchive Flutter web application to AWS CloudFront.

## Prerequisites

Before deploying, ensure you have:

- Flutter SDK installed and configured
- AWS CLI installed and configured with appropriate credentials
- AWS CDK installed (`npm install -g aws-cdk`)
- Access to the RecipeArchive AWS account

## Current Production Environment

- **CloudFront Distribution**: https://d1jcaphz4458q7.cloudfront.net
- **S3 Bucket**: Frontend assets are served from S3
- **Environment**: Production deployment

## Deployment Steps

### 1. Prepare Flutter App

```bash
# Navigate to Flutter project directory
cd recipe_archive

# Install dependencies
flutter pub get

# Run analysis to catch any issues
flutter analyze

# Run tests to ensure everything works
flutter test
```

### 2. Build Flutter Web App

```bash
# Build for web production
flutter build web --release

# Verify build output exists
ls -la build/web/
```

The build output will be in `build/web/` directory containing:

- `index.html` - Main application entry point
- `main.dart.js` - Compiled Dart application
- `assets/` - Application assets (fonts, images, etc.)
- `canvaskit/` - CanvasKit rendering engine
- `favicon.png` - Application favicon

### 3. Deploy to AWS Infrastructure

Use the automated deployment scripts:

```bash
# Option 1: Deploy Flutter web app only (recommended for frontend changes)
cd recipe_archive
./deploy.sh

# Option 2: Deploy everything (frontend + backend Lambda functions)
cd ..
./scripts/deploy-all.sh

# Option 3: Deploy frontend only via deploy-all script
./scripts/deploy-all.sh --frontend-only

# Option 4: Deploy specific components
./scripts/web-deploy.sh        # Flutter web app only
./scripts/deploy-lambda.sh         # Lambda functions only
```

### 4. CloudFront Cache Management

The deployment scripts automatically handle CloudFront invalidation. If you need to manually clear the cache:

```bash
# Manual cache invalidation (rarely needed - scripts do this automatically)
aws cloudfront create-invalidation --distribution-id E1D19F7SLOJM5H --paths "/*"
```

**Note**: All deployment scripts (`./deploy.sh`, `./scripts/deploy-all.sh`, etc.) automatically create CloudFront invalidations and wait for completion.

### 5. Verify Deployment

After deployment, verify the application:

1. **Check main URL**: Visit https://d1jcaphz4458q7.cloudfront.net
2. **Test functionality**:
   - Login with AWS Cognito
   - Browse recipe gallery
   - View recipe details
   - Test responsive design on mobile
3. **Check browser console**: Ensure no JavaScript errors
4. **Test API integration**: Verify recipe loading from backend

## Configuration

### Environment Variables

The Flutter web app uses the following configuration:

- API endpoints are configured through environment-specific build configurations
- Authentication uses AWS Cognito with hardcoded pool configuration
- No secrets are stored in the frontend code

### Build Configuration

Key build settings in `pubspec.yaml`:

```yaml
name: recipe_archive
description: RecipeArchive Flutter Web Application

dependencies:
  flutter:
    sdk: flutter
  amplify_flutter: ^1.5.0
  amplify_auth_cognito: ^1.5.0
  http: ^0.13.5
```

## Troubleshooting

### Common Issues

1. **Build fails with dependency errors**:

   ```bash
   flutter clean
   flutter pub get
   flutter build web --release
   ```

2. **CloudFront serves old version**:

   ```bash
   aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
   ```

3. **Authentication not working**:
   - Verify Cognito User Pool configuration
   - Check browser network tab for API errors
   - Ensure CORS is configured on backend APIs

4. **Assets not loading**:
   - Check S3 bucket permissions
   - Verify asset paths in build output
   - Ensure CloudFront distribution includes asset routes

### Performance Optimization

- **Caching**: CloudFront caches static assets for 24 hours
- **Compression**: Gzip compression enabled for text assets
- **CDN**: Global CDN distribution for fast loading worldwide

## Rollback Procedure

If you need to rollback a deployment:

1. **Identify previous version**:

   ```bash
   # Check CloudFormation stack history
   aws cloudformation list-stack-events --stack-name RecipeArchive-dev
   ```

2. **Redeploy previous version**:
   ```bash
   git checkout PREVIOUS_COMMIT
   cd recipe_archive
   ./deploy.sh
   # Or for full rollback including backend:
   # cd .. && ./scripts/deploy-all.sh
   ```

## Security Considerations

- No secrets or API keys are included in the Flutter web build
- Authentication tokens are handled by AWS Cognito
- All API calls use HTTPS
- CORS is properly configured on backend services

## Monitoring

Monitor the deployment using:

- **CloudWatch**: Monitor CloudFront access logs and errors
- **Browser DevTools**: Check for JavaScript errors in production
- **AWS Console**: Monitor S3 bucket access and CloudFront distribution metrics

## Available Deployment Scripts

The RecipeArchive project includes several automated deployment scripts:

### `recipe_archive/deploy.sh`

- **Purpose**: Flutter web app deployment only
- **Features**: Builds Flutter app, deploys to S3, invalidates CloudFront
- **Use case**: Frontend-only changes
- **Automatic**: Build validation, cache invalidation, deployment status

### `scripts/deploy-all.sh`

- **Purpose**: Complete system deployment (frontend + backend)
- **Features**: Auto-discovers Lambda functions, builds/deploys everything
- **Options**: `--frontend-only`, `--backend-only`, `--function <name>`
- **Use case**: Full system updates or coordinated deployments

### `scripts/web-deploy.sh`

- **Purpose**: Web app deployment wrapper
- **Features**: Same as `recipe_archive/deploy.sh` but from repo root

### `scripts/deploy-lambda.sh`

- **Purpose**: Lambda function deployment only
- **Features**: Builds Go binaries, creates zip packages, deploys to AWS
- **Use case**: Backend API updates

All scripts include:

- ✅ Prerequisites validation (AWS CLI, Flutter, Go)
- ✅ Automatic error handling and rollback
- ✅ CloudFront cache invalidation
- ✅ Deployment status monitoring
- ✅ Color-coded progress output

## Additional Resources

- [Flutter Web Deployment Documentation](https://flutter.dev/docs/deployment/web)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [RecipeArchive Deployment Scripts](../scripts/) - Source code for all deployment automation
