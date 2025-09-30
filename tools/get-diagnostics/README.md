# get-diagnostics

A Go-based tool for collecting and analyzing diagnostic telemetry from RecipeArchive's production infrastructure.

## Features

- **Web Extension Diagnostics**: Harvests error reports from browser extensions stored in S3
- **Flutter App Diagnostics**: Collects mobile app diagnostic data from S3
- **Lambda Diagnostics**: Queries CloudWatch Logs for Lambda function errors and warnings
- **Global Report Mode**: Default (no flags) produces a comprehensive report of all diagnostics
- **Flexible Time Windows**: Query data from 1 hour to multiple days/weeks
- **Multiple Output Formats**: Human-readable formatted tables, JSON, or summary reports
- **Summary Reports**: Generate statistical reports with counts by type, source, and top URLs
- **Data Deletion**: Delete diagnostic data from S3 with confirmation prompt
- **Environment Integration**: Automatically loads configuration from `.env` file

## Building

```bash
cd tools/get-diagnostics
go build -o get-diagnostics *.go
```

The binary is automatically added to `.gitignore` and should not be committed.

## Usage

### Basic Examples

```bash
# Global report (default - all diagnostics with summary)
./get-diagnostics

# Harvest all diagnostics from last 24 hours (detailed view)
./get-diagnostics -all

# Harvest only extension errors from last hour
./get-diagnostics -extensions -since 1h

# Harvest Flutter and Lambda diagnostics from last week
./get-diagnostics -flutter -lambdas -since 7d

# Output as JSON for further processing
./get-diagnostics -all -json > diagnostics.json

# Generate summary report with statistics
./get-diagnostics -report -since 7d

# Delete diagnostic data (requires confirmation)
./get-diagnostics -extensions -delete -since 30d
```

### Command Line Options

- No flags - Global report mode (all diagnostics, summary format)
- `-extensions` - Harvest/delete web extension diagnostic data only
- `-flutter` - Harvest/delete Flutter app diagnostic data only
- `-lambdas` - Harvest Lambda function diagnostic data (CloudWatch) only
- `-all` - Harvest/delete all diagnostic data
- `-since duration` - Time window (e.g., 1h, 24h, 7d) [default: 24h]
- `-json` - Output as JSON instead of formatted table
- `-report` - Generate summary report (counts by type and source)
- `-delete` - Delete diagnostic data (requires confirmation)
- `-bucket string` - S3 bucket name [default: from .env]
- `-help` - Show help message

### Environment Variables

Automatically loaded from `.env` file at repository root:
- `S3_BUCKET_NAME` - S3 bucket name
- `AWS_REGION` - AWS region (default: us-west-2)
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials

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

### Report
Statistical summary including:
- Overall statistics (total count, time range, duration)
- Breakdown by source (extensions, Flutter, Lambda)
- Breakdown by error type
- Cross-tabulation of source and error type
- Top 10 URLs with error counts

## Project Structure

```
get-diagnostics/
├── main.go          # Entry point and CLI argument handling
├── types.go         # Data structures
├── extensions.go    # Web extension diagnostic harvesting
├── flutter.go       # Flutter app diagnostic harvesting
├── lambda.go        # Lambda CloudWatch Logs harvesting
├── output.go        # Formatting, display, and report generation
├── delete.go        # S3 data deletion with confirmation
├── utils.go         # Helper functions, env loading, and usage text
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