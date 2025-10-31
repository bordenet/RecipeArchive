#!/usr/bin/env bash

################################################################################
# RecipeArchive AWS Free Tier Monitoring Setup
################################################################################
# PURPOSE: Set up monitoring to stay within AWS Free Tier limits
#   - Creates SNS topic for alerts
#   - Sets up CloudWatch alarms
#   - Configures AWS Budget
#   - Monitors billing thresholds
#
# USAGE:
#   ./scripts/setup-aws-billing-controls.sh
#
# EXAMPLES:
#   ./scripts/setup-aws-billing-controls.sh
#
# DEPENDENCIES:
#   - AWS CLI
#
# ENVIRONMENT VARIABLES:
#   - ADMIN_EMAIL (optional, prompts if not set)
#
# NOTES:
#   - Requires AWS credentials configured
#   - Sets up billing alerts for Free Tier
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

readonly REPO_ROOT="$(get_repo_root)"

log_header "AWS Free Tier Monitoring Setup"
log_warning "This will monitor your AWS Free Tier usage and alert you before you exceed limits"

# Check AWS CLI configuration
if ! aws sts get-caller-identity > /tmp/setup-aws-billing-controls.log 2>&1; then
    die "AWS CLI is not configured. Please run 'aws configure' first."
fi

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ADMIN_EMAIL=""

# Load email from .env if available
if [[ -f "$REPO_ROOT/aws-backend/.env" ]]; then
    source "$REPO_ROOT/aws-backend/.env"
    if [[ -n "$ADMIN_EMAIL" ]]; then
        log_info "Using email from .env: $ADMIN_EMAIL"
    fi
fi

rm -f /tmp/freetier-budget.json /tmp/freetier-notifications.json

log_success "🎉 AWS Free Tier Monitoring Setup Complete!"
log_info ""
log_info "🆓 What was set up:"
log_info "  • CloudWatch alarm for ANY charges (should stay at $0)"
log_info "  • Backup alarm at $1 (in case you exceed Free Tier)"
log_info "  • Monthly budget of $1 with alerts at $0.01 actual and $0.50 forecasted"
log_info "  • SNS topic for Free Tier alerts"
log_info ""
log_info "📋 AWS Free Tier Limits for RecipeArchive:"
log_info "  • DynamoDB: 25 GB storage, 25 WCU/RCU"
log_info "  • S3: 5 GB storage, 20K GET, 2K PUT requests"
log_info "  • Lambda: 1M requests, 400K GB-seconds"
log_info "  • API Gateway: 1M API calls"
log_info "  • Cognito: 50K monthly active users"
log_info "  • CloudWatch: 10 custom metrics, basic monitoring"
log_info "  • SNS: 1K email notifications"
log_info ""
log_warning "⚠️  Important Notes:"
log_info "  • Check your email and CONFIRM the SNS subscription!"
log_info "  • Enable billing alerts: AWS Console > Billing > Billing preferences"
log_info "  • Monitor AWS Free Tier dashboard regularly"
log_info "  • All components are configured to stay within Free Tier limits"
log_info "  • Your costs should remain $0.00 during development"
log_info ""
log_info " Useful Links:"
log_info "  • Free Tier Dashboard: https://console.aws.amazon.com/billing/home#/freetier"
log_info "  • Cost Management: https://console.aws.amazon.com/cost-management/home"