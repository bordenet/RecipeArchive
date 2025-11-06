#!/usr/bin/env bash

################################################################################
# RecipeArchive New Adopter Environment Setup
################################################################################
# PURPOSE: Configure browser extensions to use new adopter's AWS infrastructure
#   - Validates .env configuration
#   - Generates extension configuration files from .env
#   - Updates Flutter app configuration
#   - Builds extensions with correct AWS infrastructure
#
# USAGE:
#   ./scripts/setup-new-adopter-environment.sh
#
# EXAMPLES:
#   ./scripts/setup-new-adopter-environment.sh
#
# DEPENDENCIES:
#   - npm (for building extensions)
#   - node (for build scripts)
#
# ENVIRONMENT VARIABLES:
#   Required in .env:
#   - AWS_REGION
#   - COGNITO_USER_POOL_ID
#   - COGNITO_APP_CLIENT_ID
#   - API_BASE_URL
#   - WEB_APP_URL
#   - S3_RECIPE_STORAGE_BUCKET
#
# NOTES:
#   - Generates env-config.js and manifest.json files (auto-gitignored)
#   - No source code modifications required
#   - Clean separation between source code and configuration
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
    "AWS_REGION"
    "COGNITO_USER_POOL_ID"
    "COGNITO_APP_CLIENT_ID"
    "API_BASE_URL"
    "WEB_APP_URL"
    "S3_RECIPE_STORAGE_BUCKET"
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

log_section "Building Browser Extensions with Your Configuration"

# Change to repo root for npm commands
cd "$REPO_ROOT" || die "Failed to change to repository root"

# Generate env-config.js and manifest.json for all extensions
log_info "Generating extension configuration files..."
npm run build:extension-env || die "Failed to generate extension configuration"

log_success "Extension configuration files generated"
echo ""
log_info "Generated files (gitignored):"
echo "  • extensions/chrome/env-config.js"
echo "  • extensions/chrome/manifest.json"
echo "  • extensions/safari/env-config.js"
echo "  • extensions/safari/manifest.json"
echo "  • extensions/shared/env-config.js"
echo ""

# Update Flutter configuration
log_section "Updating Flutter App"

readonly FLUTTER_ENV="$REPO_ROOT/recipe_archive/.env"
if [[ -f "$ENV_FILE" ]]; then
    log_info "Updating recipe_archive/.env..."
    cat > "$FLUTTER_ENV" << EOL
API_GATEWAY_URL=$API_BASE_URL
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID
WEB_APP_URL=$WEB_APP_URL
EOL
    log_success "Flutter configuration updated"
else
    log_warning ".env not found, skipping Flutter update"
fi

log_success "Configuration Complete!"
echo ""
log_info "Your RecipeArchive is now configured with YOUR AWS infrastructure:"
echo "  • AWS Region: $AWS_REGION"
echo "  • Cognito User Pool: $COGNITO_USER_POOL_ID"
echo "  • Cognito App Client: $COGNITO_APP_CLIENT_ID"
echo "  • API Gateway: $API_BASE_URL"
echo "  • Web App: $WEB_APP_URL"
echo "  • S3 Storage Bucket: $S3_RECIPE_STORAGE_BUCKET"
echo ""
log_info "IMPORTANT NEXT STEPS:"
echo "1. Build the complete extension bundles:"
echo "   npm run build:extensions"
echo ""
echo "2. Package extensions for distribution:"
echo "   ./scripts/extensions/package.sh"
echo ""
echo "3. Install the extensions in your browser:"
echo "   - Chrome: Load unpacked from extensions/chrome/"
echo "   - Safari: Build using Xcode (requires Safari developer certificate)"
echo ""
echo "4. Deploy your Flutter web app:"
echo "   ./scripts/web/deploy-simple.sh"
echo ""
echo "5. Test everything works:"
echo "   ./validate-monorepo.sh --all"
echo ""
log_info "Configuration files are gitignored - your AWS credentials stay private!"
