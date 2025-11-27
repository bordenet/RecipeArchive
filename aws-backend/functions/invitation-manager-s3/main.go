package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/google/uuid"

	"recipe-archive/utils"
)

func main() {
	lambda.Start(handler)
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if err := initAWSClients(ctx); err != nil {
		logger.Error("failed to initialize AWS clients", "error", err)
		return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "INITIALIZATION_ERROR",
				"message": "Failed to initialize AWS services",
			},
		})
	}

	logger.Info("S3 Invitation Manager invoked", "method", request.HTTPMethod, "path", request.Path)

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
	logger.Info("Admin User ID", "value", adminUserID)

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
				logger.Info("Extracted token from path", "value", token)
				return revokeInvitation(ctx, token, adminUserID)
			}
			logger.Error("invalid DELETE path format", "path", request.Path)
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
	logger.Info("Creating invitation - Admin", "value", adminUserID)
	logger.Debug("Request body", "value", request.Body)

	var req CreateInvitationRequest
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		logger.Error("JSON unmarshaling failed", "error", err)
		return utils.NewAPIResponse(http.StatusBadRequest, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "INVALID_JSON",
				"message": "Invalid JSON",
			},
		})
	}

	logger.Debug("Parsed request - Email", "Parsed request - EmailVal", req.Email, "ExpiryDays", req.ExpiryDays)

	// Validate email
	if req.Email == "" {
		logger.Error("Email is empty")
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
	logger.Debug("Checking for existing invitation for email: %s", "email", req.Email, "key", emailKey)

	if existingEmailIndex, err := getEmailIndex(ctx, emailKey); err == nil && existingEmailIndex != nil {
		logger.Debug("found email index", "email", req.Email, "tokenID", existingEmailIndex.TokenID)
		// An email index exists, now get the full invitation token
		if existingInvitation, err := getInvitationByID(ctx, existingEmailIndex.TokenID); err == nil && existingInvitation != nil {
			currentTime := time.Now().Unix()
			logger.Debug("found invitation", "status", existingInvitation.Status, "expiresAt", existingInvitation.ExpiresAt, "currentTime", currentTime, "email", existingInvitation.Email)

			// Delete expired invitations OR non-pending invitations (expired, used, cancelled) OR overwrite pending invitations
			if existingInvitation.ExpiresAt < currentTime || existingInvitation.Status != "pending" {
				logger.Info("Found %s invitation for email - deleting to allow new invitation", "status", existingInvitation.Status, "email", req.Email, "ID", existingInvitation.ID)
				if err := deleteExpiredInvitation(ctx, existingInvitation); err != nil {
					logger.Error("Failed to delete existing invitation", "error", err)
					return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "INVITATION_DELETION_FAILED",
							"message": "Failed to delete existing invitation",
						},
					})
				}
				logger.Info("Previous invitation for email deleted successfully", "email", req.Email)
				// Continue to create a new invitation
			} else if existingInvitation.Status == "pending" {
				logger.Info("User already has a pending invitation for email - overwriting", "email", req.Email, "status", existingInvitation.Status)
				if err := deleteExpiredInvitation(ctx, existingInvitation); err != nil {
					logger.Error("Failed to delete existing pending invitation", "error", err)
					return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "INVITATION_DELETION_FAILED",
							"message": "Failed to overwrite existing pending invitation",
						},
					})
				}
				logger.Info("Previous pending invitation for email deleted successfully", "email", req.Email)
				// Continue to create a new invitation
			}
		} else {
			logger.Debug("Email index exists but invitation not found, cleaning up stale index")
			// Clean up stale email index
			emailIndexKey := fmt.Sprintf("invitations/by-email/%s.json", emailKey)
			if err := deleteFromS3(ctx, emailIndexKey); err != nil {
				logger.Warn("Failed to clean up stale email index", "error", err)
			}
		}
	} else {
		logger.Debug("no existing email index found", "email", req.Email)
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

	logger.Info("Creating invitation", "ID", tokenID, "email", req.Email, "token", token)

	// Store main invitation record in S3
	if err := putJSONToS3(ctx, fmt.Sprintf("invitations/tokens/%s.json", tokenID), invitation); err != nil {
		logger.Error("Failed to store invitation", "error", err)
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
		logger.Error("Failed to update email index", "error", err)
		// Continue - this is not critical
	}

	// Update admin index
	if err := updateAdminIndex(ctx, adminUserID, tokenID, req.Email, "pending"); err != nil {
		logger.Error("Failed to update admin index", "error", err)
		// Continue - this is not critical
	}

	// Update active tokens index
	if err := updateActiveTokensIndex(ctx, tokenID, "add"); err != nil {
		logger.Error("Failed to update active tokens index", "error", err)
		// Continue - this is not critical
	}

	// Send invitation email (if SES is configured)
	invitationLink := fmt.Sprintf("%s/auth/register?token=%s", baseURL, token)
	if err := sendInvitationEmail(ctx, req.Email, invitationLink, req.Message); err != nil {
		logger.Warn("Failed to send invitation email", "error", err)
		// Don't fail the request - invitation was created successfully
	}

	response := CreateInvitationResponse{
		InvitationID:   tokenID,
		InvitationLink: invitationLink,
		Token:          token,
		ExpiresAt:      invitation.ExpiresAt,
	}

	logger.Info("Invitation created successfully", "value", tokenID)
	return utils.NewAPIResponse(http.StatusCreated, response)
}

