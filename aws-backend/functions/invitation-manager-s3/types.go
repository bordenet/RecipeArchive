package main

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
