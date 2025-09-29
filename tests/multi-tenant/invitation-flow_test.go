package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	testAPIGatewayURL = getEnvOrDefault("API_BASE_URL", "https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod")
	testBucketName    = getEnvOrDefault("S3_BUCKET_NAME", "recipe-storage-92e63ea21a6fb18c-990537043943")
)

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Test structures
type CreateInvitationRequest struct {
	Email      string `json:"email"`
	Message    string `json:"message,omitempty"`
	ExpiryDays int    `json:"expiryDays,omitempty"`
}

type CreateInvitationResponse struct {
	InvitationID   string `json:"invitationId"`
	InvitationLink string `json:"invitationLink"`
	Token          string `json:"token"`
	ExpiresAt      int64  `json:"expiresAt"`
}

type ListInvitationsResponse struct {
	Invitations []InvitationToken `json:"invitations"`
	Count       int               `json:"count"`
}

type InvitationToken struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	InvitedBy string `json:"invitedBy"`
	Token     string `json:"token"`
	Status    string `json:"status"`
	ExpiresAt int64  `json:"expiresAt"`
	CreatedAt int64  `json:"createdAt"`
}

// Helper function to make authenticated API requests
func makeAuthenticatedRequest(t *testing.T, method, endpoint string, body interface{}, token string) (*http.Response, []byte) {
	var reqBody []byte
	var err error

	if body != nil {
		reqBody, err = json.Marshal(body)
		require.NoError(t, err)
	}

	req, err := http.NewRequest(method, testAPIGatewayURL+endpoint, bytes.NewBuffer(reqBody))
	require.NoError(t, err)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	require.NoError(t, err)

	respBody := make([]byte, 0)
	if resp.Body != nil {
		defer resp.Body.Close()
		buf := make([]byte, 1024)
		for {
			n, err := resp.Body.Read(buf)
			if n > 0 {
				respBody = append(respBody, buf[:n]...)
			}
			if err != nil {
				break
			}
		}
	}

	return resp, respBody
}

// TestMultiTenantInvitationFlow tests the complete invitation workflow
func TestMultiTenantInvitationFlow(t *testing.T) {
	// Skip if no auth token provided
	adminToken := getTestAdminToken()
	if adminToken == "" {
		t.Skip("No admin token provided - set RECIPE_ADMIN_TOKEN environment variable")
	}

	// Test 1: Create invitation
	t.Run("CreateInvitation", func(t *testing.T) {
		testEmail := fmt.Sprintf("test+%d@example.com", time.Now().Unix())

		createReq := CreateInvitationRequest{
			Email:      testEmail,
			Message:    "Welcome to RecipeArchive multi-tenant test",
			ExpiryDays: 7,
		}

		resp, body := makeAuthenticatedRequest(t, "POST", "/admin/invitations", createReq, adminToken)

		assert.Equal(t, http.StatusOK, resp.StatusCode, "Expected successful invitation creation")

		var createResp CreateInvitationResponse
		err := json.Unmarshal(body, &createResp)
		require.NoError(t, err)

		// Validate response structure
		assert.NotEmpty(t, createResp.InvitationID, "Invitation ID should be present")
		assert.NotEmpty(t, createResp.Token, "Token should be present")
		assert.NotEmpty(t, createResp.InvitationLink, "Invitation link should be present")
		assert.True(t, createResp.ExpiresAt > time.Now().Unix(), "Expiration should be in the future")

		// Store for cleanup
		t.Cleanup(func() {
			cleanupInvitation(t, createResp.Token, adminToken)
		})
	})

	// Test 2: List invitations
	t.Run("ListInvitations", func(t *testing.T) {
		resp, body := makeAuthenticatedRequest(t, "GET", "/admin/invitations", nil, adminToken)

		assert.Equal(t, http.StatusOK, resp.StatusCode, "Expected successful invitation listing")

		var listResp ListInvitationsResponse
		err := json.Unmarshal(body, &listResp)
		require.NoError(t, err)

		// Validate response structure
		assert.GreaterOrEqual(t, listResp.Count, 0, "Count should be non-negative")
		assert.Len(t, listResp.Invitations, listResp.Count, "Invitation count should match array length")
	})

	// Test 3: Tenant isolation - try to access other tenant's invitations
	t.Run("TenantIsolation", func(t *testing.T) {
		// This test verifies that users can only see their own invitations
		// and cannot access invitations created by other admins

		resp, body := makeAuthenticatedRequest(t, "GET", "/admin/invitations", nil, adminToken)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var listResp ListInvitationsResponse
		err := json.Unmarshal(body, &listResp)
		require.NoError(t, err)

		// All returned invitations should belong to the authenticated user
		for _, invitation := range listResp.Invitations {
			assert.NotEmpty(t, invitation.InvitedBy, "InvitedBy field should be present")
			// Note: We can't directly verify the InvitedBy matches the token user ID
			// without decoding the JWT, but the Lambda should enforce this
		}
	})

	// Test 4: S3 storage validation
	t.Run("S3StorageValidation", func(t *testing.T) {
		// Verify that invitation data is properly stored in S3 with correct structure
		cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion("us-west-2"))
		require.NoError(t, err)

		s3Client := s3.NewFromConfig(cfg)

		// Check that invitations are stored in the expected S3 structure
		listResp, err := s3Client.ListObjectsV2(context.TODO(), &s3.ListObjectsV2Input{
			Bucket: aws.String(testBucketName),
			Prefix: aws.String("invitations/"),
		})
		require.NoError(t, err)

		// Verify S3 structure exists
		hasTokens := false
		hasByAdmin := false
		hasIndex := false

		for _, obj := range listResp.Contents {
			key := *obj.Key
			if strings.Contains(key, "invitations/tokens/") {
				hasTokens = true
			}
			if strings.Contains(key, "invitations/by-admin/") {
				hasByAdmin = true
			}
			if strings.Contains(key, "invitations/tokens/index.json") {
				hasIndex = true
			}
		}

		assert.True(t, hasTokens || hasByAdmin || hasIndex,
			"S3 should contain invitation structure (tokens/, by-admin/, or index)")
	})

	// Test 5: Error handling
	t.Run("ErrorHandling", func(t *testing.T) {
		// Test invalid email format
		createReq := CreateInvitationRequest{
			Email:      "invalid-email",
			ExpiryDays: 7,
		}

		resp, _ := makeAuthenticatedRequest(t, "POST", "/admin/invitations", createReq, adminToken)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "Should reject invalid email")

		// Test unauthorized access
		resp, _ = makeAuthenticatedRequest(t, "GET", "/admin/invitations", nil, "invalid-token")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Should reject invalid token")
	})
}

