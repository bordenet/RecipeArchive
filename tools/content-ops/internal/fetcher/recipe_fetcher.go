package fetcher

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// SupportedDomain represents a domain that can be fetched
type SupportedDomain struct {
	Domain      string
	Name        string
	Description string
}

// RecipeFetcher handles recipe fetching from supported websites
type RecipeFetcher struct {
	apiBaseURL    string
	accessToken   string
	userAgent     string
	timeout       time.Duration
}

// RecipeFetchRequest represents a request to create a recipe from a URL
type RecipeFetchRequest struct {
	Title                   string            `json:"title"`
	Ingredients             []Ingredient      `json:"ingredients"`
	Instructions            []Instruction     `json:"instructions"`
	CookingMethods          []CookingMethod   `json:"cookingMethods,omitempty"`
	SourceURL               string            `json:"sourceUrl"`
	MainPhotoURL            *string           `json:"mainPhotoUrl,omitempty"`
	PrepTimeMinutes         *int              `json:"prepTimeMinutes,omitempty"`
	CookTimeMinutes         *int              `json:"cookTimeMinutes,omitempty"`
	TotalTimeMinutes        *int              `json:"totalTimeMinutes,omitempty"`
	Servings                *int              `json:"servings,omitempty"`
	Yield                   *string           `json:"yield,omitempty"`
	Categories              []string          `json:"categories,omitempty"`
	Description             *string           `json:"description,omitempty"`
	Reviews                 *string           `json:"reviews,omitempty"`
	Nutrition               *string           `json:"nutrition,omitempty"`
	WebArchiveHTML          *string           `json:"webArchiveHtml,omitempty"`
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

// Recipe represents a fetched recipe
type Recipe struct {
	ID             string            `json:"id"`
	Title          string            `json:"title"`
	SourceURL      string            `json:"sourceUrl"`
	URL            string            `json:"url"`
	CreatedAt      time.Time         `json:"createdAt"`
	UserID         string            `json:"userId"`
	Ingredients    []Ingredient      `json:"ingredients"`
	Instructions   []Instruction     `json:"instructions"`
	CookingMethods []CookingMethod   `json:"cookingMethods,omitempty"`
}

// NewRecipeFetcher creates a new recipe fetcher
func NewRecipeFetcher(accessToken string) *RecipeFetcher {
	apiURL := getEnv("API_BASE_URL", "https://api-stage.recipes.bordenettech.com")

	return &RecipeFetcher{
		apiBaseURL:  apiURL,
		accessToken: accessToken,
		userAgent:   "content-ops-tool/2.0",
		timeout:     60 * time.Second,
	}
}

// GetSupportedDomains returns a list of supported recipe domains
func (f *RecipeFetcher) GetSupportedDomains() []SupportedDomain {
	return []SupportedDomain{
		{
			Domain:      "smittenkitchen.com",
			Name:        "Smitten Kitchen",
			Description: "Popular food blog with thoroughly tested recipes by Deb Perelman",
		},
		{
			Domain:      "seriouseats.com",
			Name:        "Serious Eats",
			Description: "High-quality recipes with detailed instructions and science-based cooking",
		},
		{
			Domain:      "epicurious.com",
			Name:        "Epicurious",
			Description: "Gourmet recipes and cooking techniques",
		},
		{
			Domain:      "foodnetwork.com",
			Name:        "Food Network",
			Description: "Celebrity chef recipes and cooking shows",
		},
		{
			Domain:      "allrecipes.com",
			Name:        "Allrecipes",
			Description: "Community-driven recipe collection",
		},
		{
			Domain:      "bonappetit.com",
			Name:        "Bon Appétit",
			Description: "Modern culinary magazine recipes",
		},
		{
			Domain:      "food.com",
			Name:        "Food.com",
			Description: "Large recipe database with user reviews",
		},
		{
			Domain:      "taste.com.au",
			Name:        "Taste.com.au",
			Description: "Australian recipes and cooking inspiration",
		},
	}
}

// IsURLSupported checks if a URL is from a supported domain
func (f *RecipeFetcher) IsURLSupported(recipeURL string) (bool, string, error) {
	parsedURL, err := url.Parse(recipeURL)
	if err != nil {
		return false, "", fmt.Errorf("invalid URL: %w", err)
	}

	domain := strings.TrimPrefix(parsedURL.Host, "www.")

	supportedDomains := f.GetSupportedDomains()
	for _, supported := range supportedDomains {
		if domain == supported.Domain {
			return true, supported.Name, nil
		}
	}

	return false, "", nil
}

// FetchRecipe fetches a recipe from a URL using the API Gateway endpoint
func (f *RecipeFetcher) FetchRecipe(recipeURL string) (*Recipe, error) {
	// Validate URL first
	supported, siteName, err := f.IsURLSupported(recipeURL)
	if err != nil {
		return nil, err
	}

	if !supported {
		fmt.Printf("⚠️  Warning: URL may not be from a fully supported site\n")
		fmt.Printf("💡 Supported sites: %s\n", f.getSupportedSitesList())
	} else {
		fmt.Printf("✅ Fetching from supported site: %s\n", siteName)
	}

	endpoint := fmt.Sprintf("%s/recipes", f.apiBaseURL)

	fmt.Printf("🌐 Fetching recipe from: %s\n", recipeURL)
	fmt.Printf("📡 Using API endpoint: %s\n", endpoint)

	// Prepare the request body with minimal required fields
	requestBody := RecipeFetchRequest{
		Title: "Temporary Title", // Will be replaced by parser
		Ingredients: []Ingredient{ // Will be populated by parser
			{Text: "Temporary ingredient"},
		},
		Instructions: []Instruction{ // Will be populated by parser
			{StepNumber: 1, Text: "Temporary instruction"},
		},
		SourceURL: recipeURL,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", f.userAgent)
	req.Header.Set("Authorization", "Bearer "+f.accessToken)

	// Make the request
	client := &http.Client{Timeout: f.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	responseData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(responseData))
	}

	// Parse response
	var response struct {
		Recipe Recipe `json:"recipe"`
	}

	if err := json.Unmarshal(responseData, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	fmt.Printf("✅ Successfully fetched recipe: %s\n", response.Recipe.Title)
	return &response.Recipe, nil
}

// FetchRecipeWithValidation fetches and validates a recipe from a URL
func (f *RecipeFetcher) FetchRecipeWithValidation(recipeURL string) (*Recipe, error) {
	recipe, err := f.FetchRecipe(recipeURL)
	if err != nil {
		return nil, err
	}

	// Basic validation
	issues := f.validateRecipe(recipe)
	if len(issues) > 0 {
		fmt.Printf("⚠️  Recipe validation found issues:\n")
		for _, issue := range issues {
			fmt.Printf("   • %s\n", issue)
		}
	} else {
		fmt.Printf("✅ Recipe validation passed\n")
	}

	return recipe, nil
}

// validateRecipe performs basic validation on a fetched recipe
func (f *RecipeFetcher) validateRecipe(recipe *Recipe) []string {
	var issues []string

	if recipe.Title == "" || recipe.Title == "Temporary Title" {
		issues = append(issues, "Missing or invalid recipe title")
	}

	if len(recipe.Ingredients) == 0 {
		issues = append(issues, "No ingredients found")
	} else if len(recipe.Ingredients) == 1 && recipe.Ingredients[0].Text == "Temporary ingredient" {
		issues = append(issues, "Only temporary ingredient found - parsing may have failed")
	}

	if len(recipe.Instructions) == 0 {
		issues = append(issues, "No instructions found")
	} else if len(recipe.Instructions) == 1 && recipe.Instructions[0].Text == "Temporary instruction" {
		issues = append(issues, "Only temporary instruction found - parsing may have failed")
	}

	if recipe.SourceURL == "" {
		issues = append(issues, "Missing source URL")
	}

	return issues
}

// getSupportedSitesList returns a formatted string of supported sites
func (f *RecipeFetcher) getSupportedSitesList() string {
	sites := f.GetSupportedDomains()
	var names []string
	for _, site := range sites {
		names = append(names, site.Name)
	}
	return strings.Join(names, ", ")
}

// PrintSupportedSites prints a formatted list of supported recipe sites
func (f *RecipeFetcher) PrintSupportedSites() {
	fmt.Printf("🌐 SUPPORTED RECIPE SITES:\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	sites := f.GetSupportedDomains()
	for _, site := range sites {
		fmt.Printf("✅ %s (%s)\n", site.Name, site.Domain)
		fmt.Printf("   %s\n\n", site.Description)
	}

	fmt.Printf("💡 To fetch from other sites, the parser will attempt to extract\n")
	fmt.Printf("   recipe data but may have limited success.\n\n")
}

// getEnv returns environment variable value or default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}