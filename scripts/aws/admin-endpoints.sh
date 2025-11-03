#!/usr/bin/env bash

################################################################################
# RecipeArchive Admin Endpoints Deployment
################################################################################
# PURPOSE: Add missing admin/invitations endpoints to existing API Gateway
#   - Creates /admin resource in API Gateway
#   - Creates /admin/invitations resource
#   - Links to InvitationManager Lambda function
#   - Configures POST method with Lambda integration
#   - Sets up CORS for endpoints
#   - Deploys changes to production stage
#
# USAGE:
#   ./scripts/aws/admin-endpoints.sh
#
# EXAMPLES:
#   ./scripts/aws/admin-endpoints.sh
#
# DEPENDENCIES:
#   - AWS CLI
#
# ENVIRONMENT VARIABLES:
#   - API_GATEWAY_ID (required)
#
# NOTES:
#   - Requires .env file configured
#   - Adds endpoints to existing API Gateway (minimal CDK stack)
#   - Skips creation if endpoints already exist
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"

log_header "Adding Admin Endpoints to API Gateway"

# Load environment variables
if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
else
    die ".env file not found"
fi

if [[ -z "$API_GATEWAY_ID" ]]; then
    die "API_GATEWAY_ID not set in .env"
fi

log_info "API Gateway ID: $API_GATEWAY_ID"

# Find invitation manager Lambda function
log_section "Finding Lambda Function"
LAMBDA_FUNCTION=$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `InvitationManager`)].FunctionName' --output text)
if [[ -z "$LAMBDA_FUNCTION" ]]; then
    die "Invitation Manager Lambda function not found"
fi

log_success "Lambda Function: $LAMBDA_FUNCTION"

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function --function-name "$LAMBDA_FUNCTION" --query 'Configuration.FunctionArn' --output text)
log_info "Lambda ARN: $LAMBDA_ARN"

# Get root resource ID
log_section "Configuring API Gateway Resources"
ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==null].id' --output text)
log_info "Root Resource ID: $ROOT_ID"

# Check if admin resource already exists
EXISTING_ADMIN=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==`admin`].id' --output text)

if [[ -n "$EXISTING_ADMIN" ]]; then
    log_warning "Admin resource already exists: $EXISTING_ADMIN"
    ADMIN_RESOURCE_ID="$EXISTING_ADMIN"
else
    log_info "Creating admin resource..."
    ADMIN_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id "$API_GATEWAY_ID" \
        --parent-id "$ROOT_ID" \
        --path-part admin \
        --query 'id' --output text)
    log_success "Created admin resource: $ADMIN_RESOURCE_ID"
fi

# Check if invitations resource already exists
EXISTING_INVITATIONS=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==`invitations`].id' --output text)

if [[ -n "$EXISTING_INVITATIONS" ]]; then
    log_warning "Invitations resource already exists: $EXISTING_INVITATIONS"
    INVITATIONS_RESOURCE_ID="$EXISTING_INVITATIONS"
else
    log_info "Creating invitations resource..."
    INVITATIONS_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id "$API_GATEWAY_ID" \
        --parent-id "$ADMIN_RESOURCE_ID" \
        --path-part invitations \
        --query 'id' --output text)

    log_success "✅ Created invitations resource: $INVITATIONS_RESOURCE_ID"
fi

# Check if invitation ID resource already exists
EXISTING_INVITATION_ID=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?parentId==`'$INVITATIONS_RESOURCE_ID'` && pathPart==`{invitationId}`].id' --output text)

if [ -n "$EXISTING_INVITATION_ID" ]; then
    log_warning "⚠️  Invitation ID resource already exists: $EXISTING_INVITATION_ID"
    INVITATION_ID_RESOURCE_ID="$EXISTING_INVITATION_ID"
else
    echo "Creating invitation ID resource..."
    INVITATION_ID_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id "$API_GATEWAY_ID" \
        --parent-id "$INVITATIONS_RESOURCE_ID" \
        --path-part '{invitationId}' \
        --query 'id' --output text)
    log_success "✅ Created invitation ID resource: $INVITATION_ID_RESOURCE_ID"
fi

# Add Lambda permission for API Gateway
log_info "Adding Lambda permission..."
aws lambda add-permission \
    --function-name "$LAMBDA_FUNCTION" \
    --statement-id "apigateway-invoke-admin-invitations-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):$API_GATEWAY_ID/*/*" \
    2>/dev/null || log_warning "⚠️  Lambda permission may already exist"

