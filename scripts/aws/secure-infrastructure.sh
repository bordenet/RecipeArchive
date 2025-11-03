#!/usr/bin/env bash

################################################################################
# RecipeArchive Secure Infrastructure Deployment
################################################################################
# PURPOSE: Deploy secure AWS infrastructure with randomized identifiers
#   - Deploys CDK infrastructure stack
#   - Uses randomized resource names for security
#   - Sets up S3, Lambda, API Gateway, Cognito
#   - Configures secure policies and permissions
#
# USAGE:
#   ./scripts/aws/secure-infrastructure.sh
#
# EXAMPLES:
#   ./scripts/aws/secure-infrastructure.sh
#
# DEPENDENCIES:
#   - AWS CLI
#   - Node.js
#   - AWS CDK
#   - jq
#
# NOTES:
#   - Requires AWS credentials configured
#   - Uses CDK for infrastructure as code
#   - Generates random identifiers for resources
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

readonly REPO_ROOT="$(get_repo_root)"

log_header "Secure Infrastructure Deployment"

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"

    require_command "aws" "brew install awscli"
    require_command "node" "brew install node"
    
    if ! command -v cdk &> /dev/null; then
        log_warning "CDK CLI not found. Installing..."
        npm install -g aws-cdk || die "Failed to install CDK"
    fi

    if ! aws sts get-caller-identity > /tmp/deploy-secure-infrastructure.log 2>&1; then
        die "AWS credentials not configured. Please run 'aws configure'"
    fi

    log_success "Prerequisites validated"
}

main "$@"
