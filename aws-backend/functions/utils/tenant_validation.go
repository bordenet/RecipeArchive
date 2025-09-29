package utils

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// TenantValidation provides enhanced security validation for multi-tenant access
type TenantValidation struct {
	dynamoClient *dynamodb.Client
}

// UserProfile represents user profile data stored in DynamoDB
type UserProfile struct {
	UserID      string    `json:"userId"`
	Email       string    `json:"email"`
	Status      string    `json:"status"`      // active, suspended, trial
	AccountType string    `json:"accountType"` // beta, paid, admin
	CreatedAt   time.Time `json:"createdAt"`
	LastLoginAt time.Time `json:"lastLoginAt"`
	Quotas      Quotas    `json:"quotas"`
	Usage       Usage     `json:"usage"`
}

// Quotas represents user resource limits
type Quotas struct {
	MaxRecipes        int `json:"maxRecipes"`
	MaxNormalizations int `json:"maxNormalizations"`
	StorageGB         int `json:"storageGB"`
}

// Usage represents current usage statistics
type Usage struct {
	RecipeCount             int `json:"recipeCount"`
	NormalizationsThisMonth int `json:"normalizationsThisMonth"`
	StorageUsedMB           int `json:"storageUsedMB"`
}

// ValidationResult contains the result of tenant validation
type ValidationResult struct {
	Valid       bool         `json:"valid"`
	UserID      string       `json:"userId"`
	Profile     *UserProfile `json:"profile,omitempty"`
	Error       string       `json:"error,omitempty"`
	Permissions []string     `json:"permissions,omitempty"`
}

// NewTenantValidation creates a new tenant validation instance
func NewTenantValidation() (*TenantValidation, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(GetAWSRegion()))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return &TenantValidation{
		dynamoClient: dynamodb.NewFromConfig(cfg),
	}, nil
}

// ValidateTenantAccess performs comprehensive tenant isolation validation
func (tv *TenantValidation) ValidateTenantAccess(ctx context.Context, request events.APIGatewayProxyRequest, requiredPermission string) (*ValidationResult, error) {
	// Step 1: Extract and validate JWT claims
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

	// Step 2: Validate user ID format (security check against injection)
	if err := validateUserIDFormat(userID); err != nil {
		return &ValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Invalid user ID format: %v", err),
		}, nil
	}

	// Step 3: Load user profile from DynamoDB
	profile, err := tv.getUserProfile(ctx, userID)
	if err != nil {
		return &ValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Failed to load user profile: %v", err),
		}, nil
	}

	if profile == nil {
		return &ValidationResult{
			Valid: false,
			Error: "User profile not found",
		}, nil
	}

	// Step 4: Check user status
	if profile.Status != "active" {
		return &ValidationResult{
			Valid: false,
			Error: fmt.Sprintf("User account is %s", profile.Status),
		}, nil
	}

	// Step 5: Validate email matches JWT claims
	if !strings.EqualFold(profile.Email, claims.Email) {
		return &ValidationResult{
			Valid: false,
			Error: "Email mismatch between JWT and profile",
		}, nil
	}

	// Step 6: Check specific permissions if required
	permissions := tv.getUserPermissions(profile)
	if requiredPermission != "" && !contains(permissions, requiredPermission) {
		return &ValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Missing required permission: %s", requiredPermission),
		}, nil
	}

	// Step 7: Update last login timestamp (async, don't block on failure)
	go func() {
		if updateErr := tv.updateLastLogin(context.Background(), userID); updateErr != nil {
			// Log error but don't fail the request
			LogError(ctx, "Failed to update last login", updateErr, map[string]interface{}{
				"userId": userID,
			})
		}
	}()

	return &ValidationResult{
		Valid:       true,
		UserID:      userID,
		Profile:     profile,
		Permissions: permissions,
	}, nil
}

// ValidateResourceAccess ensures user can only access their own resources
func (tv *TenantValidation) ValidateResourceAccess(ctx context.Context, userID, resourcePath string) error {
	// First check for path traversal attempts - critical security check
	if strings.Contains(resourcePath, "..") || strings.Contains(resourcePath, "//") {
		return fmt.Errorf("invalid resource path: path traversal detected")
	}

	// Ensure resource path contains the user ID (tenant isolation)
	expectedPrefix := fmt.Sprintf("recipes/%s/", userID)

	if !strings.HasPrefix(resourcePath, expectedPrefix) {
		return fmt.Errorf("resource access denied: path '%s' does not belong to user '%s'", resourcePath, userID)
	}

	return nil
}

