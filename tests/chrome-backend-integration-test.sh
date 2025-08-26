#!/bin/bash

# Chrome Extension Backend Integration Test
# Tests the complete flow from extension to AWS backend

set -euo pipefail

echo "🧪 Chrome Extension Backend Integration Test"
echo "============================================="

# Configuration
BACKEND_URL="http://localhost:8080"
TEST_EMAIL="mattbordenet@homail.com"
TEST_PASSWORD="Recipe123"

# Test functions
test_backend_health() {
    echo "🔍 Testing backend health..."
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" || echo "000")
    if [ "$response" = "200" ]; then
        echo "✅ Backend health check passed"
    else
        echo "❌ Backend health check failed (HTTP $response)"
        return 1
    fi
}

test_authentication() {
    echo "🔑 Testing authentication..."
    response=$(curl -s -X POST "$BACKEND_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
        2>/dev/null)
    
    if echo "$response" | grep -q "token"; then
        echo "✅ Authentication test passed"
        # Extract token for subsequent tests
        TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        export AUTH_TOKEN="$TOKEN"
    else
        echo "❌ Authentication test failed"
        echo "Response: $response"
        return 1
    fi
}

test_recipe_operations() {
    echo "📝 Testing recipe operations..."
    if [ -z "${AUTH_TOKEN:-}" ]; then
        echo "❌ No auth token available"
        return 1
    fi
    
    # Test recipe creation
    recipe_response=$(curl -s -X POST "$BACKEND_URL/api/recipes" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d '{
            "title": "Integration Test Recipe",
            "description": "Test recipe from automated test",
            "ingredients": ["1 cup test", "2 tbsp automation"],
            "instructions": ["Mix thoroughly", "Test until working"],
            "tags": ["test", "integration"]
        }' 2>/dev/null)
    
    if echo "$recipe_response" | grep -q "Integration Test Recipe"; then
        echo "✅ Recipe creation test passed"
    else
        echo "❌ Recipe creation test failed"
        echo "Response: $recipe_response"
        return 1
    fi
}

# Main test execution
main() {
    echo "Starting integration tests..."
    
    test_backend_health || exit 1
    test_authentication || exit 1
    test_recipe_operations || exit 1
    
    echo ""
    echo "🎉 All integration tests passed!"
    echo "✅ Backend health check"
    echo "✅ Authentication flow"
    echo "✅ Recipe operations"
}

# Run tests
main "$@"