func listInvitations(ctx context.Context, adminUserID string) (events.APIGatewayProxyResponse, error) {
	logger.Info("Listing invitations for admin", "value", adminUserID)

	// Get admin's invitation index
	adminIndex, err := getAdminIndex(ctx, adminUserID)
	if err != nil {
		logger.Error("Failed to get admin index", "error", err)
		return utils.NewAPIResponse(http.StatusOK, ListInvitationsResponse{Invitations: []InvitationToken{}, Count: 0})
	}

	// Fetch full invitation details
	invitations := make([]InvitationToken, 0, len(adminIndex.Invitations))
	for _, indexEntry := range adminIndex.Invitations {
		if invitation, err := getInvitationByID(ctx, indexEntry.TokenID); err == nil {
			invitations = append(invitations, *invitation)
		} else {
			logger.Warn("failed to fetch invitation", "tokenID", indexEntry.TokenID, "error", err)
		}
	}

	response := ListInvitationsResponse{
		Invitations: invitations,
		Count:       len(invitations),
	}

	logger.Info("found invitations", "count", len(invitations), "adminUserID", adminUserID)
	return utils.NewAPIResponse(http.StatusOK, response)
}

func getInvitation(ctx context.Context, token string) (events.APIGatewayProxyResponse, error) {
	logger.Info("Getting invitation by token", "value", token)

	invitation, err := getInvitationByToken(ctx, token)
	if err != nil {
		logger.Error("Failed to get invitation", "error", err)
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
		logger.Info("invitation expired - deleting", "invitationID", invitation.ID, "email", invitation.Email)
		if err := deleteExpiredInvitation(ctx, invitation); err != nil {
			logger.Error("Failed to delete expired invitation during get", "error", err)
			return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
				"error": map[string]interface{}{
					"code":    "INVITATION_DELETION_FAILED",
					"message": "Failed to delete expired invitation",
				},
			})
		}
		logger.Info("expired invitation deleted successfully", "invitationID", invitation.ID)
		return utils.NewAPIResponse(http.StatusNotFound, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "NOT_FOUND",
				"message": "Invitation not found (expired and deleted)",
			},
		})
	}

	logger.Info("found invitation", "invitationID", invitation.ID, "status", invitation.Status)
	return utils.NewAPIResponse(http.StatusOK, invitation)
}

func revokeInvitation(ctx context.Context, token, adminUserID string) (events.APIGatewayProxyResponse, error) {
	logger.Info("deleting invitation with token", "token", token, "adminUserID", adminUserID)

	// Find invitation by token
	invitation, err := getInvitationByToken(ctx, token)
	if err != nil {
		logger.Error("Failed to find invitation", "error", err)
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
		logger.Error("Failed to delete invitation from S3", "error", err)
		return utils.NewAPIResponse(http.StatusInternalServerError, map[string]interface{}{
			"error": map[string]interface{}{
				"code":    "DELETION_FAILED",
				"message": "Failed to delete invitation",
			},
		})
	}

	// Remove from active tokens index
	if err := updateActiveTokensIndex(ctx, invitation.ID, "remove"); err != nil {
		logger.Warn("Failed to update active tokens index", "error", err)
	}

	// Remove from admin index completely
	if err := removeFromAdminIndex(ctx, adminUserID, invitation.ID); err != nil {
		logger.Warn("Failed to remove from admin index", "error", err)
	}

	logger.Info("Invitation deleted successfully", "value", invitation.ID)
	return utils.NewAPIResponse(http.StatusOK, map[string]string{"message": "Invitation deleted successfully"})
}

// S3 Helper Functions
