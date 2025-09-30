# Diagnostic Harvester

A Go-based tool for collecting and analyzing diagnostic telemetry from RecipeArchive's production infrastructure.

## Features

- **Web Extension Diagnostics**: Harvests error reports from browser extensions stored in S3
- **Flutter App Diagnostics**: Collects mobile app diagnostic data from S3
- **Lambda Diagnostics**: Queries CloudWatch Logs for Lambda function errors and warnings
- **Flexible Time Windows**: Query data from 1 hour to multiple days/weeks
- **Multiple Output Formats**: Human-readable formatted tables or JSON for automated processing

## Building

```bash
cd tools/diagnostic-harvester
go build -o diagnostic-harvester *.go
```

The binary is automatically added to `.gitignore` and should not be committed.

## Usage

### Basic Examples

```bash
# Harvest all diagnostics from last 24 hours (default)
./diagnostic-harvester -all

# Harvest only extension errors from last hour
./diagnostic-harvester -extensions -since 1h

# Harvest Flutter and Lambda diagnostics from last week
./diagnostic-harvester -flutter -lambdas -since 7d

# Output as JSON for further processing
./diagnostic-harvester -all -json > diagnostics.json
```

### Command Line Options

- `-extensions` - Harvest web extension diagnostic data
- `-flutter` - Harvest Flutter app diagnostic data
- `-lambdas` - Harvest Lambda function diagnostic data
- `-all` - Harvest all diagnostic data (default if none specified)
- `-since duration` - Time window (e.g., 1h, 24h, 7d) [default: 24h]
- `-json` - Output as JSON instead of formatted table
- `-bucket string` - S3 bucket name [default: recipe-storage-*]
- `-help` - Show help message

### Environment Variables

- `AWS_REGION` - AWS region (default: us-west-2)
- `AWS_PROFILE` - AWS credentials profile

## Data Sources

### Extensions
S3 bucket prefix: `web-extension-errors/`
- JWT authentication errors
- Recipe parsing failures
- CORS issues
- API communication problems

### Flutter
S3 bucket prefix: `flutter-console-errors/`
- Mobile app crashes
- API errors
- Platform-specific issues

### Lambdas
CloudWatch Logs from:
- `/aws/lambda/RecipeArchive-diagnostics`
- `/aws/lambda/RecipeArchive-diagnostic-processor`
- `/aws/lambda/RecipeArchive-health`
- `/aws/lambda/RecipeArchive-recipes`
- `/aws/lambda/RecipeArchive-content-normalizer`
- `/aws/lambda/RecipeArchive-background-normalizer`

## Output Formats

### Formatted (Default)
Human-readable table with:
- Summary statistics by source
- Detailed entries with timestamps
- Error types and messages
- URLs and context information
- S3 keys for reference

### JSON
Machine-readable JSON array of diagnostic entries for automated processing and integration with other tools.

## Project Structure

```
diagnostic-harvester/
├── main.go          # Entry point and CLI argument handling
├── types.go         # Data structures
├── extensions.go    # Web extension diagnostic harvesting
├── flutter.go       # Flutter app diagnostic harvesting
├── lambda.go        # Lambda CloudWatch Logs harvesting
├── output.go        # Formatting and display logic
├── utils.go         # Helper functions and usage text
├── go.mod           # Go module dependencies
└── README.md        # This file
```

## Integration with RecipeArchive

This tool is designed to work with RecipeArchive's diagnostic reporting infrastructure:

1. **Extensions** report errors via the `/report-error` API endpoint
2. **Lambda functions** store diagnostics in the diagnostic-processor function
3. **S3 storage** maintains historical diagnostic data for analysis

Use this tool to:
- Monitor production issues
- Debug user-reported problems
- Track error trends over time
- Generate reports for issue triage