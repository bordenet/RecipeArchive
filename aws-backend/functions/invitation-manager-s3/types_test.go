package main

import (
	"encoding/json"
	"testing"
	"time"
)

// Test InvitationToken JSON marshaling
func TestInvitationToken_JSONMarshaling(t *testing.T) {
	now := time.Now().Unix()
	usedAt := now + 3600

	token := InvitationToken{
		ID:        "test-id-123",
		Email:     "test@example.com",
		InvitedBy: "admin-456",
		Token:     "abc123def456",
		Status:    "pending",
		ExpiresAt: now + 86400,
		CreatedAt: now,
		UsedAt:    &usedAt,
		Metadata: map[string]string{
			"source": "web",
			"role":   "user",
		},
	}

	// Marshal to JSON
	data, err := json.Marshal(token)
	if err != nil {
		t.Fatalf("Failed to marshal InvitationToken: %v", err)
	}

	// Unmarshal back
	var decoded InvitationToken
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal InvitationToken: %v", err)
	}

	// Verify fields
	if decoded.ID != token.ID {
		t.Errorf("Expected ID %s, got %s", token.ID, decoded.ID)
	}
	if decoded.Email != token.Email {
		t.Errorf("Expected Email %s, got %s", token.Email, decoded.Email)
	}
	if decoded.Status != token.Status {
		t.Errorf("Expected Status %s, got %s", token.Status, decoded.Status)
	}
	if decoded.UsedAt == nil || *decoded.UsedAt != usedAt {
		t.Errorf("Expected UsedAt %d, got %v", usedAt, decoded.UsedAt)
	}
}

// Test InvitationToken with nil UsedAt
func TestInvitationToken_NilUsedAt(t *testing.T) {
	token := InvitationToken{
		ID:        "test-id",
		Email:     "test@example.com",
		InvitedBy: "admin",
		Token:     "token123",
		Status:    "pending",
		ExpiresAt: time.Now().Unix() + 86400,
		CreatedAt: time.Now().Unix(),
		UsedAt:    nil,
	}

	data, err := json.Marshal(token)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var decoded InvitationToken
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if decoded.UsedAt != nil {
		t.Errorf("Expected UsedAt to be nil, got %v", decoded.UsedAt)
	}
}

// Test CreateInvitationRequest JSON unmarshaling
func TestCreateInvitationRequest_JSONUnmarshaling(t *testing.T) {
	jsonStr := `{
		"email": "newuser@example.com",
		"message": "Welcome to our platform!",
		"expiryDays": 14,
		"allowedFeatures": ["feature1", "feature2"],
		"metadata": {"source": "admin-panel"}
	}`

	var req CreateInvitationRequest
	if err := json.Unmarshal([]byte(jsonStr), &req); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if req.Email != "newuser@example.com" {
		t.Errorf("Expected email 'newuser@example.com', got '%s'", req.Email)
	}
	if req.Message != "Welcome to our platform!" {
		t.Errorf("Expected message 'Welcome to our platform!', got '%s'", req.Message)
	}
	if req.ExpiryDays != 14 {
		t.Errorf("Expected expiryDays 14, got %d", req.ExpiryDays)
	}
	if len(req.AllowedFeatures) != 2 {
		t.Errorf("Expected 2 allowed features, got %d", len(req.AllowedFeatures))
	}
	if req.Metadata["source"] != "admin-panel" {
		t.Errorf("Expected metadata source 'admin-panel', got '%s'", req.Metadata["source"])
	}
}

// Test CreateInvitationRequest with minimal fields
func TestCreateInvitationRequest_MinimalFields(t *testing.T) {
	jsonStr := `{"email": "user@example.com"}`

	var req CreateInvitationRequest
	if err := json.Unmarshal([]byte(jsonStr), &req); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if req.Email != "user@example.com" {
		t.Errorf("Expected email 'user@example.com', got '%s'", req.Email)
	}
	if req.Message != "" {
		t.Errorf("Expected empty message, got '%s'", req.Message)
	}
	if req.ExpiryDays != 0 {
		t.Errorf("Expected expiryDays 0, got %d", req.ExpiryDays)
	}
}

// Test ActiveTokensIndex JSON marshaling
func TestActiveTokensIndex_JSONMarshaling(t *testing.T) {
	index := ActiveTokensIndex{
		Active:      []string{"token1", "token2", "token3"},
		LastUpdated: time.Now().Unix(),
	}

	data, err := json.Marshal(index)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var decoded ActiveTokensIndex
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if len(decoded.Active) != 3 {
		t.Errorf("Expected 3 active tokens, got %d", len(decoded.Active))
	}
}

