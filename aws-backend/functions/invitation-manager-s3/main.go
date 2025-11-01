package main

import (
	"log"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/ses"
	sesTypes "github.com/aws/aws-sdk-go-v2/service/ses/types"
	"github.com/google/uuid"

	"recipe-archive/utils"
)

var (
	s3Client  *s3.Client
	sesClient *ses.Client
	baseURL   = os.Getenv("FRONTEND_BASE_URL") // https://d1jcaphz4458q7.cloudfront.net
)

// S3-based invitation system - COST OPTIMIZED
type InvitationToken struct {
	ID        string            `json:"id"`
	Email     string            `json:"email"`
	InvitedBy string            `json:"invitedBy"`
	Token     string            `json:"token"`
	Status    string            `json:"status"` // pending, used, expired
	ExpiresAt int64             `json:"expiresAt"`
	CreatedAt int64             `json:"createdAt"`
	UsedAt    *int64            `json:"usedAt,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

type CreateInvitationRequest struct {
	Email           string            `json:"email"`
	Message         string            `json:"message,omitempty"`
	ExpiryDays      int               `json:"expiryDays,omitempty"` // Default: 7 days
	AllowedFeatures []string          `json:"allowedFeatures,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
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

// S3 Index structures for fast lookups
type ActiveTokensIndex struct {
	Active      []string `json:"active"`
	LastUpdated int64    `json:"lastUpdated"`
}

type EmailIndex struct {
	Email       string `json:"email"`
	TokenID     string `json:"tokenId"`
	Status      string `json:"status"`
	LastUpdated int64  `json:"lastUpdated"`
}

type AdminIndex struct {
	AdminID     string            `json:"adminId"`
	Invitations []AdminIndexEntry `json:"invitations"`
	LastUpdated int64             `json:"lastUpdated"`
}

type AdminIndexEntry struct {
	TokenID   string `json:"tokenId"`
	Email     string `json:"email"`
	Status    string `json:"status"`
	CreatedAt int64  `json:"createdAt"`
}

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(utils.GetAWSRegion()))
	if err != nil {
		panic(fmt.Sprintf("Failed to load AWS config: %v", err))
	}

	s3Client = s3.NewFromConfig(cfg)
	sesClient = ses.NewFromConfig(cfg)

	if baseURL == "" {
		baseURL = "https://d1jcaphz4458q7.cloudfront.net" // fallback
	}

	fmt.Printf("🚀 S3-Based Invitation Manager initialized - COST OPTIMIZED!\n")
	fmt.Printf("📦 Bucket: %s\n", utils.GetS3BucketName())
	fmt.Printf("🌐 Base URL: %s\n", baseURL)
}

func main() {
	lambda.Start(handler)
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("🔧 S3 Invitation Manager - Method: %s, Path: %s\n", request.HTTPMethod, request.Path)

	// Handle CORS preflight requests
	if request.HTTPMethod == "OPTIONS" {
		return utils.NewAPIResponse(http.StatusOK, map[string]string{"message": "CORS preflight"})
	}

	// Validate admin access
	validation, err := utils.ValidateTenantAccessSimple(request)
	if err != nil {
		return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "VALIDATION_ERROR",
				"message":   "Failed to validate request",
				"timestamp": time.Now().UTC(),
			},
		})
	}

	if !validation.Valid {
		return utils.NewAPIResponse(http.StatusUnauthorized, map[string]interface{}{
			"error": map[string]interface{}{
				"code":      "UNAUTHORIZED",
				"message":   "Invalid or expired token",
				"timestamp": time.Now().UTC(),
			},
		})
	}

	adminUserID := validation.UserID
	fmt.Printf("🔧 Admin User ID: %s\n", adminUserID)

	// Route requests
	switch request.HTTPMethod {
	case "POST":
		if strings.HasSuffix(request.Path, "/invitations") {
			return createInvitation(ctx, request, adminUserID)
		}
		return utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "NOT_FOUND",
				"message": "Endpoint not found",
			},
		})

	case "GET":
		if strings.HasSuffix(request.Path, "/invitations") {
			return listInvitations(ctx, adminUserID)
		}
		if strings.Contains(request.Path, "/invitations/") {
			token := strings.TrimPrefix(request.Path, "/admin/invitations/")
			return getInvitation(ctx, token)
		}
		return utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "NOT_FOUND",
				"message": "Endpoint not found",
			},
		})

	case "DELETE":
		if strings.Contains(request.Path, "/invitations/") {
			// Extract token from path like "/v1/admin/invitations/{token}"
			pathParts := strings.Split(request.Path, "/")
			if len(pathParts) >= 4 && pathParts[len(pathParts)-2] == "invitations" {
				token := pathParts[len(pathParts)-1]
				fmt.Printf("🔧 Extracted token from path: %s\n", token)
				return revokeInvitation(ctx, token, adminUserID)
			}
			log.Printf("ERROR: Invalid DELETE path format: %s\n", request.Path)
		}
		return utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "NOT_FOUND",
				"message": "Endpoint not found",
			},
		})

	default:
		return utils.NewAPIResponse(http.StatusMethodNotAllowed, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "METHOD_NOT_ALLOWED",
				"message": "Method not allowed",
			},
		})
	}
}

