#!/usr/bin/env bash

#===============================================================================
# Deploy Admin Endpoints to API Gateway
#===============================================================================
# PURPOSE: Add missing admin/invitations endpoints to existing API Gateway
#
# USAGE:
#   ./scripts/aws-deploy-admin-endpoints.sh
#
# REQUIREMENTS:
#   - AWS CLI configured
#   - .env file with API_GATEWAY_ID
#
# This script adds the admin endpoints that are missing from the minimal CDK stack
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Adding Admin Endpoints to API Gateway${NC}"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

if [ -z "$API_GATEWAY_ID" ]; then
    echo -e "${RED}❌ API_GATEWAY_ID not set in .env${NC}"
    exit 1
fi

echo "API Gateway ID: $API_GATEWAY_ID"

# Find invitation manager Lambda function
LAMBDA_FUNCTION=$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `InvitationManager`)].FunctionName' --output text)
if [ -z "$LAMBDA_FUNCTION" ]; then
    echo -e "${RED}❌ Invitation Manager Lambda function not found${NC}"
    exit 1
fi

echo "Lambda Function: $LAMBDA_FUNCTION"

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function --function-name "$LAMBDA_FUNCTION" --query 'Configuration.FunctionArn' --output text)
echo "Lambda ARN: $LAMBDA_ARN"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==null].id' --output text)
echo "Root Resource ID: $ROOT_ID"

# Check if admin resource already exists
EXISTING_ADMIN=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==`admin`].id' --output text)

if [ -n "$EXISTING_ADMIN" ]; then
    echo -e "${YELLOW}⚠️  Admin resource already exists: $EXISTING_ADMIN${NC}"
    ADMIN_RESOURCE_ID="$EXISTING_ADMIN"
else
    echo "Creating admin resource..."
    ADMIN_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id "$API_GATEWAY_ID" \
        --parent-id "$ROOT_ID" \
        --path-part admin \
        --query 'id' --output text)
    echo -e "${GREEN}✅ Created admin resource: $ADMIN_RESOURCE_ID${NC}"
fi

# Check if invitations resource already exists
EXISTING_INVITATIONS=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?pathPart==`invitations`].id' --output text)

if [ -n "$EXISTING_INVITATIONS" ]; then
    echo -e "${YELLOW}⚠️  Invitations resource already exists: $EXISTING_INVITATIONS${NC}"
    INVITATIONS_RESOURCE_ID="$EXISTING_INVITATIONS"
else
    echo "Creating invitations resource..."
    INVITATIONS_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id "$API_GATEWAY_ID" \
        --parent-id "$ADMIN_RESOURCE_ID" \
        --path-part invitations \
        --query 'id' --output text)
    echo -e "${GREEN}✅ Created invitations resource: $INVITATIONS_RESOURCE_ID${NC}"
fi

# Check if invitation ID resource already exists
EXISTING_INVITATION_ID=$(aws apigateway get-resources --rest-api-id "$API_GATEWAY_ID" --query 'items[?parentId==`'$INVITATIONS_RESOURCE_ID'` && pathPart==`{invitationId}`].id' --output text)

if [ -n "$EXISTING_INVITATION_ID" ]; then
    echo -e "${YELLOW}⚠️  Invitation ID resource already exists: $EXISTING_INVITATION_ID${NC}"
    INVITATION_ID_RESOURCE_ID="$EXISTING_INVITATION_ID"
else
    echo "Creating invitation ID resource..."
    INVITATION_ID_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id "$API_GATEWAY_ID" \
        --parent-id "$INVITATIONS_RESOURCE_ID" \
        --path-part '{invitationId}' \
        --query 'id' --output text)
    echo -e "${GREEN}✅ Created invitation ID resource: $INVITATION_ID_RESOURCE_ID${NC}"
fi

# Add Lambda permission for API Gateway
echo "Adding Lambda permission..."
aws lambda add-permission \
    --function-name "$LAMBDA_FUNCTION" \
    --statement-id "apigateway-invoke-admin-invitations-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):$API_GATEWAY_ID/*/*" \
    2>/dev/null || echo -e "${YELLOW}⚠️  Lambda permission may already exist${NC}"

