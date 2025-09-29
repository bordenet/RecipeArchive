package main

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// SQS Message format for recipe normalization
type NormalizationMessage struct {
	RecipeID string `json:"recipeId"`
	UserID   string `json:"userId"`
	Action   string `json:"action"`
}

// FlexInt handles both string and int types for flexible JSON unmarshaling
type FlexInt struct {
	Value *int
}

func (f *FlexInt) UnmarshalJSON(data []byte) error {
	// Try parsing as int first
	var intVal int
	if err := json.Unmarshal(data, &intVal); err == nil {
		f.Value = &intVal
		return nil
	}

	// Try parsing as string
	var strVal string
	if err := json.Unmarshal(data, &strVal); err == nil {
		if strVal == "" {
			f.Value = nil
			return nil
		}
		if parsed, err := strconv.Atoi(strVal); err == nil {
			f.Value = &parsed
			return nil
		}
	}

	f.Value = nil
	return nil
}

func (f FlexInt) String() string {
	if f.Value == nil {
		return ""
	}
	return fmt.Sprintf("%d", *f.Value)
}

func (f FlexInt) MarshalJSON() ([]byte, error) {
	if f.Value == nil {
		return json.Marshal(nil)
	}
	return json.Marshal(*f.Value)
}

// Simplified recipe structure for normalization
type Recipe struct {
	ID                   string          `json:"id"`
	UserID               string          `json:"userId"`
	Title                string          `json:"title"`
	Ingredients          []Ingredient    `json:"ingredients"`
	Instructions         []Instruction   `json:"instructions"`             // Shared/prep instructions
	CookingMethodOptions []CookingMethod `json:"cookingMethods,omitempty"` // Multiple method options
	SourceURL            string          `json:"sourceUrl"`
	MainPhotoURL         string          `json:"mainPhotoUrl,omitempty"`
	Servings             FlexInt         `json:"servings,omitempty"`
	TotalTime            FlexInt         `json:"totalTimeMinutes,omitempty"`
	PrepTimeMinutes      FlexInt         `json:"prepTimeMinutes,omitempty"`
	CookTimeMinutes      FlexInt         `json:"cookTimeMinutes,omitempty"`
	Tags                 []string        `json:"tags,omitempty"`
	SearchMetadata       *SearchMetadata `json:"searchMetadata,omitempty"`
	CreatedAt            string          `json:"createdAt"`
	UpdatedAt            string          `json:"updatedAt"`
	IsDeleted            bool            `json:"isDeleted"`
	Version              int             `json:"version"`
}

// SearchMetadata contains OpenAI-generated search optimization fields
type SearchMetadata struct {
	SemanticTags       []string `json:"semanticTags"`       // ["italian", "comfort-food", "weeknight"]
	PrimaryIngredients []string `json:"primaryIngredients"` // ["chicken", "tomatoes", "pasta"]
	CookingMethods     []string `json:"cookingMethods"`     // ["baked", "sautéed"]
	DietaryTags        []string `json:"dietaryTags"`        // ["vegetarian", "gluten-free"]
	FlavorProfile      []string `json:"flavorProfile"`      // ["savory", "herbed"]
	Equipment          []string `json:"equipment"`          // ["oven", "large-pot"]
	TimeCategory       string   `json:"timeCategory"`       // "medium-30min"
	Complexity         string   `json:"complexity"`         // "beginner", "intermediate", "advanced"
	MealType           string   `json:"mealType"`           // Single meal type: "breakfast", "lunch", "brunch", "dinner", "snack", "dessert", "appetizer", "drink"
}

// Full ingredient structure matching the main Go backend
type Ingredient struct {
	Text       string   `json:"text"`
	Amount     *float64 `json:"amount,omitempty"`
	Unit       *string  `json:"unit,omitempty"`
	Ingredient *string  `json:"ingredient,omitempty"`
}

type Instruction struct {
	StepNumber int    `json:"stepNumber"`
	Text       string `json:"text"`
}

// CookingMethod represents a specific cooking method with its own instructions
type CookingMethod struct {
	Name         string        `json:"name"`                   // "Stovetop", "Slow Cooker", "Oven", etc.
	Instructions []Instruction `json:"instructions"`           // Method-specific steps
	TimeEstimate *string       `json:"timeEstimate,omitempty"` // "30 minutes", "6-8 hours", etc.
	Equipment    []string      `json:"equipment,omitempty"`    // "Large pot", "Slow cooker", etc.
}

// OpenAI API structures
type OpenAIRequest struct {
	Model       string          `json:"model"`
	Messages    []OpenAIMessage `json:"messages"`
	Temperature float64         `json:"temperature"`
	MaxTokens   int             `json:"max_tokens"`
}

type OpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

// NormalizationResponse represents the output from OpenAI
type NormalizationResponse struct {
	NormalizedTitle        string           `json:"normalizedTitle"`
	NormalizedIngredients  []Ingredient     `json:"normalizedIngredients"`
	NormalizedInstructions []Instruction    `json:"normalizedInstructions"`   // Shared/prep instructions
	CookingMethods         []CookingMethod  `json:"cookingMethods,omitempty"` // Multiple method options
	InferredMetadata       InferredMetadata `json:"inferredMetadata"`
	SearchMetadata         SearchMetadata   `json:"searchMetadata"`
	InferredServings       *int             `json:"inferredServings,omitempty"`
	InferredTotalTime      *int             `json:"inferredTotalTime,omitempty"`
	InferredPrepTime       *int             `json:"inferredPrepTime,omitempty"`
	InferredCookTime       *int             `json:"inferredCookTime,omitempty"`
	QualityScore           float64          `json:"qualityScore"`
	NormalizationNotes     string           `json:"normalizationNotes"`
}

type InferredMetadata struct {
	CuisineType     string   `json:"cuisineType,omitempty"`
	CookingMethods  []string `json:"cookingMethods,omitempty"`
	DietaryInfo     []string `json:"dietaryInfo,omitempty"`
	DifficultyLevel string   `json:"difficultyLevel,omitempty"`
}