func createInvitation(ctx context.Context, request events.APIGatewayProxyRequest, adminUserID string) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("🔧 Creating invitation - Admin: %s\n", adminUserID)
	fmt.Printf("DEBUG: Request body: %s\n", request.Body)

	var req CreateInvitationRequest
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		fmt.Printf("ERROR: JSON unmarshaling failed: %v\n", err)
		return utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "INVALID_JSON",
				"message": "Invalid JSON",
			},
		})
	}

	fmt.Printf("DEBUG: Parsed request - Email: %s, ExpiryDays: %d\n", req.Email, req.ExpiryDays)

	// Validate email
	if req.Email == "" {
		fmt.Printf("ERROR: Email is empty\n")
		return utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "VALIDATION_ERROR",
				"message": "Email is required",
			},
		})
	}

	// Set default expiry
	if req.ExpiryDays <= 0 {
		req.ExpiryDays = 7
	}

	// Check if email already has pending invitation
	emailKey := base64.URLEncoding.EncodeToString([]byte(req.Email))
	fmt.Printf("DEBUG: Checking for existing invitation for email: %s (key: %s)\n", req.Email, emailKey)

	if existingEmailIndex, err := getEmailIndex(ctx, emailKey); err == nil && existingEmailIndex != nil {
		fmt.Printf("DEBUG: Found email index for %s, TokenID: %s\n", req.Email, existingEmailIndex.TokenID)
		// An email index exists, now get the full invitation token
		if existingInvitation, err := getInvitationByID(ctx, existingEmailIndex.TokenID); err == nil && existingInvitation != nil {
			currentTime := time.Now().Unix()
			fmt.Printf("DEBUG: Found invitation - Status: %s, ExpiresAt: %d, CurrentTime: %d, Email: %s\n",
				existingInvitation.Status, existingInvitation.ExpiresAt, currentTime, existingInvitation.Email)

			// Delete expired invitations OR non-pending invitations (expired, used, cancelled) OR overwrite pending invitations
			if existingInvitation.ExpiresAt < currentTime || existingInvitation.Status != "pending" {
				fmt.Printf("INFO: Found %s invitation for email %s (ID: %s). Deleting it to allow new invitation.\n",
					existingInvitation.Status, req.Email, existingInvitation.ID)
				if err := deleteExpiredInvitation(ctx, existingInvitation); err != nil {
					fmt.Printf("ERROR: Failed to delete existing invitation: %v\n", err)
					return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "INVITATION_DELETION_FAILED",
							"message": "Failed to delete existing invitation",
						},
					})
				}
				fmt.Printf("INFO: Previous invitation for email %s deleted successfully. Proceeding to create new invitation.\n", req.Email)
				// Continue to create a new invitation
			} else if existingInvitation.Status == "pending" {
				fmt.Printf("INFO: User already has a pending invitation for email: %s (Status: %s). Overwriting with new invitation.\n",
					req.Email, existingInvitation.Status)
				if err := deleteExpiredInvitation(ctx, existingInvitation); err != nil {
					fmt.Printf("ERROR: Failed to delete existing pending invitation: %v\n", err)
					return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "INVITATION_DELETION_FAILED",
							"message": "Failed to overwrite existing pending invitation",
						},
					})
				}
				fmt.Printf("INFO: Previous pending invitation for email %s deleted successfully. Proceeding to create new invitation.\n", req.Email)
				// Continue to create a new invitation
			}
		} else {
			fmt.Printf("DEBUG: Email index exists but invitation not found, cleaning up stale index\n")
			// Clean up stale email index
			emailIndexKey := fmt.Sprintf("invitations/by-email/%s.json", emailKey)
			deleteFromS3(ctx, emailIndexKey)
		}
	} else {
		fmt.Printf("DEBUG: No existing email index found for %s, proceeding with invitation creation\n", req.Email)
	}

	// Generate secure token and ID
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "TOKEN_GENERATION_FAILED",
				"message": "Failed to generate secure token",
			},
		})
	}
	token := hex.EncodeToString(tokenBytes)
	tokenID := uuid.New().String()

	invitation := InvitationToken{
		ID:        tokenID,
		Email:     req.Email,
		InvitedBy: adminUserID,
		Token:     token,
		Status:    "pending",
		ExpiresAt: time.Now().Add(time.Duration(req.ExpiryDays) * 24 * time.Hour).Unix(),
		CreatedAt: time.Now().Unix(),
		Metadata:  req.Metadata,
	}

	fmt.Printf("🔧 Creating invitation: ID=%s, Email=%s, Token=%s\n", tokenID, req.Email, token)

	// Store main invitation record in S3
	if err := putJSONToS3(ctx, fmt.Sprintf("invitations/tokens/%s.json", tokenID), invitation); err != nil {
		log.Printf("ERROR: Failed to store invitation: %v\n", err)
		return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "INVITATION_CREATION_FAILED",
				"message": "Failed to create invitation",
			},
		})
	}

	// Update email index
	emailIndex := EmailIndex{
		Email:       req.Email,
		TokenID:     tokenID,
		Status:      "pending",
		LastUpdated: time.Now().Unix(),
	}
	if err := putJSONToS3(ctx, fmt.Sprintf("invitations/by-email/%s.json", emailKey), emailIndex); err != nil {
		log.Printf("ERROR: Failed to update email index: %v\n", err)
		// Continue - this is not critical
	}

	// Update admin index
	if err := updateAdminIndex(ctx, adminUserID, tokenID, req.Email, "pending"); err != nil {
		log.Printf("ERROR: Failed to update admin index: %v\n", err)
		// Continue - this is not critical
	}

	// Update active tokens index
	if err := updateActiveTokensIndex(ctx, tokenID, "add"); err != nil {
		log.Printf("ERROR: Failed to update active tokens index: %v\n", err)
		// Continue - this is not critical
	}

	// Send invitation email (if SES is configured)
	invitationLink := fmt.Sprintf("%s/auth/register?token=%s", baseURL, token)
	if err := sendInvitationEmail(ctx, req.Email, invitationLink, req.Message); err != nil {
		log.Printf("WARN: Failed to send invitation email: %v\n", err)
		// Don't fail the request - invitation was created successfully
	}

	response := CreateInvitationResponse{
		InvitationID:   tokenID,
		InvitationLink: invitationLink,
		Token:          token,
		ExpiresAt:      invitation.ExpiresAt,
	}

	log.Printf("INFO: Invitation created successfully: %s\n", tokenID)
	return utils.NewAPIResponse(http.StatusCreated, response)
}

