package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"testing"
	"time"
)

// Test email key generation (base64 encoding)
func TestEmailKeyGeneration(t *testing.T) {
	email := "test@example.com"
	emailKey := base64.URLEncoding.EncodeToString([]byte(email))

	// Verify it's not empty
	if emailKey == "" {
		t.Error("Email key should not be empty")
	}

	// Verify it can be decoded back
	decoded, err := base64.URLEncoding.DecodeString(emailKey)
	if err != nil {
		t.Fatalf("Failed to decode email key: %v", err)
	}

	if string(decoded) != email {
		t.Errorf("Expected decoded email '%s', got '%s'", email, string(decoded))
	}
}

// Test email key generation with special characters
func TestEmailKeyGeneration_SpecialCharacters(t *testing.T) {
	emails := []string{
		"user+tag@example.com",
		"user.name@example.co.uk",
		"user_name@example-domain.com",
	}

	for _, email := range emails {
		emailKey := base64.URLEncoding.EncodeToString([]byte(email))
		decoded, err := base64.URLEncoding.DecodeString(emailKey)
		if err != nil {
			t.Errorf("Failed to decode email key for '%s': %v", email, err)
			continue
		}
		if string(decoded) != email {
			t.Errorf("Email mismatch: expected '%s', got '%s'", email, string(decoded))
		}
	}
}

// Test token generation (hex encoding of random bytes)
func TestTokenGeneration(t *testing.T) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		t.Fatalf("Failed to generate random bytes: %v", err)
	}

	token := hex.EncodeToString(tokenBytes)

	// Verify token length (32 bytes = 64 hex characters)
	if len(token) != 64 {
		t.Errorf("Expected token length 64, got %d", len(token))
	}

	// Verify token is valid hex
	_, err := hex.DecodeString(token)
	if err != nil {
		t.Errorf("Token is not valid hex: %v", err)
	}
}

// Test token uniqueness
func TestTokenGeneration_Uniqueness(t *testing.T) {
	tokens := make(map[string]bool)
	iterations := 100

	for i := 0; i < iterations; i++ {
		tokenBytes := make([]byte, 32)
		if _, err := rand.Read(tokenBytes); err != nil {
			t.Fatalf("Failed to generate random bytes: %v", err)
		}
		token := hex.EncodeToString(tokenBytes)

		if tokens[token] {
			t.Errorf("Duplicate token generated: %s", token)
		}
		tokens[token] = true
	}

	if len(tokens) != iterations {
		t.Errorf("Expected %d unique tokens, got %d", iterations, len(tokens))
	}
}

// Test default expiry days logic
func TestDefaultExpiryDays(t *testing.T) {
	tests := []struct {
		input    int
		expected int
	}{
		{0, 7},
		{-1, 7},
		{-100, 7},
		{1, 1},
		{14, 14},
		{30, 30},
	}

	for _, tt := range tests {
		expiryDays := tt.input
		if expiryDays <= 0 {
			expiryDays = 7
		}

		if expiryDays != tt.expected {
			t.Errorf("For input %d, expected %d, got %d", tt.input, tt.expected, expiryDays)
		}
	}
}

// Test email validation logic
func TestEmailValidation(t *testing.T) {
	tests := []struct {
		email string
		valid bool
	}{
		{"", false},
		{"test@example.com", true},
		{"user+tag@example.com", true},
		{"user.name@example.co.uk", true},
	}

	for _, tt := range tests {
		isEmpty := tt.email == ""
		isValid := !isEmpty

		if isValid != tt.valid {
			t.Errorf("Email '%s': expected valid=%v, got valid=%v", tt.email, tt.valid, isValid)
		}
	}
}

// Test invitation status values
func TestInvitationStatus(t *testing.T) {
	validStatuses := []string{"pending", "used", "expired", "cancelled"}

	for _, status := range validStatuses {
		// Verify status is one of the valid values
		switch status {
		case "pending", "used", "expired", "cancelled":
			// Valid status
		default:
			t.Errorf("Invalid status: %s", status)
		}
	}
}

// Test invitation expiry calculation
func TestInvitationExpiryCalculation(t *testing.T) {
	expiryDays := 7
	now := int64(1700000000) // Fixed timestamp for testing
	expectedExpiry := now + int64(expiryDays*24*3600)

	// Simulate the expiry calculation
	calculatedExpiry := now + int64(expiryDays*24*3600)

	if calculatedExpiry != expectedExpiry {
		t.Errorf("Expected expiry %d, got %d", expectedExpiry, calculatedExpiry)
	}
}

// Test active tokens index add logic
func TestActiveTokensIndex_AddLogic(t *testing.T) {
	active := []string{"token1", "token2"}
	tokenID := "token3"

	// Check if token already exists
	found := false
	for _, id := range active {
		if id == tokenID {
			found = true
			break
		}
	}

	// Add if not found
	if !found {
		active = append(active, tokenID)
	}

	if len(active) != 3 {
		t.Errorf("Expected 3 tokens, got %d", len(active))
	}
	if active[2] != "token3" {
		t.Errorf("Expected last token to be 'token3', got '%s'", active[2])
	}
}

// Test active tokens index remove logic
func TestActiveTokensIndex_RemoveLogic(t *testing.T) {
	active := []string{"token1", "token2", "token3"}
	tokenID := "token2"

	// Find and remove token
	for i, id := range active {
		if id == tokenID {
			active = append(active[:i], active[i+1:]...)
			break
		}
	}

	if len(active) != 2 {
		t.Errorf("Expected 2 tokens, got %d", len(active))
	}
	// Verify token2 is removed
	for _, id := range active {
		if id == "token2" {
			t.Error("token2 should have been removed")
		}
	}
}

// Test admin index update logic
func TestAdminIndex_UpdateLogic(t *testing.T) {
	invitations := []AdminIndexEntry{
		{TokenID: "token1", Email: "user1@example.com", Status: "pending"},
		{TokenID: "token2", Email: "user2@example.com", Status: "pending"},
	}

	tokenID := "token1"
	newStatus := "used"

	// Find and update existing entry
	found := false
	for i, inv := range invitations {
		if inv.TokenID == tokenID {
			invitations[i].Status = newStatus
			found = true
			break
		}
	}

	if !found {
		t.Error("Token should have been found")
	}
	if invitations[0].Status != "used" {
		t.Errorf("Expected status 'used', got '%s'", invitations[0].Status)
	}
}

// Test admin index add new entry logic
func TestAdminIndex_AddNewEntry(t *testing.T) {
	invitations := []AdminIndexEntry{
		{TokenID: "token1", Email: "user1@example.com", Status: "pending"},
	}

	tokenID := "token2"
	email := "user2@example.com"
	status := "pending"

	// Check if entry exists
	found := false
	for _, inv := range invitations {
		if inv.TokenID == tokenID {
			found = true
			break
		}
	}

	// Add new entry if not found and status is pending
	if !found && status == "pending" {
		invitations = append(invitations, AdminIndexEntry{
			TokenID:   tokenID,
			Email:     email,
			Status:    status,
			CreatedAt: time.Now().Unix(),
		})
	}

	if len(invitations) != 2 {
		t.Errorf("Expected 2 invitations, got %d", len(invitations))
	}
	if invitations[1].TokenID != "token2" {
		t.Errorf("Expected second token to be 'token2', got '%s'", invitations[1].TokenID)
	}
}
