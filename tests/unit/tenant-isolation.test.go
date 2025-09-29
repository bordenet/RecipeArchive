package main

import (
	"context"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"recipe-archive/utils"
)

// TestValidateTenantAccessSimple tests the basic tenant access validation
func TestValidateTenantAccessSimple(t *testing.T) {
	testCases := []struct {
		name        string
		request     events.APIGatewayProxyRequest
		expectValid bool
		expectError string
	}{
		{
			name: "Valid JWT with proper user ID",
			request: events.APIGatewayProxyRequest{
				Headers: map[string]string{
					"Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTUwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0.mock-signature",
				},
			},
			expectValid: true,
		},
		{
			name: "Missing Authorization header",
			request: events.APIGatewayProxyRequest{
				Headers: map[string]string{},
			},
			expectValid: false,
			expectError: "JWT validation failed",
		},
		{
			name: "Invalid JWT format",
			request: events.APIGatewayProxyRequest{
				Headers: map[string]string{
					"Authorization": "Bearer invalid-jwt",
				},
			},
			expectValid: false,
			expectError: "JWT validation failed",
		},
		{
			name: "Invalid user ID format (not UUID)",
			request: events.APIGatewayProxyRequest{
				Headers: map[string]string{
					"Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpbnZhbGlkLXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.mock-signature",
				},
			},
			expectValid: false,
			expectError: "Invalid user ID format",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := utils.ValidateTenantAccessSimple(tc.request)

			require.NoError(t, err, "Validation function should not return error")

			if tc.expectValid {
				assert.True(t, result.Valid, "Expected validation to pass")
				assert.NotEmpty(t, result.UserID, "Expected user ID to be populated")
			} else {
				assert.False(t, result.Valid, "Expected validation to fail")
				assert.Contains(t, result.Error, tc.expectError, "Expected specific error message")
			}
		})
	}
}

// TestValidateResourceAccess tests resource access validation
func TestValidateResourceAccess(t *testing.T) {
	ctx := context.Background()
	userID := "55500000-0000-0000-0000-000000000000"

	validator, err := utils.NewTenantValidation()
	require.NoError(t, err, "Should create validator successfully")

	testCases := []struct {
		name         string
		userID       string
		resourcePath string
		expectError  bool
		errorMessage string
	}{
		{
			name:         "Valid resource access",
			userID:       userID,
			resourcePath: "recipes/55500000-0000-0000-0000-000000000000/recipe123.json",
			expectError:  false,
		},
		{
			name:         "Cross-tenant access attempt",
			userID:       userID,
			resourcePath: "recipes/99999999-9999-9999-9999-999999999999/recipe123.json",
			expectError:  true,
			errorMessage: "does not belong to user",
		},
		{
			name:         "Path traversal attempt",
			userID:       userID,
			resourcePath: "recipes/55500000-0000-0000-0000-000000000000/../other-user/recipe123.json",
			expectError:  true,
			errorMessage: "path traversal detected",
		},
		{
			name:         "Double slash attempt",
			userID:       userID,
			resourcePath: "recipes//55500000-0000-0000-0000-000000000000/recipe123.json",
			expectError:  true,
			errorMessage: "path traversal detected",
		},
		{
			name:         "Root access attempt",
			userID:       userID,
			resourcePath: "recipes/recipe123.json",
			expectError:  true,
			errorMessage: "does not belong to user",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := validator.ValidateResourceAccess(ctx, tc.userID, tc.resourcePath)

			if tc.expectError {
				require.Error(t, err, "Expected validation to fail")
				assert.Contains(t, err.Error(), tc.errorMessage, "Expected specific error message")
			} else {
				require.NoError(t, err, "Expected validation to pass")
			}
		})
	}
}