// EnforceQuota checks if user has exceeded their usage limits
func (tv *TenantValidation) EnforceQuota(ctx context.Context, profile *UserProfile, quotaType string, requested int) error {
	switch quotaType {
	case "recipe_count":
		if profile.Usage.RecipeCount+requested > profile.Quotas.MaxRecipes {
			return fmt.Errorf("recipe quota exceeded: %d/%d (requesting %d more)",
				profile.Usage.RecipeCount, profile.Quotas.MaxRecipes, requested)
		}
	case "normalizations":
		if profile.Usage.NormalizationsThisMonth+requested > profile.Quotas.MaxNormalizations {
			return fmt.Errorf("normalization quota exceeded: %d/%d this month (requesting %d more)",
				profile.Usage.NormalizationsThisMonth, profile.Quotas.MaxNormalizations, requested)
		}
	case "storage_mb":
		currentStorageMB := profile.Usage.StorageUsedMB
		maxStorageMB := profile.Quotas.StorageGB * 1024
		if currentStorageMB+requested > maxStorageMB {
			return fmt.Errorf("storage quota exceeded: %dMB/%dMB (requesting %dMB more)",
				currentStorageMB, maxStorageMB, requested)
		}
	default:
		return fmt.Errorf("unknown quota type: %s", quotaType)
	}

	return nil
}

// IncrementUsage updates usage statistics for a user
func (tv *TenantValidation) IncrementUsage(ctx context.Context, userID string, quotaType string, amount int) error {
	tableName := "UserProfiles"

	var updateExpression string
	var expressionAttributeValues map[string]types.AttributeValue

	switch quotaType {
	case "recipe_count":
		updateExpression = "ADD usage.recipeCount :amount"
		expressionAttributeValues = map[string]types.AttributeValue{
			":amount": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", amount)},
		}
	case "normalizations":
		updateExpression = "ADD usage.normalizationsThisMonth :amount"
		expressionAttributeValues = map[string]types.AttributeValue{
			":amount": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", amount)},
		}
	case "storage_mb":
		updateExpression = "ADD usage.storageUsedMB :amount"
		expressionAttributeValues = map[string]types.AttributeValue{
			":amount": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", amount)},
		}
	default:
		return fmt.Errorf("unknown quota type: %s", quotaType)
	}

	_, err := tv.dynamoClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(tableName),
		Key: map[string]types.AttributeValue{
			"userId": &types.AttributeValueMemberS{Value: userID},
		},
		UpdateExpression:          aws.String(updateExpression),
		ExpressionAttributeValues: expressionAttributeValues,
	})

	if err != nil {
		return fmt.Errorf("failed to update usage for user %s: %w", userID, err)
	}

	return nil
}

// getUserProfile retrieves user profile from DynamoDB
func (tv *TenantValidation) getUserProfile(ctx context.Context, userID string) (*UserProfile, error) {
	tableName := "UserProfiles"

	result, err := tv.dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(tableName),
		Key: map[string]types.AttributeValue{
			"userId": &types.AttributeValueMemberS{Value: userID},
		},
	})

	if err != nil {
		return nil, fmt.Errorf("DynamoDB query failed: %w", err)
	}

	if result.Item == nil {
		return nil, nil // User not found
	}

	// Parse DynamoDB item into UserProfile struct
	// This is a simplified version - in production, use a proper DynamoDB unmarshaler
	profile := &UserProfile{}

	if userIDAttr, ok := result.Item["userId"]; ok {
		if s, ok := userIDAttr.(*types.AttributeValueMemberS); ok {
			profile.UserID = s.Value
		}
	}

	if emailAttr, ok := result.Item["email"]; ok {
		if s, ok := emailAttr.(*types.AttributeValueMemberS); ok {
			profile.Email = s.Value
		}
	}

	if statusAttr, ok := result.Item["status"]; ok {
		if s, ok := statusAttr.(*types.AttributeValueMemberS); ok {
			profile.Status = s.Value
		}
	}

	if accountTypeAttr, ok := result.Item["accountType"]; ok {
		if s, ok := accountTypeAttr.(*types.AttributeValueMemberS); ok {
			profile.AccountType = s.Value
		}
	}

	// Set default quotas if not present
	profile.Quotas = Quotas{
		MaxRecipes:        500,
		MaxNormalizations: 50,
		StorageGB:         1,
	}

	return profile, nil
}

// updateLastLogin updates the user's last login timestamp
func (tv *TenantValidation) updateLastLogin(ctx context.Context, userID string) error {
	tableName := "UserProfiles"
	now := time.Now().Unix()

	_, err := tv.dynamoClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(tableName),
		Key: map[string]types.AttributeValue{
			"userId": &types.AttributeValueMemberS{Value: userID},
		},
		UpdateExpression: aws.String("SET lastLoginAt = :timestamp"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":timestamp": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", now)},
		},
	})

	return err
}

// getUserPermissions determines user permissions based on account type
func (tv *TenantValidation) getUserPermissions(profile *UserProfile) []string {
	switch profile.AccountType {
	case "admin":
		return []string{"read", "write", "delete", "admin", "invite_users"}
	case "paid":
		return []string{"read", "write", "delete"}
	case "beta":
		return []string{"read", "write", "delete"}
	default:
		return []string{"read"}
	}
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

// contains checks if a slice contains a specific string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// ValidateTenantAccessSimple is a simplified version for existing endpoints
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
