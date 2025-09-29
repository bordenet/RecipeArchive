# Environment Configuration Setup

This document explains how to configure environment variables for the complete RecipeArchive cross-platform project (web, mobile, and browser extensions) to avoid hardcoded credentials.

## Security Note

**NEVER COMMIT CREDENTIALS TO VERSION CONTROL**

All credentials should be configured via environment variables or localStorage settings.

## Required Environment Variables

The following environment variables must be configured for all components:

### AWS Cognito Configuration

- `COGNITO_USER_POOL_ID`: Your AWS Cognito User Pool ID
- `COGNITO_APP_CLIENT_ID`: Your AWS Cognito App Client ID
- `AWS_REGION`: AWS region (e.g., us-west-2)

### API Configuration

- `API_BASE_URL`: Base URL for your deployed API Gateway

### Test Credentials (Development Only)

- `TEST_USER_EMAIL`: Email for development testing
- `TEST_USER_PASSWORD`: Password for development testing

## Configuration Methods

### 1. Flutter Web/Mobile Apps (.env file)

Create `recipe_archive/.env`:

```
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_APP_CLIENT_ID=your_client_id
AWS_REGION=your_region
API_BASE_URL=your_api_url
TEST_USER_EMAIL=your_test_email
TEST_USER_PASSWORD=your_test_password
```

This configuration is shared between web and mobile (Android/iOS) builds.

### 2. Browser Extensions (localStorage)

For Chrome/Safari extensions, set these values in localStorage:

```javascript
localStorage.setItem('COGNITO_USER_POOL_ID', 'your_user_pool_id');
localStorage.setItem('COGNITO_APP_CLIENT_ID', 'your_client_id');
localStorage.setItem('AWS_REGION', 'your_region');
localStorage.setItem('API_BASE_URL', 'your_api_url');
```

### 3. Root Project (.env file)

Create root `.env` file for overall project configuration:

```
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_APP_CLIENT_ID=your_client_id
AWS_REGION=your_region
API_BASE_URL=your_api_url
TEST_USER_EMAIL=your_test_email
TEST_USER_PASSWORD=your_test_password
```

## Setup Instructions

1. **Copy from template**:

   ```bash
   cp .env.example .env
   ```

2. **Edit the .env files** with your actual values

3. **For browser extensions**: Use the browser console to set localStorage values

4. **Verify configuration**: Run the monorepo validator tool to ensure everything is working:
   ```bash
   go run tools/monorepo-validator --med
   ```

## File Structure

```
RecipeArchive/
├── .env                    # Root project environment (all configuration)
├── .env.example           # Template with placeholder values
├── recipe_archive/        # Flutter web/mobile apps (uses root .env)
│   ├── android/          # Android app configuration
│   ├── ios/              # iOS app configuration
│   └── web/              # Web app configuration
├── extensions/            # Browser extensions (use localStorage)
├── aws-backend/           # AWS infrastructure (uses root .env)
└── docs/
    └── setup/
        └── ENVIRONMENT_SETUP.md  # This file
```

## Security Best Practices

1. ✅ All `.env` files are in `.gitignore`
2. ✅ No hardcoded credentials in source code
3. ✅ Environment templates provided for easy setup
4. ✅ Clear documentation for configuration
5. ✅ Separate configuration per component

## Troubleshooting

### Extensions not working?

- Check browser console for "CONFIGURE_ME" values
- Set localStorage values manually
- Verify extension permissions

### Flutter web/mobile app not working?

- Ensure `.env` file exists in `recipe_archive/`
- Check that `flutter_dotenv` is properly configured
- Verify `pubspec.yaml` includes `.env` in assets
- For mobile builds, ensure platform-specific configurations are correct

### API calls failing?

- Verify `API_BASE_URL` is correct
- Check Cognito configuration
- Ensure JWT tokens are being included in requests