# Function to add method and integration
add_method_with_integration() {
    local HTTP_METHOD=$1
    local DESCRIPTION=$2

    echo "Adding $HTTP_METHOD method for $DESCRIPTION..."

    # Check if method already exists
    if aws apigateway get-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATIONS_RESOURCE_ID" --http-method "$HTTP_METHOD" >/dev/null 2>&1; then
        log_warning "⚠️  $HTTP_METHOD method already exists, deleting first..."
        aws apigateway delete-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATIONS_RESOURCE_ID" --http-method "$HTTP_METHOD"
    fi

    # Add method
    aws apigateway put-method \
        --rest-api-id "$API_GATEWAY_ID" \
        --resource-id "$INVITATIONS_RESOURCE_ID" \
        --http-method "$HTTP_METHOD" \
        --authorization-type NONE \
        --no-api-key-required >/dev/null

    # Add integration
    aws apigateway put-integration \
        --rest-api-id "$API_GATEWAY_ID" \
        --resource-id "$INVITATIONS_RESOURCE_ID" \
        --http-method "$HTTP_METHOD" \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$AWS_REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" >/dev/null

    log_success "✅ Added $HTTP_METHOD method for $DESCRIPTION"
}

# Add methods for invitations collection
add_method_with_integration "GET" "listing invitations"
add_method_with_integration "POST" "creating invitations"

# Add DELETE method for individual invitations
log_info "Adding DELETE method for individual invitation..."
if aws apigateway get-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATION_ID_RESOURCE_ID" --http-method DELETE >/dev/null 2>&1; then
    log_warning "⚠️  DELETE method already exists, deleting first..."
    aws apigateway delete-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATION_ID_RESOURCE_ID" --http-method DELETE
fi

# Add DELETE method
aws apigateway put-method \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATION_ID_RESOURCE_ID" \
    --http-method DELETE \
    --authorization-type NONE \
    --no-api-key-required >/dev/null

# Add integration for DELETE
aws apigateway put-integration \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATION_ID_RESOURCE_ID" \
    --http-method DELETE \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$AWS_REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" >/dev/null

log_success "✅ Added DELETE method for individual invitation"

# Add OPTIONS method for CORS
log_info "Adding OPTIONS method for CORS..."
if aws apigateway get-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATIONS_RESOURCE_ID" --http-method OPTIONS >/dev/null 2>&1; then
    log_warning "⚠️  OPTIONS method already exists, deleting first..."
    aws apigateway delete-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATIONS_RESOURCE_ID" --http-method OPTIONS
fi

aws apigateway put-method \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATIONS_RESOURCE_ID" \
    --http-method OPTIONS \
    --authorization-type NONE \
    --no-api-key-required >/dev/null

# Add CORS integration for OPTIONS
aws apigateway put-integration \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATIONS_RESOURCE_ID" \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' >/dev/null

# Add method response for OPTIONS
aws apigateway put-method-response \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATIONS_RESOURCE_ID" \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false >/dev/null

# Add integration response for OPTIONS
aws apigateway put-integration-response \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATIONS_RESOURCE_ID" \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization'\''","method.response.header.Access-Control-Allow-Methods":"'\''GET,POST,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}'>/dev/null

log_success "✅ Added OPTIONS method for CORS"

# Add OPTIONS method for CORS on invitation ID resource
log_info "Adding OPTIONS method for CORS on invitation ID resource..."
aws apigateway put-method \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATION_ID_RESOURCE_ID" \
    --http-method OPTIONS \
    --authorization-type NONE \
    --no-api-key-required >/dev/null

# Add CORS integration for OPTIONS on invitation ID
aws apigateway put-integration \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATION_ID_RESOURCE_ID" \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' >/dev/null

# Add method response for OPTIONS on invitation ID
aws apigateway put-method-response \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATION_ID_RESOURCE_ID" \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false >/dev/null

# Add integration response for OPTIONS on invitation ID
aws apigateway put-integration-response \
    --rest-api-id "$API_GATEWAY_ID" \
    --resource-id "$INVITATION_ID_RESOURCE_ID" \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization'\''","method.response.header.Access-Control-Allow-Methods":"'\''DELETE,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}'>/dev/null

log_success "✅ Added OPTIONS method for CORS on invitation ID resource"

# Deploy the changes
log_info "Deploying API Gateway changes..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id "$API_GATEWAY_ID" \
    --stage-name prod \
    --description "Deploy admin endpoints via script" \
    --query 'id' --output text)

log_success "✅ Deployed API Gateway changes (Deployment ID: $DEPLOYMENT_ID)"

# Test the endpoint
log_info ""
log_info "Testing admin endpoints..."
if [ -n "$RECIPE_ADMIN_TOKEN" ]; then
    echo "Testing GET /admin/invitations..."
    RESPONSE=$(curl -s -H "Authorization: Bearer $RECIPE_ADMIN_TOKEN" \
        "https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/admin/invitations")
    echo "Response: $RESPONSE"

    if echo "$RESPONSE" | grep -q '"invitations"'; then
        log_success "✅ Admin endpoint is working correctly!"
    else
        log_warning "⚠️  Endpoint accessible but unexpected response"
    fi