func listInvitations(ctx context.Context, adminUserID string) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("🔧 Listing invitations for admin: %s\n", adminUserID)

	// Get admin's invitation index
	adminIndex, err := getAdminIndex(ctx, adminUserID)
	if err != nil {
		log.Printf("ERROR: Failed to get admin index: %v\n", err)
		return utils.NewAPIResponse(http.StatusOK, ListInvitationsResponse{Invitations: []InvitationToken{}, Count: 0})
	}

	// Fetch full invitation details
	invitations := make([]InvitationToken, 0, len(adminIndex.Invitations))
	for _, indexEntry := range adminIndex.Invitations {
		if invitation, err := getInvitationByID(ctx, indexEntry.TokenID); err == nil {
			invitations = append(invitations, *invitation)
		} else {
			log.Printf("WARN: Failed to fetch invitation %s: %v\n", indexEntry.TokenID, err)
		}
	}

	response := ListInvitationsResponse{
		Invitations: invitations,
		Count:       len(invitations),
	}

	log.Printf("INFO: Found %d invitations for admin %s\n", len(invitations), adminUserID)
	return utils.NewAPIResponse(http.StatusOK, response)
}

func getInvitation(ctx context.Context, token string) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("🔧 Getting invitation by token: %s\n", token)

	invitation, err := getInvitationByToken(ctx, token)
	if err != nil {
		log.Printf("ERROR: Failed to get invitation: %v\n", err)
		return utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "NOT_FOUND",
				"message": "Invitation not found",
			},
		})
	}

	// Check if expired
	currentTime := time.Now().Unix()
	if invitation.ExpiresAt < currentTime {
		fmt.Printf("INFO: Invitation with ID %s for email %s is expired. Deleting it.\n", invitation.ID, invitation.Email)
		if err := deleteExpiredInvitation(ctx, invitation); err != nil {
			fmt.Printf("ERROR: Failed to delete expired invitation during get: %v\n", err)
			return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    "INVITATION_DELETION_FAILED",
					"message": "Failed to delete expired invitation",
				},
			})
		}
		fmt.Printf("INFO: Expired invitation with ID %s deleted successfully. Returning 404.\n", invitation.ID)
		return utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "NOT_FOUND",
				"message": "Invitation not found (expired and deleted)",
			},
		})
	}

	log.Printf("INFO: Found invitation: %s (Status: %s)\n", invitation.ID, invitation.Status)
	return utils.NewAPIResponse(http.StatusOK, invitation)
}

