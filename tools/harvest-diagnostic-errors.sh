#!/bin/bash

################################################################################
#
# RecipeArchive Error Harvesting Script
#
# PURPOSE:
#   This script extracts diagnostic data from CloudWatch logs for the
#   Diagnostics Lambda function. It is used as a fallback when the primary
#   S3 storage mechanism for diagnostics is not working.
#
# USAGE:
#   ./tools/harvest-diagnostic-errors.sh [hours]
#
# ARGUMENTS:
#   hours (optional): The number of hours back to analyze. Defaults to 24.
#
# HOW IT WORKS:
#   1.  Identifies the relevant log streams within the specified time range.
#   2.  Downloads the log events from each stream.
#   3.  Extracts and summarizes the error messages.
#   4.  Generates a report of the findings.
#
# DEPENDENCIES:
#   - AWS CLI (configured with appropriate permissions)
#   - jq (for parsing JSON output from the AWS CLI)
#
# NOTES:
#   - This script is intended to be run from the root of the monorepo.
#
################################################################################

# RecipeArchive Error Harvesting Script
# Extracts diagnostic data from CloudWatch logs since S3 storage is broken

set -e

LOG_GROUP="/aws/lambda/RecipeArchive-dev-DiagnosticsFunctionF6482E72-GpGVR5DdZICc"
OUTPUT_DIR="./diagnostic-harvest"
CURRENT_TIME=$(date +%s)
HOURS_BACK=${1:-24}  # Default to last 24 hours
START_TIME=$((CURRENT_TIME - (HOURS_BACK * 3600)))

echo "🔍 Harvesting diagnostic errors from last $HOURS_BACK hours..."
echo "📊 Log Group: $LOG_GROUP"
echo "⏰ Start Time: $(date -r $START_TIME)"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get all log streams in time range
echo "📋 Getting log streams..."
aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --order-by LastEventTime \
  --descending \
  --query "logStreams[?lastEventTimestamp>=$((START_TIME * 1000))].logStreamName" \
  --output text > "$OUTPUT_DIR/log-streams.txt"

STREAM_COUNT=$(wc -l < "$OUTPUT_DIR/log-streams.txt")
echo "📈 Found $STREAM_COUNT log streams to process"

# Process each log stream
TOTAL_ERRORS=0
while IFS= read -r stream_name; do
  if [ -n "$stream_name" ]; then
    echo "🔄 Processing stream: $stream_name"

    # Get events from this stream
    aws logs get-log-events \
      --log-group-name "$LOG_GROUP" \
      --log-stream-name "$stream_name" \
      --start-time $((START_TIME * 1000)) \
      --output json > "$OUTPUT_DIR/stream-$(echo $stream_name | tr '/' '-').json"

    # Extract error details
    jq -r '.events[] | select(.message | contains("🔍 Error Type:")) | .message' \
      "$OUTPUT_DIR/stream-$(echo $stream_name | tr '/' '-').json" \
      >> "$OUTPUT_DIR/all-errors.txt"

    # Count errors in this stream
    STREAM_ERRORS=$(jq '[.events[] | select(.message | contains("🔍 Error Type:"))] | length' \
      "$OUTPUT_DIR/stream-$(echo $stream_name | tr '/' '-').json")
    TOTAL_ERRORS=$((TOTAL_ERRORS + STREAM_ERRORS))

    echo "  📊 Found $STREAM_ERRORS errors in this stream"
  fi
done < "$OUTPUT_DIR/log-streams.txt"

echo ""
echo "🎯 HARVEST COMPLETE"
echo "📊 Total errors found: $TOTAL_ERRORS"
echo "📁 Output directory: $OUTPUT_DIR"
echo ""

# Generate summary report
echo "🔍 ERROR SUMMARY:" > "$OUTPUT_DIR/error-summary.txt"
echo "=================" >> "$OUTPUT_DIR/error-summary.txt"
echo "Time Range: Last $HOURS_BACK hours" >> "$OUTPUT_DIR/error-summary.txt"
echo "Total Errors: $TOTAL_ERRORS" >> "$OUTPUT_DIR/error-summary.txt"
echo "Log Streams: $STREAM_COUNT" >> "$OUTPUT_DIR/error-summary.txt"
echo "" >> "$OUTPUT_DIR/error-summary.txt"

if [ -f "$OUTPUT_DIR/all-errors.txt" ] && [ -s "$OUTPUT_DIR/all-errors.txt" ]; then
  echo "🏷️  ERROR TYPES:" >> "$OUTPUT_DIR/error-summary.txt"
  grep -o "Error Type: [^,]*" "$OUTPUT_DIR/all-errors.txt" | sort | uniq -c | sort -nr >> "$OUTPUT_DIR/error-summary.txt"

  echo "" >> "$OUTPUT_DIR/error-summary.txt"
  echo "📝 DETAILED ERRORS:" >> "$OUTPUT_DIR/error-summary.txt"
  cat "$OUTPUT_DIR/all-errors.txt" >> "$OUTPUT_DIR/error-summary.txt"

  echo ""
  echo "🎯 TOP ERROR TYPES:"
  grep -o "Error Type: [^,]*" "$OUTPUT_DIR/all-errors.txt" | sort | uniq -c | sort -nr | head -10
else
  echo "⚠️  No errors found in the specified time range"
fi

echo ""
echo "🔧 CRITICAL ISSUES DETECTED:"
if grep -q "S3.*AccessDenied" "$OUTPUT_DIR"/*.json 2>/dev/null; then
  echo "❌ S3 Access Denied errors found - CDK infrastructure mismatch!"
fi

if grep -q "Upload failed.*500" "$OUTPUT_DIR"/*.json 2>/dev/null; then
  echo "❌ Image upload failures found - check ImageUpload Lambda"
fi

if grep -q "No user ID found in token" "$OUTPUT_DIR"/*.json 2>/dev/null; then
  echo "❌ JWT authentication issues found - check token parsing"
fi

echo ""
echo "💡 To harvest more data, run: $0 [hours_back]"
echo "💡 Example: $0 168  # Last 7 days"