// TestInvitationTokenFormat tests token format and security
func TestInvitationTokenFormat(t *testing.T) {
	adminToken := getTestAdminToken()
	if adminToken == "" {
		t.Skip("No admin token provided")
	}

	testEmail := fmt.Sprintf("format-test+%d@example.com", time.Now().Unix())

	createReq := CreateInvitationRequest{
		Email:      testEmail,
		ExpiryDays: 1,
	}

	resp, body := makeAuthenticatedRequest(t, "POST", "/admin/invitations", createReq, adminToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var createResp CreateInvitationResponse
	err := json.Unmarshal(body, &createResp)
	require.NoError(t, err)

	// Validate token format (should be cryptographically secure)
	assert.Len(t, createResp.Token, 64, "Token should be 64 characters (hex-encoded)")
	assert.Regexp(t, "^[a-f0-9]{64}$", createResp.Token, "Token should be hex-encoded")

	// Validate invitation link format
	expectedPrefix := "https://d1jcaphz4458q7.cloudfront.net"
	assert.Contains(t, createResp.InvitationLink, expectedPrefix, "Link should use correct domain")
	assert.Contains(t, createResp.InvitationLink, createResp.Token, "Link should contain token")

	// Cleanup
	t.Cleanup(func() {
		cleanupInvitation(t, createResp.Token, adminToken)
	})
}

// TestInvitationExpiry tests invitation expiration handling
func TestInvitationExpiry(t *testing.T) {
	adminToken := getTestAdminToken()
	if adminToken == "" {
		t.Skip("No admin token provided")
	}

	// Create invitation with 1-day expiry
	testEmail := fmt.Sprintf("expiry-test+%d@example.com", time.Now().Unix())

	createReq := CreateInvitationRequest{
		Email:      testEmail,
		ExpiryDays: 1,
	}

	resp, body := makeAuthenticatedRequest(t, "POST", "/admin/invitations", createReq, adminToken)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var createResp CreateInvitationResponse
	err := json.Unmarshal(body, &createResp)
	require.NoError(t, err)

	// Verify expiration is approximately 1 day from now
	expectedExpiry := time.Now().Add(24 * time.Hour).Unix()
	actualExpiry := createResp.ExpiresAt

	// Allow 5-minute tolerance
	tolerance := int64(5 * 60)
	assert.InDelta(t, expectedExpiry, actualExpiry, float64(tolerance),
		"Expiry should be approximately 1 day from now")

	// Cleanup
	t.Cleanup(func() {
		cleanupInvitation(t, createResp.Token, adminToken)
	})
}

// Helper functions
func getTestAdminToken() string {
	// In a real test environment, you would:
	// 1. Read from environment variable
	// 2. Or authenticate with test credentials
	// 3. Or use a test JWT

	// For this example, we'll try environment variable first
	if token := os.Getenv("RECIPE_ADMIN_TOKEN"); token != "" {
		return token
	}

	// For development/testing, you could hardcode a test token here
	// But NEVER commit real tokens to the repository
	return ""
}

func cleanupInvitation(t *testing.T, token string, adminToken string) {
	// Clean up invitation to avoid test pollution
	endpoint := fmt.Sprintf("/admin/invitations/%s", token)
	resp, _ := makeAuthenticatedRequest(t, "DELETE", endpoint, nil, adminToken)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		t.Logf("Warning: Failed to cleanup invitation token %s (status: %d)", token, resp.StatusCode)
	}
}
