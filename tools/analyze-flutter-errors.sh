#!/bin/bash
#
# analyze-flutter-errors.sh
#
# Description:
#   This script analyzes diagnostic data stored in an S3 bucket to identify and categorize
#   Flutter-specific errors. It downloads raw diagnostic JSON files, processes them
#   to extract relevant error information, and generates a summary report.
#   The script helps in monitoring the health of Flutter applications by highlighting
#   recurring error types and providing a breakdown of Flutter vs. other error sources.
#
# Usage:
#   ./analyze-flutter-errors.sh [HOURS_BACK]
#
# Arguments:
#   HOURS_BACK (optional): The number of hours back from the current time to consider
#                          for diagnostic data. Defaults to 24 hours if not provided.
#
# Dependencies:
#   - AWS CLI: Must be configured with appropriate credentials to access the S3 bucket.
#     (See: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)
#   - jq: A lightweight and flexible command-line JSON processor.
#     (Installation: https://stedolan.github.io/jq/download/)
#
# Output:
#   - A directory named 'flutter-error-analysis' (or as defined by OUTPUT_DIR)
#     containing:
#       - 'raw-data/': All downloaded diagnostic JSON files.
#       - 'flutter-analysis.txt': A detailed report summarizing Flutter errors,
#         including a breakdown of error types and individual error logs.
#
# Exit Codes:
#   0: Script executed successfully, even if no errors were found.
#   1: An error occurred (e.g., missing dependencies, invalid arguments, S3 access issues).
#
# Example:
#   # Analyze Flutter errors from the last 48 hours
#   ./analyze-flutter-errors.sh 48
#
#   # Analyze Flutter errors from the last 24 hours (default)
#   ./analyze-flutter-errors.sh
#
# --------------------------------------------------------------------------------------

set -e

# --- Configuration ---
S3_BUCKET="recipe-failed-0ea7007d57f67ecb-990537043943"
OUTPUT_DIR="./flutter-error-analysis"
HOURS_BACK=${1:-24}

# --- Error Handling and Dependency Checks ---

# Function to display error messages and exit
error_exit() {
    echo "❌ ERROR: $1" >&2
    exit 1
}

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    error_exit "AWS CLI is not installed or not in PATH. Please install it: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html"
fi

# Check for jq
if ! command -v jq &> /dev/null; then
    error_exit "jq is not installed or not in PATH. Please install it: https://stedolan.github.io/jq/download/"
fi

# Validate HOURS_BACK argument
if ! [[ "$HOURS_BACK" =~ ^[0-9]+$ ]]; then
    error_exit "Invalid argument: HOURS_BACK must be a positive integer. Received: '$HOURS_BACK'"
fi

echo "🔍 Analyzing Flutter errors from last $HOURS_BACK hours..."
echo "📊 S3 Bucket: s3://$S3_BUCKET/diagnostics/"

# Create output directory
mkdir -p "$OUTPUT_DIR" || error_exit "Failed to create output directory: $OUTPUT_DIR"

# Download all diagnostic files from S3
echo "📋 Downloading diagnostic data from S3..."
if ! aws s3 sync "s3://$S3_BUCKET/diagnostics/" "$OUTPUT_DIR/raw-data/" --quiet; then
    error_exit "Failed to download diagnostic data from S3 bucket: s3://$S3_BUCKET/diagnostics/. Check AWS credentials and bucket permissions."
fi

S3_BUCKET="recipe-failed-0ea7007d57f67ecb-990537043943"
OUTPUT_DIR="./flutter-error-analysis"
HOURS_BACK=${1:-24}

# --- Error Handling and Dependency Checks ---

# Function to display error messages and exit
error_exit() {
    echo "❌ ERROR: $1" >&2
    exit 1
}

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    error_exit "AWS CLI is not installed or not in PATH. Please install it: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html"
fi

# Check for jq
if ! command -v jq &> /dev/null; then
    error_exit "jq is not installed or not in PATH. Please install it: https://stedolan.github.io/jq/download/"
fi

# Validate HOURS_BACK argument
if ! [[ "$HOURS_BACK" =~ ^[0-9]+$ ]]; then
    error_exit "Invalid argument: HOURS_BACK must be a positive integer. Received: '$HOURS_BACK'"
fi

echo "🔍 Analyzing Flutter errors from last $HOURS_BACK hours..."
echo "📊 S3 Bucket: s3://$S3_BUCKET/diagnostics/"

# Create output directory
mkdir -p "$OUTPUT_DIR" || error_exit "Failed to create output directory: $OUTPUT_DIR"

# Download all diagnostic files from S3
echo "📋 Downloading diagnostic data from S3..."
if ! aws s3 sync "s3://$S3_BUCKET/diagnostics/" "$OUTPUT_DIR/raw-data/" --quiet; then
    error_exit "Failed to download diagnostic data from S3 bucket: s3://$S3_BUCKET/diagnostics/. Check AWS credentials and bucket permissions."
fi

# Check if raw-data directory exists and contains files
if [ ! -d "$OUTPUT_DIR/raw-data" ] || [ -z "$(find "$OUTPUT_DIR/raw-data" -maxdepth 1 -name "*.json" -print -quit)" ]; then
    echo "✅ No new diagnostic data found in S3 or '$OUTPUT_DIR/raw-data' is empty. Exiting."
    exit 0