func revokeInvitation(ctx context.Context, token, adminUserID string) (events.APIGatewayProxyResponse, error) {
	fmt.Printf("🔧 Deleting invitation with token: %s by admin: %s\n", token, adminUserID)

	// Find invitation by token
	invitation, err := getInvitationByToken(ctx, token)
	if err != nil {
		log.Printf("ERROR: Failed to find invitation: %v\n", err)
		return utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "NOT_FOUND",
				"message": "Invitation not found",
			},
		})
	}

	// Verify admin owns this invitation
	if invitation.InvitedBy != adminUserID {
		return utils.NewAPIResponse(http.StatusForbidden, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "FORBIDDEN",
				"message": "Not authorized to delete this invitation",
			},
		})
	}

	// Delete invitation from S3 completely
	if err := deleteFromS3(ctx, fmt.Sprintf("invitations/tokens/%s.json", invitation.ID)); err != nil {
		log.Printf("ERROR: Failed to delete invitation from S3: %v\n", err)
		return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "DELETION_FAILED",
				"message": "Failed to delete invitation",
			},
		})
	}

	// Remove from active tokens index
	if err := updateActiveTokensIndex(ctx, invitation.ID, "remove"); err != nil {
		log.Printf("WARN: Failed to update active tokens index: %v\n", err)
	}

	// Remove from admin index completely
	if err := removeFromAdminIndex(ctx, adminUserID, invitation.ID); err != nil {
		log.Printf("WARN: Failed to remove from admin index: %v\n", err)
	}

	log.Printf("INFO: Invitation deleted successfully: %s\n", invitation.ID)
	return utils.NewAPIResponse(http.StatusOK, map[string]string{"message": "Invitation deleted successfully"})
}

