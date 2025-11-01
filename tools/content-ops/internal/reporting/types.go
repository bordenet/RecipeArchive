package reporting

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// ReportEntry represents an entry in our report
type ReportEntry struct {
	Name     string    `json:"name"`
	Domain   string    `json:"domain"`
	Date     time.Time `json:"date"`
	Type     string    `json:"type"`
	Key      string    `json:"key"`
	RecipeID string    `json:"recipeId"`
	UserID   string    `json:"userId"`
}

// Report represents the final JSON output
type Report struct {
	Summary struct {
		Total     int `json:"total"`
		Successes int `json:"successes"`
		Failures  int `json:"failures"`
		Errors    int `json:"errors"`
	} `json:"summary"`
	Entries []ReportEntry `json:"entries"`
}

// Recipe represents a stored recipe
type Recipe struct {
	ID             string          `json:"id"`
	Title          string          `json:"title"`
	SourceURL      string          `json:"sourceUrl"`
	URL            string          `json:"url"`
	CreatedAt      time.Time       `json:"createdAt"`
	UserID         string          `json:"userId"`
	Ingredients    []Ingredient    `json:"ingredients"`
	Instructions   []Instruction   `json:"instructions"`
	CookingMethods []CookingMethod `json:"cookingMethods,omitempty"`
}

// ParseFailure represents a failed recipe extraction
type ParseFailure struct {
	URL            string    `json:"url"`
	AttemptedTitle string    `json:"attemptedTitle"`
	Error          string    `json:"error"`
	Timestamp      time.Time `json:"timestamp"`
}

// Ingredient represents a recipe ingredient
type Ingredient struct {
	Text       string   `json:"text"`
	Amount     *float64 `json:"amount,omitempty"`
	Unit       *string  `json:"unit,omitempty"`
	Ingredient *string  `json:"ingredient,omitempty"`
}

// Instruction represents a cooking step
type Instruction struct {
	StepNumber int    `json:"stepNumber"`
	Text       string `json:"text"`
}

// CookingMethod represents a specific cooking method with its own instructions
type CookingMethod struct {
	Name         string        `json:"name"`
	Instructions []Instruction `json:"instructions"`
	TimeEstimate *string       `json:"timeEstimate,omitempty"`
	Equipment    []string      `json:"equipment,omitempty"`
}

// Tenant represents a user in the system
type Tenant struct {
	UserID       string
	Email        string
	Status       string
	RecipeCount  int
	LastActivity time.Time
}

// Reporter handles S3 scanning and reporting
type Reporter struct {
	s3Client      *s3.Client
	cognitoClient *cognitoidentityprovider.Client
	bucketName    string
	ctx           context.Context
	userID        string // JWT-extracted user ID (UUID)
	userEmail     string // User email from JWT
	accessToken   string // Access token for API requests
}
