#!/bin/bash
# iOS Share Extension Integration Test
# Tests the end-to-end flow: empty arrays + URL -> backend fetch -> parse -> save -> normalize

set -e

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../.env" ]; then
    set -a
    source "$SCRIPT_DIR/../.env"
    set +a
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${CLOUDFRONT_URL:-https://your-cloudfront-distribution.cloudfront.net}"
TEST_URL="https://www.allrecipes.com/recipe/62696/chicken-parmesan-casserole/"
TEST_RECIPE_TITLE="Chicken Parmesan Casserole"
MIN_INGREDIENTS=5
MIN_INSTRUCTIONS=5

echo -e "${BLUE}🧪 iOS Share Extension Integration Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for required environment variables
if [ -z "$COGNITO_USER_EMAIL" ] || [ -z "$COGNITO_USER_PASSWORD" ]; then
    echo -e "${RED}❌ ERROR: COGNITO_USER_EMAIL and COGNITO_USER_PASSWORD must be set${NC}"
    exit 1
fi

echo -e "${BLUE}📝 Step 1: Authenticate with Cognito${NC}"
AUTH_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${COGNITO_USER_EMAIL}\",
        \"password\": \"${COGNITO_USER_PASSWORD}\"
    }")

ID_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.idToken // empty')
USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.userId // empty')

if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" == "null" ]; then
    echo -e "${RED}❌ Authentication failed${NC}"
    echo "$AUTH_RESPONSE" | jq .
    exit 1
fi

echo -e "${GREEN}✅ Authenticated as ${COGNITO_USER_EMAIL}${NC}"
echo ""

echo -e "${BLUE}📝 Step 2: Submit recipe with empty arrays (iOS Share Extension pattern)${NC}"
RECIPE_PAYLOAD=$(cat <<EOF
{
    "sourceUrl": "${TEST_URL}",
    "title": "Recipe from allrecipes.com",
    "ingredients": [],
    "instructions": []
}
EOF
)

SUBMIT_RESPONSE=$(curl -s -X POST "${API_URL}/recipes" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ID_TOKEN}" \
    -d "$RECIPE_PAYLOAD")

RECIPE_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.recipe.id // empty')

if [ -z "$RECIPE_ID" ] || [ "$RECIPE_ID" == "null" ]; then
    echo -e "${RED}❌ Recipe submission failed${NC}"
    echo "$SUBMIT_RESPONSE" | jq .
    exit 1
fi

echo -e "${GREEN}✅ Recipe submitted successfully: ${RECIPE_ID}${NC}"
echo ""

echo -e "${BLUE}📝 Step 3: Wait for backend HTML parsing and normalization${NC}"
echo -e "${YELLOW}⏳ Waiting 15 seconds for processing...${NC}"
sleep 15
echo ""

echo -e "${BLUE}📝 Step 4: Fetch recipe and verify content${NC}"
RECIPE_RESPONSE=$(curl -s -X GET "${API_URL}/recipes/${RECIPE_ID}" \
    -H "Authorization: Bearer ${ID_TOKEN}")

TITLE=$(echo "$RECIPE_RESPONSE" | jq -r '.title // empty')
INGREDIENT_COUNT=$(echo "$RECIPE_RESPONSE" | jq '.ingredients | length // 0')
INSTRUCTION_COUNT=$(echo "$RECIPE_RESPONSE" | jq '.instructions | length // 0')
MAIN_PHOTO=$(echo "$RECIPE_RESPONSE" | jq -r '.mainPhotoUrl // empty')

echo -e "${BLUE}📊 Recipe Details:${NC}"
echo -e "   Title: ${TITLE}"
echo -e "   Ingredients: ${INGREDIENT_COUNT}"
echo -e "   Instructions: ${INSTRUCTION_COUNT}"
echo -e "   Main Photo: ${MAIN_PHOTO}"
echo ""

# Verify results
PASS=true

if [ "$INGREDIENT_COUNT" -lt "$MIN_INGREDIENTS" ]; then
    echo -e "${RED}❌ FAIL: Expected at least ${MIN_INGREDIENTS} ingredients, got ${INGREDIENT_COUNT}${NC}"
    PASS=false
else
    echo -e "${GREEN}✅ PASS: Ingredients parsed correctly (${INGREDIENT_COUNT} >= ${MIN_INGREDIENTS})${NC}"
fi

if [ "$INSTRUCTION_COUNT" -lt "$MIN_INSTRUCTIONS" ]; then
    echo -e "${RED}❌ FAIL: Expected at least ${MIN_INSTRUCTIONS} instructions, got ${INSTRUCTION_COUNT}${NC}"
    PASS=false
else
    echo -e "${GREEN}✅ PASS: Instructions parsed correctly (${INSTRUCTION_COUNT} >= ${MIN_INSTRUCTIONS})${NC}"
fi

if [ -z "$MAIN_PHOTO" ] || [ "$MAIN_PHOTO" == "null" ]; then
    echo -e "${YELLOW}⚠️  WARN: No main photo extracted${NC}"
else
    echo -e "${GREEN}✅ PASS: Main photo extracted${NC}"
fi

if [[ "$TITLE" == *"$TEST_RECIPE_TITLE"* ]]; then
    echo -e "${GREEN}✅ PASS: Title normalized correctly${NC}"
else
    echo -e "${YELLOW}⚠️  WARN: Title may not be normalized (got: ${TITLE})${NC}"
fi

echo ""

if [ "$PASS" = true ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo -e "${GREEN}iOS Share Extension workflow is functioning correctly.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
