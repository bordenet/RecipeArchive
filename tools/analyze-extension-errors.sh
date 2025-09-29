#!/bin/bash

################################################################################
#
# RecipeArchive Extension Error Analysis Script
#
# PURPOSE:
#   This script downloads and analyzes diagnostic data from the S3 bucket to
#   identify and categorize errors related to the Chrome and Safari browser
#   extensions. It provides a summary of extension-specific errors, helping
#   developers quickly identify and address issues.
#
# USAGE:
#   ./tools/analyze-extension-errors.sh [hours]
#
# ARGUMENTS:
#   hours (optional): The number of hours back to analyze. Defaults to 24.
#
# HOW IT WORKS:
#   1.  Downloads all diagnostic files from the S3 bucket specified by the
#       S3_BUCKET environment variable.
#   2.  Filters for errors that are specific to the browser extensions.
#   3.  Categorizes errors by browser (Chrome/Safari) and by type (e.g.,
#       parsing, image upload, authentication).
#   4.  Generates a summary report in 'extension-error-analysis/extension-analysis.txt'.
#
# EXAMPLES:
#   # Analyze errors from the last 24 hours
#   ./tools/analyze-extension-errors.sh
#
#   # Analyze errors from the last 72 hours
#   ./tools/analyze-extension-errors.sh 72
#
# DEPENDENCIES:
#   - AWS CLI: Required for downloading diagnostic data from S3.
#   - jq: Used for parsing JSON data from the diagnostic files.
#
# NOTES:
#   - The script expects the S3_BUCKET environment variable to be set, but it
#     has a default value.
#   - The output is saved to the 'extension-error-analysis' directory.
#
################################################################################

# Extension Error Analysis Script
# Searches S3 diagnostic data for Chrome/Safari extension errors

set -e

S3_BUCKET="recipe-failed-0ea7007d57f67ecb-990537043943"
OUTPUT_DIR="./extension-error-analysis"
HOURS_BACK=${1:-24}

echo "🔍 Analyzing Extension errors from last $HOURS_BACK hours..."
echo "📊 S3 Bucket: $S3_BUCKET"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Download all diagnostic files from S3
echo "📋 Downloading diagnostic data from S3..."
aws s3 sync "s3://$S3_BUCKET/diagnostics/" "$OUTPUT_DIR/raw-data/" --quiet

if [ ! -d "$OUTPUT_DIR/raw-data" ] || [ -z "$(ls -A "$OUTPUT_DIR/raw-data" 2>/dev/null)" ]; then
    echo "⚠️  No diagnostic data found in S3"
    exit 0
fi

# Analyze extension-specific errors
echo "📊 Analyzing Extension error patterns..."

# Count total error files
TOTAL_FILES=$(find "$OUTPUT_DIR/raw-data" -name "*.json" | wc -l)
echo "📈 Found $TOTAL_FILES diagnostic files to analyze"

# Initialize analysis files
echo "🔍 EXTENSION ERROR ANALYSIS" > "$OUTPUT_DIR/extension-analysis.txt"
echo "=============================" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Time Range: Last $HOURS_BACK hours" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Total Files: $TOTAL_FILES" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "" >> "$OUTPUT_DIR/extension-analysis.txt"

# Extract extension-specific errors
CHROME_ERRORS=0
SAFARI_ERRORS=0
RECIPE_PARSING_ERRORS=0
IMAGE_UPLOAD_ERRORS=0
AUTH_ERRORS=0
OTHER_ERRORS=0