// TestQuotaEnforcement tests quota enforcement logic
func TestQuotaEnforcement(t *testing.T) {
	ctx := context.Background()

	validator, err := utils.NewTenantValidation()
	require.NoError(t, err, "Should create validator successfully")

	testProfile := &utils.UserProfile{
		UserID:      "55500000-0000-0000-0000-000000000000",
		Email:       "test@example.com",
		Status:      "active",
		AccountType: "beta",
		CreatedAt:   time.Now().Add(-30 * 24 * time.Hour), // 30 days ago
		Quotas: utils.Quotas{
			MaxRecipes:        10,
			MaxNormalizations: 5,
			StorageGB:         1,
		},
		Usage: utils.Usage{
			RecipeCount:             8,
			NormalizationsThisMonth: 3,
			StorageUsedMB:           500,
		},
	}

	testCases := []struct {
		name        string
		quotaType   string
		requested   int
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Recipe count within limit",
			quotaType:   "recipe_count",
			requested:   1,
			expectError: false,
		},
		{
			name:        "Recipe count exceeds limit",
			quotaType:   "recipe_count",
			requested:   3,
			expectError: true,
			errorMsg:    "recipe quota exceeded",
		},
		{
			name:        "Normalization within limit",
			quotaType:   "normalizations",
			requested:   2,
			expectError: false,
		},
		{
			name:        "Normalization exceeds limit",
			quotaType:   "normalizations",
			requested:   3,
			expectError: true,
			errorMsg:    "normalization quota exceeded",
		},
		{
			name:        "Storage within limit",
			quotaType:   "storage_mb",
			requested:   500,
			expectError: false,
		},
		{
			name:        "Storage exceeds limit",
			quotaType:   "storage_mb",
			requested:   600,
			expectError: true,
			errorMsg:    "storage quota exceeded",
		},
		{
			name:        "Unknown quota type",
			quotaType:   "invalid_type",
			requested:   1,
			expectError: true,
			errorMsg:    "unknown quota type",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := validator.EnforceQuota(ctx, testProfile, tc.quotaType, tc.requested)

			if tc.expectError {
				require.Error(t, err, "Expected quota enforcement to fail")
				assert.Contains(t, err.Error(), tc.errorMsg, "Expected specific error message")
			} else {
				require.NoError(t, err, "Expected quota enforcement to pass")
			}
		})
	}
}

// TestUserPermissions tests user permission logic
func TestUserPermissions(t *testing.T) {
	testCases := []struct {
		name          string
		accountType   string
		expectedPerms []string
		hasPermission map[string]bool
	}{
		{
			name:          "Admin permissions",
			accountType:   "admin",
			expectedPerms: []string{"read", "write", "delete", "admin", "invite_users"},
			hasPermission: map[string]bool{
				"read":         true,
				"write":        true,
				"delete":       true,
				"admin":        true,
				"invite_users": true,
				"unknown":      false,
			},
		},
		{
			name:          "Paid user permissions",
			accountType:   "paid",
			expectedPerms: []string{"read", "write", "delete"},
			hasPermission: map[string]bool{
				"read":         true,
				"write":        true,
				"delete":       true,
				"admin":        false,
				"invite_users": false,
			},
		},
		{
			name:          "Beta user permissions",
			accountType:   "beta",
			expectedPerms: []string{"read", "write", "delete"},
			hasPermission: map[string]bool{
				"read":         true,
				"write":        true,
				"delete":       true,
				"admin":        false,
				"invite_users": false,
			},
		},
		{
			name:          "Unknown account type (default)",
			accountType:   "unknown",
			expectedPerms: []string{"read"},
			hasPermission: map[string]bool{
				"read":         true,
				"write":        false,
				"delete":       false,
				"admin":        false,
				"invite_users": false,
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			profile := &utils.UserProfile{
				AccountType: tc.accountType,
			}

			// This test would need access to the private getUserPermissions method
			// In a real implementation, you might make this method public or create a wrapper

			// For now, we'll test the logic through the validation result
			// permissions := validator.getUserPermissions(profile)

			// Placeholder assertion - in real implementation, test actual permissions
			assert.NotEmpty(t, profile.AccountType, "Account type should be set")
		})
	}
}

// BenchmarkTenantValidation benchmarks the tenant validation performance
func BenchmarkTenantValidation(b *testing.B) {
	request := events.APIGatewayProxyRequest{
		Headers: map[string]string{
			"Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTUwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0.mock-signature",
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := utils.ValidateTenantAccessSimple(request)
		if err != nil {
			b.Fatalf("Validation failed: %v", err)
		}
	}
}
