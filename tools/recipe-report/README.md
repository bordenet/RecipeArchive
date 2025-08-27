# Recipe Archive S3 Reporting Tool

Command-line utility to analyze recipes stored in AWS S3 bucket, showing successful submissions and parsing failures.

## Features

- **Authentication**: Uses AWS Cognito username/password authentication
- **Comprehensive Scanning**: Reports on successful recipes, parsing failures, and other errors
- **Tabular Output**: Clean, formatted tables with recipe names, domains, and submission dates
- **Domain Analysis**: Breakdown showing which sites have the most recipes
- **Flexible Configuration**: Supports custom S3 bucket names

## Usage

### Prerequisites

1. **AWS Credentials**: Configure AWS credentials using one of:
   ```bash
   aws configure                    # AWS CLI
   export AWS_PROFILE=myprofile    # Environment variable
   # Or use IAM roles/instance profiles
   ```

2. **Go Dependencies**: Install dependencies
   ```bash
   go mod tidy
   ```

### Running the Tool

```bash
# Basic usage
go run main.go -user your.email@example.com -password yourpassword

# With custom S3 bucket
go run main.go -user your.email@example.com -password yourpassword -bucket my-custom-bucket

# Show help
go run main.go -help
```

### Build Standalone Binary

```bash
go build -o recipe-report
./recipe-report -user your.email@example.com -password yourpassword
```

## Output Format

The tool generates a comprehensive report with:

1. **Summary Statistics**
   - Count of successful recipes
   - Count of parsing failures  
   - Count of other errors
   - Total entries

2. **Detailed Recipe Table**
   - Recipe name (truncated if long)
   - Source domain
   - Submission date and time
   - Status indicator (✅❌🚨)

3. **Domain Breakdown**
   - List of domains sorted by recipe count
   - Shows which sites work best

## S3 Storage Structure

The tool expects recipes to be stored in S3 with this structure:

```
recipes/{userID}/{recipeID}.json           # Successful recipes
parsing-failures/{userID}/{timestamp}.json # Parse failures
errors/{userID}/{timestamp}-{type}.json    # Other errors
```

Where `userID` is derived from email: `user@domain.com` → `user_at_domain_dot_com`

## Authentication

- Uses AWS Cognito User Pool authentication
- Validates credentials but relies on AWS SDK credentials for S3 access
- User Pool ID: `us-west-2_qJ1i9RhxD`
- Client ID: `5grdn7qhf1el0ioqb6hkelr29s`

## Error Handling

- Continues processing if individual recipes can't be read
- Shows warnings for inaccessible files
- Gracefully handles missing directories (failures, errors)
- Provides helpful error messages for common issues

## Examples

```bash
# Test with default bucket
go run main.go -user matt@example.com -password mypass123

# Production bucket
go run main.go -user user@example.com -password pass -bucket recipearchive-storage-prod

# Using environment variables for AWS
AWS_PROFILE=recipeArchive go run main.go -user test@example.com -password testpass
```