for file in "$OUTPUT_DIR/raw-data"/*.json; do
    if [ -f "$file" ]; then
        # Check if it's an extension error
        if jq -e '.extension' "$file" >/dev/null 2>&1 || \
           jq -e '.userAgent | contains("Chrome") or contains("Safari")' "$file" >/dev/null 2>&1 || \
           jq -e '.url | contains("chrome-extension") or contains("safari-extension")' "$file" >/dev/null 2>&1; then

            # Categorize by browser
            if jq -e '.userAgent | contains("Chrome")' "$file" >/dev/null 2>&1; then
                CHROME_ERRORS=$((CHROME_ERRORS + 1))
            elif jq -e '.userAgent | contains("Safari")' "$file" >/dev/null 2>&1; then
                SAFARI_ERRORS=$((SAFARI_ERRORS + 1))
            fi

            # Categorize by error type
            error_type=$(jq -r '.errorType // ""' "$file")
            case "$error_type" in
                *parsing*|*recipe*|*extract*)
                    RECIPE_PARSING_ERRORS=$((RECIPE_PARSING_ERRORS + 1))
                    ;;
                *image*|*upload*|*s3*)
                    IMAGE_UPLOAD_ERRORS=$((IMAGE_UPLOAD_ERRORS + 1))
                    ;;
                *auth*|*token*|*jwt*)
                    AUTH_ERRORS=$((AUTH_ERRORS + 1))
                    ;;
                *)
                    OTHER_ERRORS=$((OTHER_ERRORS + 1))
                    ;;
            esac

            echo "=== EXTENSION ERROR ===" >> "$OUTPUT_DIR/extension-analysis.txt"
            jq . "$file" >> "$OUTPUT_DIR/extension-analysis.txt"
            echo "" >> "$OUTPUT_DIR/extension-analysis.txt"
        fi
    fi
done

TOTAL_EXTENSION_ERRORS=$((CHROME_ERRORS + SAFARI_ERRORS))

# Generate summary
echo "📊 EXTENSION ERROR BREAKDOWN:" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Total Extension Errors: $TOTAL_EXTENSION_ERRORS" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Chrome Errors: $CHROME_ERRORS" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Safari Errors: $SAFARI_ERRORS" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "📂 ERROR CATEGORIES:" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Recipe Parsing: $RECIPE_PARSING_ERRORS" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Image Upload: $IMAGE_UPLOAD_ERRORS" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Authentication: $AUTH_ERRORS" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "Other: $OTHER_ERRORS" >> "$OUTPUT_DIR/extension-analysis.txt"
echo "" >> "$OUTPUT_DIR/extension-analysis.txt"

# Analyze error types
if [ $TOTAL_EXTENSION_ERRORS -gt 0 ]; then
    echo "🏷️  EXTENSION ERROR TYPES:" >> "$OUTPUT_DIR/extension-analysis.txt"
    for file in "$OUTPUT_DIR/raw-data"/*.json; do
        if [ -f "$file" ]; then
            if jq -e '.extension' "$file" >/dev/null 2>&1 || \
               jq -e '.userAgent | contains("Chrome") or contains("Safari")' "$file" >/dev/null 2>&1; then
                error_type=$(jq -r '.errorType // "unknown"' "$file")
                url=$(jq -r '.url // "unknown"' "$file")
                echo "  - $error_type ($url)" >> "$OUTPUT_DIR/extension-analysis.txt"
            fi
        fi
    done | sort | uniq -c | sort -nr >> "$OUTPUT_DIR/extension-analysis.txt"
fi

echo ""
echo "🎯 EXTENSION ERROR ANALYSIS COMPLETE"
echo "📊 Total Extension Errors: $TOTAL_EXTENSION_ERRORS"
echo "  📱 Chrome: $CHROME_ERRORS"
echo "  🌐 Safari: $SAFARI_ERRORS"
echo ""
echo "📂 Error Categories:"
echo "  🍴 Recipe Parsing: $RECIPE_PARSING_ERRORS"
echo "  🖼️  Image Upload: $IMAGE_UPLOAD_ERRORS"
echo "  🔒 Authentication: $AUTH_ERRORS"
echo "  ❓ Other: $OTHER_ERRORS"
echo ""
echo "📁 Analysis saved to: $OUTPUT_DIR/extension-analysis.txt"

if [ $TOTAL_EXTENSION_ERRORS -gt 0 ]; then
    echo ""
    echo "🔥 CRITICAL EXTENSION ISSUES:"
    if [ $IMAGE_UPLOAD_ERRORS -gt 0 ]; then
        echo "  ❌ Image upload failures detected ($IMAGE_UPLOAD_ERRORS)"
    fi
    if [ $AUTH_ERRORS -gt 0 ]; then
        echo "  ❌ Authentication issues detected ($AUTH_ERRORS)"
    fi
    if [ $RECIPE_PARSING_ERRORS -gt 0 ]; then
        echo "  ❌ Recipe parsing failures detected ($RECIPE_PARSING_ERRORS)"
    fi
else
    echo ""
    echo "✅ No extension errors found in diagnostic data"
fi

echo ""
echo "💡 To analyze Flutter errors, run: ./tools/analyze-flutter-errors.sh"
echo "💡 To see raw data, check: $OUTPUT_DIR/raw-data/"