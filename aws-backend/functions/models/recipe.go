package models

import (
	"time"
)

// Recipe represents the core recipe data structure
type Recipe struct {
	// Primary Identifiers
	ID     string `json:"id" dynamodb:"id"`
	UserID string `json:"userId" dynamodb:"userId"`

	// Required Fields (Browser Extension Extraction)
	Title        string        `json:"title" dynamodb:"title"`
	Ingredients  []Ingredient  `json:"ingredients" dynamodb:"ingredients"`
	Instructions []Instruction `json:"instructions" dynamodb:"instructions"`
	SourceURL    string        `json:"sourceUrl" dynamodb:"sourceUrl"`

	// Optional Metadata
	MainPhotoURL     *string `json:"mainPhotoUrl,omitempty" dynamodb:"mainPhotoUrl,omitempty"`
	PrepTimeMinutes  *int    `json:"prepTimeMinutes,omitempty" dynamodb:"prepTimeMinutes,omitempty"`
	CookTimeMinutes  *int    `json:"cookTimeMinutes,omitempty" dynamodb:"cookTimeMinutes,omitempty"`
	TotalTimeMinutes *int    `json:"totalTimeMinutes,omitempty" dynamodb:"totalTimeMinutes,omitempty"`
	Servings         *int    `json:"servings,omitempty" dynamodb:"servings,omitempty"`
	Yield            *string `json:"yield,omitempty" dynamodb:"yield,omitempty"`

	// System Fields
	CreatedAt time.Time `json:"createdAt" dynamodb:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" dynamodb:"updatedAt"`
	IsDeleted bool      `json:"isDeleted" dynamodb:"isDeleted"`
	Version   int       `json:"version" dynamodb:"version"`

	// Archive & Backup
	WebArchiveURL *string `json:"webArchiveUrl,omitempty" dynamodb:"webArchiveUrl,omitempty"`
}

// Ingredient represents a structured ingredient
type Ingredient struct {
	Text       string   `json:"text" dynamodb:"text"`
	Amount     *float64 `json:"amount,omitempty" dynamodb:"amount,omitempty"`
	Unit       *string  `json:"unit,omitempty" dynamodb:"unit,omitempty"`
	Ingredient *string  `json:"ingredient,omitempty" dynamodb:"ingredient,omitempty"`
}

// Instruction represents a cooking step
type Instruction struct {
	StepNumber int    `json:"stepNumber" dynamodb:"stepNumber"`
	Text       string `json:"text" dynamodb:"text"`
}

// CreateRecipeRequest represents the payload for creating a recipe
type CreateRecipeRequest struct {
	Title            string        `json:"title" validate:"required,max=200"`
	Ingredients      []Ingredient  `json:"ingredients" validate:"required,min=1"`
	Instructions     []Instruction `json:"instructions" validate:"required,min=1"`
	SourceURL        string        `json:"sourceUrl" validate:"required,url"`
	MainPhotoURL     *string       `json:"mainPhotoUrl,omitempty" validate:"omitempty,url"`
	PrepTimeMinutes  *int          `json:"prepTimeMinutes,omitempty" validate:"omitempty,min=0"`
	CookTimeMinutes  *int          `json:"cookTimeMinutes,omitempty" validate:"omitempty,min=0"`
	TotalTimeMinutes *int          `json:"totalTimeMinutes,omitempty" validate:"omitempty,min=0"`
	Servings         *int          `json:"servings,omitempty" validate:"omitempty,min=1"`
	Yield            *string       `json:"yield,omitempty" validate:"omitempty,max=100"`
	WebArchiveHTML   *string       `json:"webArchiveHtml,omitempty"`
}

// UpdateRecipeRequest represents the payload for updating a recipe
type UpdateRecipeRequest struct {
	Title            *string        `json:"title,omitempty" validate:"omitempty,max=200"`
	Ingredients      *[]Ingredient  `json:"ingredients,omitempty" validate:"omitempty,min=1"`
	Instructions     *[]Instruction `json:"instructions,omitempty" validate:"omitempty,min=1"`
	SourceURL        *string        `json:"sourceUrl,omitempty" validate:"omitempty,url"`
	MainPhotoURL     *string        `json:"mainPhotoUrl,omitempty" validate:"omitempty,url"`
	PrepTimeMinutes  *int           `json:"prepTimeMinutes,omitempty" validate:"omitempty,min=0"`
	CookTimeMinutes  *int           `json:"cookTimeMinutes,omitempty" validate:"omitempty,min=0"`
	TotalTimeMinutes *int           `json:"totalTimeMinutes,omitempty" validate:"omitempty,min=0"`
	Servings         *int           `json:"servings,omitempty" validate:"omitempty,min=1"`
	Yield            *string        `json:"yield,omitempty" validate:"omitempty,max=100"`
	Version          *int           `json:"version,omitempty" validate:"omitempty,min=1"`
}

// RecipeResponse represents the API response for a single recipe
type RecipeResponse struct {
	Recipe Recipe `json:"recipe"`
}

// RecipesListResponse represents the API response for listing recipes
type RecipesListResponse struct {
	Recipes    []Recipe   `json:"recipes"`
	Pagination Pagination `json:"pagination"`
}

// Pagination represents pagination metadata
type Pagination struct {
	NextCursor *string `json:"nextCursor,omitempty"`
	HasMore    bool    `json:"hasMore"`
	Total      *int    `json:"total,omitempty"`
}

// UserProfile represents user profile data
type UserProfile struct {
	UserID        string    `json:"userId"`
	Email         string    `json:"email"`
	GivenName     *string   `json:"givenName,omitempty"`
	FamilyName    *string   `json:"familyName,omitempty"`
	EmailVerified bool      `json:"emailVerified"`
	CreatedAt     time.Time `json:"createdAt"`
	LastLogin     time.Time `json:"lastLogin"`
}

// UserStats represents user statistics
type UserStats struct {
	TotalRecipes     int       `json:"totalRecipes"`
	RecipesThisMonth int       `json:"recipesThisMonth"`
	StorageUsedMB    float64   `json:"storageUsedMB"`
	LastRecipeAdded  time.Time `json:"lastRecipeAdded"`
}

// UserProfileResponse represents the API response for user profile
type UserProfileResponse struct {
	User  UserProfile `json:"user"`
	Stats UserStats   `json:"stats"`
}

// APIError represents a structured API error
type APIError struct {
	Code      string      `json:"code"`
	Message   string      `json:"message"`
	Details   interface{} `json:"details,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
	RequestID string      `json:"requestId"`
}

// ErrorResponse represents the API error response wrapper
type ErrorResponse struct {
	Error APIError `json:"error"`
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
}

// DiagnosticsResponse represents the diagnostics response
type DiagnosticsResponse struct {
	Status    string                 `json:"status"`
	Services  map[string]string      `json:"services"`
	User      map[string]interface{} `json:"user"`
	Timestamp time.Time              `json:"timestamp"`
}

// PaginationResult represents pagination information
type PaginationResult struct {
	NextCursor string `json:"nextCursor,omitempty"`
	HasMore    bool   `json:"hasMore"`
	Total      int    `json:"total"`
}