fi

# Analyze Flutter-specific errors
echo "📊 Analyzing Flutter error patterns..."

# Count total error files
TOTAL_FILES=$(find "$OUTPUT_DIR/raw-data" -name "*.json" | wc -l)
echo "📈 Found $TOTAL_FILES diagnostic files to analyze"

# Initialize analysis files
echo "🔍 FLUTTER ERROR ANALYSIS" > "$OUTPUT_DIR/flutter-analysis.txt"
echo "==========================" >> "$OUTPUT_DIR/flutter-analysis.txt"
echo "Time Range: Last $HOURS_BACK hours" >> "$OUTPUT_DIR/flutter-analysis.txt"
echo "Total Files: $TOTAL_FILES" >> "$OUTPUT_DIR/flutter-analysis.txt"
echo "" >> "$OUTPUT_DIR/flutter-analysis.txt"

# Extract Flutter-specific errors
FLUTTER_ERRORS=0
EXTENSION_ERRORS=0
OTHER_ERRORS=0
INVALID_JSON_FILES=0

for file in "$OUTPUT_DIR/raw-data"/*.json; do
    if [ -f "$file" ]; then
        # Validate JSON file before processing
        if ! jq -e . "$file" >/dev/null 2>&1; then
            echo "⚠️  Skipping invalid JSON file: $file" >> "$OUTPUT_DIR/flutter-analysis.txt"
            INVALID_JSON_FILES=$((INVALID_JSON_FILES + 1))
            continue
        fi

        # Check if it's a Flutter error
        if jq -e '.userAgent | contains("Flutter")' "$file" >/dev/null 2>&1 || \
           jq -e '.url | contains("d1jcaphz4458q7.cloudfront.net")' "$file" >/dev/null 2>&1 || \
           jq -e '.context | contains("flutter")' "$file" >/dev/null 2>&1; then

            FLUTTER_ERRORS=$((FLUTTER_ERRORS + 1))
            echo "=== FLUTTER ERROR #$FLUTTER_ERRORS === (File: $(basename "$file"))" >> "$OUTPUT_DIR/flutter-analysis.txt"
            jq . "$file" >> "$OUTPUT_DIR/flutter-analysis.txt"
            echo "" >> "$OUTPUT_DIR/flutter-analysis.txt"

        # Check if it's an extension error
        elif jq -e '.extension' "$file" >/dev/null 2>&1 || \
             jq -e '.userAgent | contains("Chrome") or contains("Safari")' "$file" >/dev/null 2>&1; then

            EXTENSION_ERRORS=$((EXTENSION_ERRORS + 1))

        else
            OTHER_ERRORS=$((OTHER_ERRORS + 1))
        fi
    fi
done

# Generate summary
echo "📊 ERROR BREAKDOWN:" >> "$OUTPUT_DIR/flutter-analysis.txt"
echo "Flutter Errors: $FLUTTER_ERRORS" >> "$OUTPUT_DIR/flutter-analysis.txt"
echo "Extension Errors: $EXTENSION_ERRORS" >> "$OUTPUT_DIR/flutter-analysis.txt"
echo "Other Errors: $OTHER_ERRORS" >> "$OUTPUT_DIR/flutter-analysis.txt"
echo "Invalid JSON Files: $INVALID_JSON_FILES" >> "$OUTPUT_DIR/flutter-analysis.txt"
echo "" >> "$OUTPUT_DIR/flutter-analysis.txt"

# Analyze error types for Flutter
if [ $FLUTTER_ERRORS -gt 0 ]; then
    echo "🏷️  FLUTTER ERROR TYPES:" >> "$OUTPUT_DIR/flutter-analysis.txt"
    for file in "$OUTPUT_DIR/raw-data"/*.json; do
        if [ -f "$file" ]; then
            if jq -e '.userAgent | contains("Flutter")' "$file" >/dev/null 2>&1 || \
               jq -e '.url | contains("d1jcaphz4458q7.cloudfront.net")' "$file" >/dev/null 2>&1; then
                error_type=$(jq -r '.errorType // "unknown"' "$file")
                echo "  - $error_type" >> "$OUTPUT_DIR/flutter-analysis.txt"
            fi
        fi
    done | sort | uniq -c | sort -nr >> "$OUTPUT_DIR/flutter-analysis.txt"
fi

echo ""
echo "🎯 FLUTTER ERROR ANALYSIS COMPLETE"
echo "📊 Flutter Errors: $FLUTTER_ERRORS"
echo "📊 Extension Errors: $EXTENSION_ERRORS"
echo "📊 Other Errors: $OTHER_ERRORS"
echo "📁 Analysis saved to: $OUTPUT_DIR/flutter-analysis.txt"

if [ $FLUTTER_ERRORS -gt 0 ]; then
    echo ""
    echo "🔥 TOP FLUTTER ERROR TYPES:"
    grep -E "^\s*[0-9]+\s+" "$OUTPUT_DIR/flutter-analysis.txt" 2>/dev/null | head -5 || echo "  No error type data available"
else
    echo ""
    echo "✅ No Flutter errors found in diagnostic data"
fi

echo ""
echo "💡 To analyze extension errors, run: ./tools/analyze-extension-errors.sh"
echo "💡 To see raw data, check: $OUTPUT_DIR/raw-data/"