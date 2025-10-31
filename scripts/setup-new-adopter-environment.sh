#!/usr/bin/env bash

################################################################################
# RecipeArchive New Adopter Environment Setup
################################################################################
# PURPOSE: Configure browser extensions to use new adopter's AWS infrastructure
#   - Validates .env configuration
#   - Updates hardcoded values in Chrome/Safari extensions
#   - Updates Flutter app configuration
#   - Creates backup files for all changes
#
# USAGE:
#   ./scripts/setup-new-adopter-environment.sh
#
# EXAMPLES:
#   ./scripts/setup-new-adopter-environment.sh
#
# DEPENDENCIES:
#   - sed
#
# ENVIRONMENT VARIABLES:
#   Required in .env:
#   - COGNITO_USER_POOL_ID
#   - COGNITO_APP_CLIENT_ID
#   - API_BASE_URL
#   - WEB_APP_URL
#
# NOTES:
#   - Creates .backup files for all modified files
#   - Replaces hardcoded AWS infrastructure values
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly ENV_FILE="$REPO_ROOT/.env"

log_header "New Adopter Environment Setup"

log_info "This script will configure RecipeArchive to use YOUR AWS infrastructure"
log_info "instead of the original developer's resources."
echo ""

# Validate .env exists
require_file "$ENV_FILE" ".env file not found. Please run: cp .env.example .env and edit with your AWS details."

# Load environment variables
set -a
source "$ENV_FILE"
set +a

# Validate required variables
REQUIRED_VARS=(
    "COGNITO_USER_POOL_ID"
    "COGNITO_APP_CLIENT_ID"
    "API_BASE_URL"
    "WEB_APP_URL"
)

log_section "Validating Configuration"
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]] || [[ "${!var}" == *"your-"* ]] || [[ "${!var}" == *"example"* ]]; then
        die "$var is not properly configured in .env. Current value: ${!var}"
    fi
    log_debug "$var: ${!var}"
done

log_success ".env configuration validated"
echo ""

# Function to update JavaScript files with user's configuration
update_js_config() {
    local file="$1"
    local backup_file="${file}.backup"

    log_debug "Updating $file..."

    # Create backup
    cp "$file" "$backup_file" || die "Failed to create backup of $file"

    # Replace hardcoded production values with user's values
    sed -i.tmp \
        -e "s/us-west-2_rpBcEEhYK/$COGNITO_USER_POOL_ID/g" \
        -e "s/7lm8mqr03s0m0fn17dnv373s4h/$COGNITO_APP_CLIENT_ID/g" \
        -e "s#https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod#$API_BASE_URL#g" \
        -e "s#https://d1jcaphz4458q7.cloudfront.net#$WEB_APP_URL#g" \
        "$file" || die "Failed to update $file"

    # Clean up temporary files
    rm -f "${file}.tmp"

    log_debug "Updated $file (backup: $backup_file)"
}

# Function to update JSON files with user's configuration
update_json_config() {
    local file="$1"
    local backup_file="${file}.backup"

    log_debug "Updating $file..."

    # Create backup
    cp "$file" "$backup_file" || die "Failed to create backup of $file"

    # Use sed for JSON files as well (more reliable than jq for this use case)
    sed -i.tmp \
        -e "s/us-west-2_rpBcEEhYK/$COGNITO_USER_POOL_ID/g" \
        -e "s/7lm8mqr03s0m0fn17dnv373s4h/$COGNITO_APP_CLIENT_ID/g" \
        -e "s#https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod#$API_BASE_URL#g" \
        -e "s#https://d1jcaphz4458q7.cloudfront.net#$WEB_APP_URL#g" \
        "$file" || die "Failed to update $file"

    # Clean up temporary files
    rm -f "${file}.tmp"

    log_debug "Updated $file (backup: $backup_file)"
}

log_section "Configuring Browser Extensions"

# Update Chrome extension files
if [[ -d "$REPO_ROOT/extensions/chrome" ]]; then
    log_info "Updating Chrome extension..."
    cd "$REPO_ROOT/extensions/chrome" || die "Failed to change to Chrome extension directory"

    for file in config.js env-config.js popup.js content.js background.js fix-config.js compare-auth-methods.js; do
        [[ -f "$file" ]] && update_js_config "$file"
    done

    for file in manifest.json config.sample.json; do
        [[ -f "$file" ]] && update_json_config "$file"
    done

    log_success "Chrome extension updated"
else
    log_warning "Chrome extension directory not found, skipping"
fi

# Update Safari extension files
if [[ -d "$REPO_ROOT/extensions/safari" ]]; then
    log_info "Updating Safari extension..."
    cd "$REPO_ROOT/extensions/safari" || die "Failed to change to Safari extension directory"

    for file in config.js env-config.js popup.js content.js; do
        [[ -f "$file" ]] && update_js_config "$file"
    done

    log_success "Safari extension updated"
else
    log_warning "Safari extension directory not found, skipping"
fi

# Update Flutter configuration
log_section "Updating Flutter App"
cd "$REPO_ROOT" || die "Failed to change to repository root"

readonly FLUTTER_ENV="$REPO_ROOT/recipe_archive/.env"
if [[ -f "$FLUTTER_ENV" ]]; then
    log_info "Updating recipe_archive/.env..."
    cat > "$FLUTTER_ENV" << EOL
API_GATEWAY_URL=$API_BASE_URL
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
WEB_APP_URL=$WEB_APP_URL
EOL
    log_success "Flutter configuration updated"
else
    log_warning "recipe_archive/.env not found, skipping Flutter update"
fi

log_success "Configuration Complete!"
echo ""
log_info "Your RecipeArchive is now configured with YOUR AWS infrastructure:"
echo "  • Cognito User Pool: $COGNITO_USER_POOL_ID"
echo "  • Cognito App Client: $COGNITO_APP_CLIENT_ID"
echo "  • API Gateway: $API_BASE_URL"
echo "  • Web App: $WEB_APP_URL"
echo ""
log_info "IMPORTANT NEXT STEPS:"
echo "1. Build and package your browser extensions:"
echo "   npm run build:extensions"
echo "   ./scripts/extensions/package.sh"
echo ""
echo "2. Install the extensions in your browser using the generated packages"
echo ""
echo "3. Deploy your Flutter web app:"
echo "   ./scripts/web/deploy-simple.sh"
echo ""
echo "4. Test everything works:"
echo "   ./validate-monorepo.sh --all"
echo ""
log_info "Backup files (.backup) created for all modified files"