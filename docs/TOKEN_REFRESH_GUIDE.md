# RecipeArchive Token Refresh Guide

## Overview

The RecipeArchive project now includes robust automatic token refresh functionality to eliminate the need for manual RECIPE_ADMIN_TOKEN updates. This system automatically detects expired tokens and refreshes them using AWS Cognito authentication.

## Features

### Automatic Token Refresh
- **Automatic Detection**: The monorepo validator automatically detects expired or missing RECIPE_ADMIN_TOKEN
- **Seamless Refresh**: Uses TEST_USER_EMAIL and TEST_USER_PASSWORD from .env to obtain new tokens
- **Dual Updates**: Updates both the .env file and current environment variables
- **Validation Integration**: Continues validation seamlessly after successful token refresh

### Manual Token Refresh
- **Standalone Tool**: Dedicated `refresh-token` utility for manual token management
- **Token Status Display**: Shows current token expiration status and user information
- **Error Handling**: Provides clear error messages and troubleshooting guidance

## How It Works

### Authentication Flow
1. **Credential Retrieval**: Gets TEST_USER_EMAIL and TEST_USER_PASSWORD from environment
2. **Cognito Authentication**: Uses AWS Cognito USER_PASSWORD_AUTH flow
3. **Token Extraction**: Extracts AccessToken (which becomes RECIPE_ADMIN_TOKEN)
4. **Environment Update**: Updates both .env file and current process environment
5. **Validation**: Verifies the new token is valid and not expired

### Token Validation
- **JWT Parsing**: Decodes JWT payload to extract expiration time
- **Expiration Buffer**: Considers tokens expired 5 minutes before actual expiration
- **Format Validation**: Ensures token has valid JWT structure

## Usage

### Automatic Refresh (Integrated in Validator)

The token refresh happens automatically when running infrastructure validations:

```bash
# These commands will automatically refresh tokens if needed
./validate-monorepo.sh --infra
./validate-monorepo.sh --all
./tools/monorepo-validator-go/monorepo-validator-go --infra
```

**Example Output:**
```
⚠️  RECIPE_ADMIN_TOKEN is expired - attempting automatic refresh...
🔄 Refreshing token...
🔐 Refreshing RECIPE_ADMIN_TOKEN using Cognito authentication...
✅ Successfully updated RECIPE_ADMIN_TOKEN in environment and .env file
🎉 Token refresh completed successfully!
✅ Token refresh successful - proceeding with auth-required endpoint tests
```

### Manual Token Refresh

Use the standalone refresh tool for manual token management:

```bash
# From project root
cd tools
go run refresh-token.go

# Or build and run
go build -o refresh-token refresh-token.go
./refresh-token
```

**Example Output:**
```
🔐 RecipeArchive Token Refresh Utility
======================================

📊 Current Token Status:
   Email: mattbordenet@hotmail.com
   Issued: 2025-01-27 19:49:29 UTC
   Expires: 2025-01-27 20:49:29 UTC
   Status: ❌ Expired 2h34m ago

🔄 Refreshing token for user: mattbordenet@hotmail.com
✅ Successfully obtained new access token
✅ Successfully updated RECIPE_ADMIN_TOKEN in .env file and current environment

📊 New Token Status:
   Email: mattbordenet@hotmail.com
   Issued: 2025-01-27 22:23:45 UTC
   Expires: 2025-01-27 23:23:45 UTC
   Status: ✅ Valid (expires in 59m)

🎉 Token refresh completed successfully!
💡 You can now run AWS infrastructure tests with the new token
```

## Prerequisites

### Required Environment Variables

The token refresh system requires these environment variables in your `.env` file:

```bash
# Test User Credentials (for token refresh)
TEST_USER_EMAIL=your-email@example.com
TEST_USER_PASSWORD=YourPassword123!

# These will be automatically updated by the refresh system
RECIPE_ADMIN_TOKEN=<automatically-updated>
```