# Function to add method and integration
add_method_with_integration() {
    local HTTP_METHOD=$1
    local DESCRIPTION=$2

    echo "Adding $HTTP_METHOD method for $DESCRIPTION..."

    # Check if method already exists
    if aws apigateway get-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATIONS_RESOURCE_ID" --http-method "$HTTP_METHOD" >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  $HTTP_METHOD method already exists, deleting first...${NC}"
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

    echo -e "${GREEN}✅ Added $HTTP_METHOD method for $DESCRIPTION${NC}"
}

# Add methods for invitations collection
add_method_with_integration "GET" "listing invitations"
add_method_with_integration "POST" "creating invitations"

# Add DELETE method for individual invitations
echo "Adding DELETE method for individual invitation..."
if aws apigateway get-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATION_ID_RESOURCE_ID" --http-method DELETE >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  DELETE method already exists, deleting first...${NC}"
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

echo -e "${GREEN}✅ Added DELETE method for individual invitation${NC}"

# Add OPTIONS method for CORS
echo "Adding OPTIONS method for CORS..."
if aws apigateway get-method --rest-api-id "$API_GATEWAY_ID" --resource-id "$INVITATIONS_RESOURCE_ID" --http-method OPTIONS >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  OPTIONS method already exists, deleting first...${NC}"
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

echo -e "${GREEN}✅ Added OPTIONS method for CORS${NC}"

# Add OPTIONS method for CORS on invitation ID resource
echo "Adding OPTIONS method for CORS on invitation ID resource..."
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

echo -e "${GREEN}✅ Added OPTIONS method for CORS on invitation ID resource${NC}"

# Deploy the changes
echo "Deploying API Gateway changes..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id "$API_GATEWAY_ID" \
    --stage-name prod \
    --description "Deploy admin endpoints via script" \
    --query 'id' --output text)

echo -e "${GREEN}✅ Deployed API Gateway changes (Deployment ID: $DEPLOYMENT_ID)${NC}"

# Test the endpoint
echo ""
echo "Testing admin endpoints..."
if [ -n "$RECIPE_ADMIN_TOKEN" ]; then
    echo "Testing GET /admin/invitations..."
    RESPONSE=$(curl -s -H "Authorization: Bearer $RECIPE_ADMIN_TOKEN" \
        "https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/admin/invitations")
    echo "Response: $RESPONSE"

    if echo "$RESPONSE" | grep -q '"invitations"'; then
        echo -e "${GREEN}✅ Admin endpoint is working correctly!${NC}"
    else
        echo -e "${YELLOW}⚠️  Endpoint accessible but unexpected response${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  RECIPE_ADMIN_TOKEN not set, skipping endpoint test${NC}"
fi

# Add analytics endpoints
echo "Adding analytics endpoints..."

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
        2>/dev/null || echo -e "${YELLOW}⚠️  Analytics Lambda permission may already exist${NC}"

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
        echo -e "${GREEN}✅ Created analytics resource: $ANALYTICS_RESOURCE_ID${NC}"
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
        echo -e "${GREEN}✅ Created summary resource: $SUMMARY_RESOURCE_ID${NC}"
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
        echo -e "${GREEN}✅ Created events resource: $EVENTS_RESOURCE_ID${NC}"
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

        echo -e "${GREEN}✅ Added $HTTP_METHOD method for $DESCRIPTION${NC}"
    }

    add_analytics_method "$SUMMARY_RESOURCE_ID" "GET" "analytics summary"
    add_analytics_method "$EVENTS_RESOURCE_ID" "POST" "analytics events"

    echo -e "${GREEN}✅ Analytics endpoints configured${NC}"
else
    echo -e "${YELLOW}⚠️  Analytics Lambda function not found, skipping analytics endpoints${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Admin and analytics endpoints deployment complete!${NC}"
echo "Endpoints available:"
echo "  GET  https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/admin/invitations"
echo "  POST https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/admin/invitations"
echo "  GET  https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/analytics/summary"
echo "  POST https://$API_GATEWAY_ID.execute-api.$AWS_REGION.amazonaws.com/prod/analytics/events"