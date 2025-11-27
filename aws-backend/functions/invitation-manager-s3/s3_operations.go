package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"recipe-archive/utils"
)

// putJSONToS3 stores JSON data in S3
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

	logger.Info("stored to S3", "key", key)
	return nil
}

// getJSONFromS3 retrieves and unmarshals JSON data from S3
func getJSONFromS3(ctx context.Context, key string, target interface{}) error {
	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(utils.GetS3BucketName()),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to get object from S3: %w", err)
	}
	defer func() {
		if closeErr := result.Body.Close(); closeErr != nil {
			logger.Warn("Failed to close S3 response body", "error", closeErr)
		}
	}()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, target); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	return nil
}

// deleteFromS3 deletes an object from S3
func deleteFromS3(ctx context.Context, key string) error {
	input := &s3.DeleteObjectInput{
		Bucket: aws.String(utils.GetS3BucketName()),
		Key:    aws.String(key),
	}

	_, err := s3Client.DeleteObject(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to delete object from S3: %w", err)
	}

	logger.Info("deleted from S3", "key", key)
	return nil
}

// getInvitationByID retrieves an invitation by its ID
func getInvitationByID(ctx context.Context, tokenID string) (*InvitationToken, error) {
	var invitation InvitationToken
	if err := getJSONFromS3(ctx, fmt.Sprintf("invitations/tokens/%s.json", tokenID), &invitation); err != nil {
		return nil, err
	}
	return &invitation, nil
}

// getInvitationByToken retrieves an invitation by its token value
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

// deleteExpiredInvitation removes an expired invitation from S3 and all indexes
func deleteExpiredInvitation(ctx context.Context, invitation *InvitationToken) error {
	logger.Info("deleting expired invitation", "invitationID", invitation.ID, "email", invitation.Email, "adminID", invitation.InvitedBy)

	// 1. Delete main invitation record from S3
	if err := deleteFromS3(ctx, fmt.Sprintf("invitations/tokens/%s.json", invitation.ID)); err != nil {
		return fmt.Errorf("failed to delete invitation from S3: %w", err)
	}

	// 2. Remove from email index
	emailKey := base64.URLEncoding.EncodeToString([]byte(invitation.Email))
	emailIndexKey := fmt.Sprintf("invitations/by-email/%s.json", emailKey)
	if err := deleteFromS3(ctx, emailIndexKey); err != nil {
		// Log but don't fail, as the main invitation is already deleted.
		logger.Warn("failed to delete email index", "email", invitation.Email, "error", err)
	}

	// 3. Remove from admin index
	if err := removeFromAdminIndex(ctx, invitation.InvitedBy, invitation.ID); err != nil {
		logger.Warn("Failed to remove from admin index for admin %s, invitation %s", "error", invitation.InvitedBy, invitation.ID, err)
	}

	// 4. Remove from active tokens index
	if err := updateActiveTokensIndex(ctx, invitation.ID, "remove"); err != nil {
		logger.Warn("failed to update active tokens index", "invitationID", invitation.ID, "error", err)
	}

	logger.Info("successfully deleted expired invitation", "invitationID", invitation.ID)
	return nil
}
