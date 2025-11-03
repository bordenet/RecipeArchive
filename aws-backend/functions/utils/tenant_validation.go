package utils

import (
	"fmt"
	"regexp"

	"github.com/aws/aws-lambda-go/events"
)

// ValidationResult contains the result of tenant validation
type ValidationResult struct {
	Valid  bool   `json:"valid"`
	UserID string `json:"userId"`
	Error  string `json:"error,omitempty"`
}

// ValidateTenantAccessSimple validates tenant access via JWT claims
// This is the production implementation using Cognito JWT validation only
func ValidateTenantAccessSimple(request events.APIGatewayProxyRequest) (*ValidationResult, error) {
	claims, err := ExtractUserFromJWT(request)
	if err != nil {
		return &ValidationResult{
			Valid: false,
			Error: fmt.Sprintf("JWT validation failed: %v", err),
		}, nil
	}

	userID := claims.Sub
	if userID == "" {
		return &ValidationResult{
			Valid: false,
			Error: "User ID missing from JWT claims",
		}, nil
	}

	if err := validateUserIDFormat(userID); err != nil {
		return &ValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Invalid user ID format: %v", err),
		}, nil
	}

	return &ValidationResult{
		Valid:  true,
		UserID: userID,
	}, nil
}

// validateUserIDFormat ensures user ID follows expected format (security check)
func validateUserIDFormat(userID string) error {
	// Cognito user IDs are UUIDs - validate format
	uuidRegex := regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

	if !uuidRegex.MatchString(userID) {
		return fmt.Errorf("user ID must be a valid UUID format")
	}

	return nil
}
