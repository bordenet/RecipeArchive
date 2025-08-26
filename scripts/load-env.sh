#!/bin/bash
# Load environment variables from .env file
# Usage: source scripts/load-env.sh

ENV_FILE="/Users/matt/GitHub/RecipeArchive/.env"

if [[ -f "$ENV_FILE" ]]; then
    echo "🔧 Loading environment variables from .env file..."
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    echo "✅ Environment variables loaded successfully"
    echo "📧 Test user email: $TEST_USER_EMAIL"
    echo "🪣 S3 bucket: $S3_BUCKET_NAME"
    echo "🌍 AWS region: $AWS_REGION"
else
    echo "❌ Error: .env file not found at $ENV_FILE"
    echo "💡 Please copy .env.template to .env and configure with your credentials"
    exit 1
fi