else
    log_warning "⚠️  RECIPE_ADMIN_TOKEN not set, skipping endpoint test"
fi

# Add analytics endpoints
log_info "Adding analytics endpoints..."

# Find analytics Lambda function
ANALYTICS_FUNCTION=$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `Analytics`)].FunctionName' --output text)
if [ -n "$ANALYTICS_FUNCTION" ]; then
    echo "Analytics Function: $ANALYTICS_FUNCTION"

    # Get analytics Lambda ARN
    ANALYTICS_ARN=$(aws lambda get-function --function-name "$ANALYTICS_FUNCTION" --query 'Configuration.FunctionArn' --output text)

    # Add Lambda permission for analytics
    aws lambda add-permission \
        --function-name "$ANALYTICS_FUNCTION" \
        --statement-id "apigateway-invoke-analytics-$(date +%s)" \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "arn:aws:execute-api:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):$API_GATEWAY_ID/*/*" \
        2>/dev/null || log_warning "⚠️  Analytics Lambda permission may already exist"

    # Create analytics resource
    EXISTING_ANALYTICS=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==`analytics`].id' --output text)
    if [ -n "$EXISTING_ANALYTICS" ]; then
        ANALYTICS_RESOURCE_ID="$EXISTING_ANALYTICS"
    else
        ANALYTICS_RESOURCE_ID=$(aws apigateway create-resource \
            --rest-api-id "$API_GATEWAY_ID" \
            --parent-id "$ROOT_ID" \
            --path-part analytics \
            --query 'id' --output text)
        log_success "✅ Created analytics resource: $ANALYTICS_RESOURCE_ID"
    fi

    # Create summary and events resources
    EXISTING_SUMMARY=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==`summary`].id' --output text)
    if [ -n "$EXISTING_SUMMARY" ]; then
        SUMMARY_RESOURCE_ID="$EXISTING_SUMMARY"
    else
        SUMMARY_RESOURCE_ID=$(aws apigateway create-resource \
            --rest-api-id "$API_GATEWAY_ID" \
            --parent-id "$ANALYTICS_RESOURCE_ID" \
            --path-part summary \
            --query 'id' --output text)
        log_success "✅ Created summary resource: $SUMMARY_RESOURCE_ID"
    fi

    EXISTING_EVENTS=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==`events`].id' --output text)
    if [ -n "$EXISTING_EVENTS" ]; then
        EVENTS_RESOURCE_ID="$EXISTING_EVENTS"
    else
        EVENTS_RESOURCE_ID=$(aws apigateway create-resource \
            --rest-api-id "$API_GATEWAY_ID" \
            --parent-id "$ANALYTICS_RESOURCE_ID" \
            --path-part events \
            --query 'id' --output text)
        log_success "✅ Created events resource: $EVENTS_RESOURCE_ID"
    fi

    # Add methods and integrations for analytics
    add_analytics_method() {
        local RESOURCE_ID=$1
        local HTTP_METHOD=$2
        local DESCRIPTION=$3

        if aws apigateway get-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$RESOURCE_ID" --http-method "$HTTP_METHOD" >/dev/null 2>&1; then
            aws apigateway delete-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$RESOURCE_ID" --http-method "$HTTP_METHOD"
        fi

        aws apigateway put-method \
            --rest-api-id "$API_GATEWAY_ID" \
            --resource-id "$RESOURCE_ID" \
            --http-method "$HTTP_METHOD" \
            --authorization-type NONE \
            --no-api-key-required >/dev/null

        aws apigateway put-integration \
            --rest-api-id "$API_GATEWAY_ID" \
            --resource-id "$RESOURCE_ID" \
            --http-method "$HTTP_METHOD" \
            --type AWS_PROXY \
            --integration-http-method POST \
            --uri "arn:aws:apigateway:$AWS_REGION:lambda:path/2015-03-31/functions/$ANALYTICS_ARN/invocations" >/dev/null

        log_success "✅ Added $HTTP_METHOD method for $DESCRIPTION"
    }

    add_analytics_method "$SUMMARY_RESOURCE_ID" "GET" "analytics summary"
    add_analytics_method "$EVENTS_RESOURCE_ID" "POST" "analytics events"

    log_success "✅ Analytics endpoints configured"
else
    log_warning "⚠️  Analytics Lambda function not found, skipping analytics endpoints"
fi

log_info ""
log_success "🎉 Admin and analytics endpoints deployment complete!"
log_info "Endpoints available:"
log_info "  GET  https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/admin/invitations"
log_info "  POST https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/admin/invitations"
log_info "  GET  https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/analytics/summary"
log_info "  POST https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/analytics/events"