package main

import (
	"context"
	"fmt"
	"time"
)

// getActiveTokensIndex retrieves the index of all active invitation tokens
func getActiveTokensIndex(ctx context.Context) (*ActiveTokensIndex, error) {
	var index ActiveTokensIndex
	if err := getJSONFromS3(ctx, "invitations/tokens/index.json", &index); err != nil {
		// Return empty index if not found
		return &ActiveTokensIndex{Active: []string{}, LastUpdated: time.Now().Unix()}, nil
	}
	return &index, nil
}

// updateActiveTokensIndex adds or removes a token from the active tokens index
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

// getEmailIndex retrieves the email index for a specific email
func getEmailIndex(ctx context.Context, emailKey string) (*EmailIndex, error) {
	var index EmailIndex
	if err := getJSONFromS3(ctx, fmt.Sprintf("invitations/by-email/%s.json", emailKey), &index); err != nil {
		return nil, err
	}
	return &index, nil
}

// getAdminIndex retrieves the admin index for a specific admin user
func getAdminIndex(ctx context.Context, adminID string) (*AdminIndex, error) {
	var index AdminIndex
	if err := getJSONFromS3(ctx, fmt.Sprintf("invitations/by-admin/%s.json", adminID), &index); err != nil {
		// Return empty index if not found
		return &AdminIndex{
			AdminID:     adminID,
			Invitations: []AdminIndexEntry{},
			LastUpdated: time.Now().Unix(),
		}, nil
	}
	return &index, nil
}

// updateAdminIndex updates the admin's invitation index
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

// removeFromAdminIndex removes an invitation from the admin's index
func removeFromAdminIndex(ctx context.Context, adminID, invitationID string) error {
	index, err := getAdminIndex(ctx, adminID)
	if err != nil {
		return err
	}

	// Remove the invitation
	for i, inv := range index.Invitations {
		if inv.TokenID == invitationID {
			index.Invitations = append(index.Invitations[:i], index.Invitations[i+1:]...)
			break
		}
	}

	index.LastUpdated = time.Now().Unix()
	return putJSONToS3(ctx, fmt.Sprintf("invitations/by-admin/%s.json", adminID), index)
}