// S3 Helper Functions

func putJSONToS3(ctx context.Context, key string, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(utils.GetS3BucketName()),
		Key:         aws.String(key),
		Body:        strings.NewReader(string(jsonData)),
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		return fmt.Errorf("failed to put object to S3: %w", err)
	}

	fmt.Printf("📦 Stored to S3: %s\n", key)
	return nil
}

func getJSONFromS3(ctx context.Context, key string, target interface{}) error {
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(utils.GetS3BucketName()),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to get object from S3: %w", err)
	}
	defer result.Body.Close()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	return nil
}

func getInvitationByID(ctx context.Context, tokenID string) (*InvitationToken, error) {
	var invitation InvitationToken
	if err := getJSONFromS3(ctx, fmt.Sprintf("invitations/tokens/%s.json", tokenID), &invitation); err != nil {
		return nil, err
	}
	return &invitation, nil
}

func getInvitationByToken(ctx context.Context, token string) (*InvitationToken, error) {
	// This requires scanning active tokens index (acceptable for low volume)
	activeTokens, err := getActiveTokensIndex(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get active tokens index: %w", err)
	}

	for _, tokenID := range activeTokens.Active {
		if invitation, err := getInvitationByID(ctx, tokenID); err == nil && invitation.Token == token {
			return invitation, nil
		}
	}

	return nil, fmt.Errorf("invitation not found")
}

func getActiveTokensIndex(ctx context.Context) (*ActiveTokensIndex, error) {
	var index ActiveTokensIndex
	if err := getJSONFromS3(ctx, "invitations/tokens/index.json", &index); err != nil {
		// Return empty index if not found
		return &ActiveTokensIndex{Active: []string{}, LastUpdated: time.Now().Unix()},
			nil
	}
	return &index, nil
}

func updateActiveTokensIndex(ctx context.Context, tokenID, action string) error {
	index, err := getActiveTokensIndex(ctx)
	if err != nil {
		return err
	}

	switch action {
	case "add":
		// Add if not already present
		found := false
		for _, id := range index.Active {
			if id == tokenID {
				found = true
				break
			}
		}
		if !found {
			index.Active = append(index.Active, tokenID)
		}
	case "remove":
		// Remove if present
		for i, id := range index.Active {
			if id == tokenID {
				index.Active = append(index.Active[:i], index.Active[i+1:]...)
				break
			}
		}
	}

	index.LastUpdated = time.Now().Unix()
	return putJSONToS3(ctx, "invitations/tokens/index.json", index)
}

func getEmailIndex(ctx context.Context, emailKey string) (*EmailIndex, error) {
	var index EmailIndex
	if err := getJSONFromS3(ctx, fmt.Sprintf("invitations/by-email/%s.json", emailKey), &index); err != nil {
		return nil, err
	}
	return &index, nil
}

func getAdminIndex(ctx context.Context, adminID string) (*AdminIndex, error) {
	var index AdminIndex
	if err := getJSONFromS3(ctx, fmt.Sprintf("invitations/by-admin/%s.json", adminID), &index); err != nil {
		// Return empty index if not found
		return &AdminIndex{
				AdminID:     adminID,
				Invitations: []AdminIndexEntry{},
				LastUpdated: time.Now().Unix(),
			},
			nil
	}
	return &index, nil
}

func updateAdminIndex(ctx context.Context, adminID, tokenID, email, status string) error {
	index, err := getAdminIndex(ctx, adminID)
	if err != nil {
		return err
	}

	// Find existing entry or create new one
	found := false
	for i, inv := range index.Invitations {
		if inv.TokenID == tokenID {
			index.Invitations[i].Status = status
			found = true
			break
		}
	}

	if !found && status == "pending" {
		index.Invitations = append(index.Invitations, AdminIndexEntry{
			TokenID:   tokenID,
			Email:     email,
			Status:    status,
			CreatedAt: time.Now().Unix(),
		})
	}

	index.LastUpdated = time.Now().Unix()
	return putJSONToS3(ctx, fmt.Sprintf("invitations/by-admin/%s.json", adminID), index)
}

