#!/bin/bash

################################################################################
#
# Load Environment Variables Script
#
# This script loads environment variables from the .env file in the root of the
# repository.
#
# USAGE:
#   source scripts/load-env.sh
#
# NOTES:
#   - This script is designed to be sourced, not executed.
#
################################################################################

# Load environment variables from .env file
# Usage: source scripts/load-env.sh

# Determine project root relative to this script
if [[ -n "${BASH_SOURCE[0]}" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
else
    # Fallback when sourced without BASH_SOURCE
    PROJECT_ROOT="$(pwd)"
fi

ENV_FILE="$PROJECT_ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
    echo "🔧 Loading environment variables from .env file..."
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
    echo "✅ Environment variables loaded successfully"
    echo "📧 Test user email: $TEST_USER_EMAIL"
    echo "🪣 S3 recipe storage: $S3_RECIPE_STORAGE_BUCKET"
    echo "🌍 AWS region: $AWS_REGION"
else
    echo "❌ Error: .env file not found at $ENV_FILE"
    echo "💡 Please ensure .env exists in the project root with your credentials"
    exit 1
fi