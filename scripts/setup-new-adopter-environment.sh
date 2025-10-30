#!/bin/bash

# RecipeArchive New Adopter Environment Setup Script
# This script helps new adopters configure their own AWS infrastructure
# and update the browser extensions to use their resources instead of
# the original developer's infrastructure.

set -e

echo "🚀 RecipeArchive New Adopter Environment Setup"
echo "=============================================="
echo ""
echo "This script will help you configure RecipeArchive to use YOUR AWS"
echo "infrastructure instead of the original developer's resources."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "💡 Please run: cp .env.example .env"
    echo "   Then edit .env with your AWS infrastructure details."
    exit 1
fi

# Source the .env file to get user's configuration
source .env

# Validate required variables are set
REQUIRED_VARS=(
    "COGNITO_USER_POOL_ID"
    "COGNITO_APP_CLIENT_ID"
    "API_BASE_URL"
    "WEB_APP_URL"
)

echo "🔍 Validating your .env configuration..."
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ] || [[ "${!var}" == *"your-"* ]] || [[ "${!var}" == *"example"* ]]; then
        echo "❌ Error: $var is not properly configured in .env"
        echo "   Current value: ${!var}"
        echo "   Please set this to your actual AWS resource value."
        exit 1
    fi
done

echo "✅ .env configuration looks good!"
echo ""

# Function to update JavaScript files with user's configuration
update_js_config() {
    local file="$1"
    local backup_file="${file}.backup"

    echo "  Updating $file..."

    # Create backup
    cp "$file" "$backup_file"

    # Replace hardcoded production values with user's values
    sed -i.tmp \
        -e "s/us-west-2_rpBcEEhYK/$COGNITO_USER_POOL_ID/g" \
        -e "s/7lm8mqr03s0m0fn17dnv373s4h/$COGNITO_APP_CLIENT_ID/g" \
        -e "s#https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod#$API_BASE_URL#g" \
        -e "s#https://d1jcaphz4458q7.cloudfront.net#$WEB_APP_URL#g" \
        "$file"

    # Clean up temporary files
    rm -f "${file}.tmp"

    echo "    ✅ Updated (backup saved as $backup_file)"
}

# Function to update JSON files with user's configuration
update_json_config() {
    local file="$1"
    local backup_file="${file}.backup"

    echo "  Updating $file..."

    # Create backup
    cp "$file" "$backup_file"

    # Use sed for JSON files as well (more reliable than jq for this use case)
    sed -i.tmp \
        -e "s/us-west-2_rpBcEEhYK/$COGNITO_USER_POOL_ID/g" \
        -e "s/7lm8mqr03s0m0fn17dnv373s4h/$COGNITO_APP_CLIENT_ID/g" \
        -e "s#https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod#$API_BASE_URL#g" \
        -e "s#https://d1jcaphz4458q7.cloudfront.net#$WEB_APP_URL#g" \
        "$file"

    # Clean up temporary files
    rm -f "${file}.tmp"

    echo "    ✅ Updated (backup saved as $backup_file)"
}

echo "🔧 Configuring browser extensions with your AWS infrastructure..."
echo ""

# Update Chrome extension files
if [ -d "extensions/chrome" ]; then
    echo "📝 Updating Chrome extension..."
    update_js_config "extensions/chrome/config.js"
    update_js_config "extensions/chrome/env-config.js"
    update_js_config "extensions/chrome/popup.js"
    update_js_config "extensions/chrome/content.js"
    update_js_config "extensions/chrome/background.js"
    update_js_config "extensions/chrome/fix-config.js"
    update_js_config "extensions/chrome/compare-auth-methods.js"
    update_json_config "extensions/chrome/manifest.json"
    update_json_config "extensions/chrome/config.sample.json"
    echo ""
fi

# Update Safari extension files
if [ -d "extensions/safari" ]; then
    echo "📝 Updating Safari extension..."
    update_js_config "extensions/safari/config.js"
    update_js_config "extensions/safari/env-config.js"
    update_js_config "extensions/safari/popup.js"
    update_js_config "extensions/safari/content.js"
    echo ""
fi

# Update Flutter configuration to use user's values
echo "📱 Updating Flutter app configuration..."
if [ -f "recipe_archive/.env" ]; then
    echo "  Updating recipe_archive/.env..."
    cat > "recipe_archive/.env" << EOL
API_GATEWAY_URL=$API_BASE_URL
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
WEB_APP_URL=$WEB_APP_URL
EOL
    echo "    ✅ Updated"
fi

echo ""
echo "🎉 Configuration Complete!"
echo "========================="
echo ""
echo "Your RecipeArchive installation is now configured to use YOUR AWS infrastructure:"
echo "  • Cognito User Pool: $COGNITO_USER_POOL_ID"
echo "  • Cognito App Client: $COGNITO_APP_CLIENT_ID"
echo "  • API Gateway: $API_BASE_URL"
echo "  • Web App: $WEB_APP_URL"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Build and package your browser extensions:"
echo "   npm run build:extensions"
echo "   ./scripts/package-extensions.sh"
echo ""
echo "2. Install the extensions in your browser using the generated packages"
echo ""
echo "3. Deploy your Flutter web app:"
echo "   ./scripts/web-deploy.sh"
echo ""
echo "4. Test everything works:"
echo "   ./validate-monorepo.sh --all"
echo ""
echo "💾 Backup files have been created for all modified files"
echo "   If you need to revert changes, restore from .backup files"
echo ""