func sendInvitationEmail(ctx context.Context, email, invitationLink, customMessage string) error {
	if customMessage == "" {
		customMessage = "You've been invited to join RecipeArchive! Click the link below to create your account."
	}

	subject := "Invitation to RecipeArchive"
	body := customMessage + "\n\n" + invitationLink + "\n\nThis invitation will expire in 7 days. If you have any questions, please reply to this email.\n\nBest regards,\nRecipeArchive Team"

	input := &ses.SendEmailInput{
		Destination: &sesTypes.Destination{
			ToAddresses: []string{email},
		},
		Message: &sesTypes.Message{
			Body: &sesTypes.Body{
				Text: &sesTypes.Content{
					Data: aws.String(body),
				},
			},
			Subject: &sesTypes.Content{
				Data: aws.String(subject),
			},
		},
		Source: aws.String("mattbordenet@hotmail.com"),
	}

	_, err := sesClient.SendEmail(ctx, input)
	return err
}

func deleteFromS3(ctx context.Context, key string) error {

	input := &s3.DeleteObjectInput{
		Bucket: aws.String(utils.GetS3BucketName()),
		Key:    aws.String(key),
	}

	_, err := s3Client.DeleteObject(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to delete object from S3: %w", err)
	}

	fmt.Printf("🗑️ Deleted S3 object: %s\n", key)
	return nil
}

func removeFromAdminIndex(ctx context.Context, adminID, invitationID string) error {
	indexKey := fmt.Sprintf("invitations/by-admin/%s.json", adminID)

	var index AdminIndex
	if err := getJSONFromS3(ctx, indexKey, &index); err != nil {
		return fmt.Errorf("failed to get admin index: %w", err)
	}

	// Remove invitation from index
	for i, inv := range index.Invitations {
		if inv.TokenID == invitationID {
			index.Invitations = append(index.Invitations[:i], index.Invitations[i+1:]...)
			break
		}
	}

	index.LastUpdated = time.Now().Unix()
	return putJSONToS3(ctx, indexKey, index)
}

// deleteExpiredInvitation deletes an invitation record from S3, the email index, and the admin index.
func deleteExpiredInvitation(ctx context.Context, invitation *InvitationToken) error {
	fmt.Printf("INFO: Deleting expired invitation with ID: %s, Email: %s, AdminID: %s\n", invitation.ID, invitation.Email, invitation.InvitedBy)

	// 1. Delete main invitation record from S3
	if err := deleteFromS3(ctx, fmt.Sprintf("invitations/tokens/%s.json", invitation.ID)); err != nil {
		return fmt.Errorf("failed to delete invitation from S3: %w", err)
	}

	// 2. Remove from email index
	emailKey := base64.URLEncoding.EncodeToString([]byte(invitation.Email))
	emailIndexKey := fmt.Sprintf("invitations/by-email/%s.json", emailKey)
	if err := deleteFromS3(ctx, emailIndexKey); err != nil {
		// Log but don't fail, as the main invitation is already deleted.
		log.Printf("WARN: Failed to delete email index for %s: %v\n", invitation.Email, err)
	}

	// 3. Remove from admin index
	if err := removeFromAdminIndex(ctx, invitation.InvitedBy, invitation.ID); err != nil {
		log.Printf("WARN: Failed to remove from admin index for admin %s, invitation %s: %v\n", invitation.InvitedBy, invitation.ID, err)
	}

	// 4. Remove from active tokens index
	if err := updateActiveTokensIndex(ctx, invitation.ID, "remove"); err != nil {
		log.Printf("WARN: Failed to update active tokens index for invitation %s: %v\n", invitation.ID, err)
	}

	fmt.Printf("INFO: Successfully deleted expired invitation with ID: %s\n", invitation.ID)
	return nil
}