### AWS Configuration

Ensure you have proper AWS credentials configured:

```bash
# Option 1: AWS credentials in .env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Option 2: AWS CLI configured
aws configure

# Option 3: EC2 instance profile (for AWS environments)
```

## Error Handling

### Common Errors and Solutions

#### Missing Credentials
```
❌ Error: TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env file
```
**Solution**: Add your Cognito user credentials to the .env file.

#### Authentication Failed
```
❌ Authentication failed: InvalidParameterException: ...
```
**Solutions**:
- Verify TEST_USER_EMAIL and TEST_USER_PASSWORD are correct
- Ensure the user exists in the Cognito User Pool
- Check that the user account is confirmed and active

#### AWS Configuration Issues
```
❌ Failed to load AWS config: ...
```
**Solutions**:
- Configure AWS credentials using `aws configure`
- Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env
- Ensure your AWS credentials have Cognito permissions

#### File Permission Issues
```
❌ Failed to update .env file: permission denied
```
**Solution**: Ensure the .env file is writable and you have proper permissions.

## Implementation Details

### File Locations
- **Token Refresh Module**: `/tools/monorepo-validator-go/token_refresh.go`
- **Integration Point**: `/tools/monorepo-validator-go/aws_infrastructure_tests.go`
- **Standalone Tool**: `/tools/refresh-token.go`

### Key Functions
- `EnsureValidToken()`: Main entry point for automatic refresh
- `IsTokenExpired()`: Checks if current token needs refresh
- `RefreshToken()`: Performs Cognito authentication
- `UpdateEnvironmentFiles()`: Updates .env and environment variables

### Security Considerations
- **Credentials Storage**: TEST_USER_EMAIL and TEST_USER_PASSWORD are stored in .env (not committed to git)
- **Token Rotation**: Tokens are automatically rotated, reducing exposure time
- **Secure Communication**: All communication with AWS Cognito uses HTTPS
- **Local Storage**: Tokens are only stored locally in .env file

## Troubleshooting

### Debug Token Issues
```bash
# Check current token status without refresh
cd tools
go run refresh-token.go | head -15

# Manual token refresh with verbose output
cd tools
go run refresh-token.go
```

### Verify AWS Connectivity
```bash
# Test AWS credentials
aws sts get-caller-identity

# Test Cognito connectivity
aws cognito-idp list-users --user-pool-id us-west-2_rpBcEEhYK --limit 1
```

### Reset Token State
```bash
# Remove current token to force fresh generation
sed -i '' '/RECIPE_ADMIN_TOKEN=/d' .env
./validate-monorepo.sh --infra
```

## Migration from Manual Process

### Before (Manual Process)
1. Token expires during validation
2. Manual login to AWS Console or CLI
3. Run complex cognito-idp commands
4. Copy/paste token to .env file
5. Update validate-monorepo.sh script
6. Retry validation

### After (Automatic Process)
1. Token expires during validation
2. ✅ **Automatic refresh happens transparently**
3. ✅ **Validation continues without interruption**

## Integration with CI/CD

The token refresh system works seamlessly in CI/CD environments:

```yaml
# GitHub Actions example
- name: Run Infrastructure Validation
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  run: ./validate-monorepo.sh --infra
```

## Future Enhancements

- **Token Caching**: Cache valid tokens to reduce Cognito API calls
- **Multiple User Support**: Support for different user credentials per environment
- **Token Metrics**: Track token refresh frequency and success rates
- **Background Refresh**: Proactive token refresh before expiration

## Support

For issues with token refresh functionality:

1. **Check Prerequisites**: Ensure all required environment variables are set
2. **Verify AWS Access**: Test AWS credentials and Cognito connectivity
3. **Review Logs**: Check validation output for specific error messages
4. **Manual Test**: Use the standalone refresh tool to isolate issues
5. **File Issues**: Report problems with detailed error messages and environment info