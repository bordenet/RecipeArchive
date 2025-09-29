package analysis

import (
	"fmt"
	"time"
)

// Recipe represents the recipe structure for analysis
type Recipe struct {
	ID             string           `json:"id"`
	Title          string           `json:"title"`
	SourceURL      string           `json:"sourceUrl"`
	CreatedAt      time.Time        `json:"createdAt"`
	Ingredients    []Ingredient     `json:"ingredients"`
	Instructions   []Instruction    `json:"instructions"`
	CookingMethods []CookingMethod  `json:"cookingMethods"`
}

// Ingredient represents a recipe ingredient
type Ingredient struct {
	Text string `json:"text"`
}

// Instruction represents a recipe instruction
type Instruction struct {
	StepNumber int    `json:"stepNumber"`
	Text       string `json:"text"`
}

// CookingMethod represents a cooking method with its own instructions
type CookingMethod struct {
	Name         string        `json:"name"`
	Instructions []Instruction `json:"instructions"`
}

// AnalysisReport contains the results of recipe normalization analysis
type AnalysisReport struct {
	RecipeID         string
	Title            string
	SourceURL        string
	CreatedAt        time.Time
	IngredientCount  int
	InstructionCount int
	CookingMethods   int
	HasMultipleMethods bool
	QualityScore     float64
	Issues           []string
	Suggestions      []string
}

// Analyzer provides recipe normalization analysis functionality
type Analyzer struct{}

// NewAnalyzer creates a new recipe analyzer
func NewAnalyzer() *Analyzer {
	return &Analyzer{}
}

// AnalyzeRecipe performs comprehensive analysis of a recipe's normalization quality
func (a *Analyzer) AnalyzeRecipe(recipe *Recipe) *AnalysisReport {
	report := &AnalysisReport{
		RecipeID:         recipe.ID,
		Title:            recipe.Title,
		SourceURL:        recipe.SourceURL,
		CreatedAt:        recipe.CreatedAt,
		IngredientCount:  len(recipe.Ingredients),
		InstructionCount: len(recipe.Instructions),
		CookingMethods:   len(recipe.CookingMethods),
		HasMultipleMethods: len(recipe.CookingMethods) > 0,
		Issues:           []string{},
		Suggestions:      []string{},
	}

	// Calculate quality score
	report.QualityScore = a.calculateQualityScore(recipe)

	// Identify issues and suggestions
	a.identifyIssues(recipe, report)

	return report
}

// PrintAnalysis displays a formatted analysis report
func (a *Analyzer) PrintAnalysis(recipe *Recipe) {
	fmt.Printf("\n🔍 RECIPE NORMALIZATION ANALYSIS\n")
	fmt.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")

	fmt.Printf("📋 Recipe: %s\n", recipe.Title)
	fmt.Printf("🌐 Source: %s\n", recipe.SourceURL)
	fmt.Printf("📅 Created: %s\n", recipe.CreatedAt.Format("2006-01-02 15:04"))
	fmt.Printf("🆔 Recipe ID: %s\n\n", recipe.ID)

	// Analyze ingredients
	fmt.Printf("🥕 INGREDIENTS ANALYSIS:\n")
	fmt.Printf("   Total ingredients: %d\n", len(recipe.Ingredients))
	if len(recipe.Ingredients) > 0 {
		fmt.Printf("   Sample ingredients:\n")
		for i, ing := range recipe.Ingredients {
			if i >= 3 { // Show first 3 ingredients
				fmt.Printf("   ... and %d more\n", len(recipe.Ingredients)-3)
				break
			}
			fmt.Printf("     %d. %s\n", i+1, ing.Text)
		}
	}
	fmt.Printf("\n")

	// Analyze instructions
	fmt.Printf("👩‍🍳 INSTRUCTIONS ANALYSIS:\n")
	fmt.Printf("   Total instructions: %d\n", len(recipe.Instructions))
	if len(recipe.Instructions) > 0 {
		fmt.Printf("   Sample instructions:\n")
		for i, inst := range recipe.Instructions {
			if i >= 3 { // Show first 3 instructions
				fmt.Printf("   ... and %d more\n", len(recipe.Instructions)-3)
				break
			}
			fmt.Printf("     %d. %s\n", inst.StepNumber, inst.Text)
		}
	}
	fmt.Printf("\n")

	// Analyze cooking methods
	fmt.Printf("🍳 COOKING METHODS ANALYSIS:\n")
	fmt.Printf("   Multiple methods: %d\n", len(recipe.CookingMethods))
	if len(recipe.CookingMethods) > 0 {
		for _, method := range recipe.CookingMethods {
			fmt.Printf("   Method: %s (%d steps)\n", method.Name, len(method.Instructions))
		}
	} else {
		fmt.Printf("   Single method recipe (using main instructions)\n")
	}
	fmt.Printf("\n")

	// Generate and display quality report
	report := a.AnalyzeRecipe(recipe)
	a.PrintQualityReport(report)
}

// PrintQualityReport displays the quality analysis report
func (a *Analyzer) PrintQualityReport(report *AnalysisReport) {
	fmt.Printf("📊 QUALITY ANALYSIS:\n")
	fmt.Printf("   Quality Score: %.1f/10\n", report.QualityScore)

	if len(report.Issues) > 0 {
		fmt.Printf("   ⚠️  Issues found:\n")
		for _, issue := range report.Issues {
			fmt.Printf("     • %s\n", issue)
		}
	}

	if len(report.Suggestions) > 0 {
		fmt.Printf("   💡 Suggestions:\n")
		for _, suggestion := range report.Suggestions {
			fmt.Printf("     • %s\n", suggestion)
		}
	}

	if len(report.Issues) == 0 && len(report.Suggestions) == 0 {
		fmt.Printf("   ✅ Recipe appears well-normalized!\n")
	}
	fmt.Printf("\n")
}

// calculateQualityScore calculates a quality score from 0-10 based on recipe completeness
func (a *Analyzer) calculateQualityScore(recipe *Recipe) float64 {
	score := 0.0

	// Title quality (2 points)
	if recipe.Title != "" && recipe.Title != "Untitled Recipe" {
		score += 2.0
	}

	// Ingredient quality (3 points)
	if len(recipe.Ingredients) > 0 {
		score += 1.0 // Base point for having ingredients
		if len(recipe.Ingredients) >= 3 {
			score += 1.0 // Good number of ingredients
		}
		if len(recipe.Ingredients) >= 5 {
			score += 1.0 // Comprehensive ingredient list
		}
	}

	// Instruction quality (3 points)
	if len(recipe.Instructions) > 0 {
		score += 1.0 // Base point for having instructions
		if len(recipe.Instructions) >= 3 {
			score += 1.0 // Good number of steps
		}
		if len(recipe.Instructions) >= 5 {
			score += 1.0 // Detailed instructions
		}
	}

	// Structure quality (2 points)
	if recipe.SourceURL != "" {
		score += 1.0 // Has source URL
	}
	if !recipe.CreatedAt.IsZero() {
		score += 1.0 // Has creation timestamp
	}

	return score
}

// identifyIssues identifies potential issues and provides suggestions
func (a *Analyzer) identifyIssues(recipe *Recipe, report *AnalysisReport) {
	// Check for missing or poor title
	if recipe.Title == "" || recipe.Title == "Untitled Recipe" {
		report.Issues = append(report.Issues, "Missing or generic recipe title")
		report.Suggestions = append(report.Suggestions, "Ensure recipe parser extracts a descriptive title")
	}

	// Check ingredient count
	if len(recipe.Ingredients) == 0 {
		report.Issues = append(report.Issues, "No ingredients found")
		report.Suggestions = append(report.Suggestions, "Verify recipe parser is extracting ingredients correctly")
	} else if len(recipe.Ingredients) < 3 {
		report.Issues = append(report.Issues, "Very few ingredients - may be incomplete")
		report.Suggestions = append(report.Suggestions, "Check if all ingredients were parsed from source")
	}

	// Check instruction count
	if len(recipe.Instructions) == 0 {
		report.Issues = append(report.Issues, "No instructions found")
		report.Suggestions = append(report.Suggestions, "Verify recipe parser is extracting instructions correctly")
	} else if len(recipe.Instructions) < 3 {
		report.Issues = append(report.Issues, "Very few instructions - may be incomplete")
		report.Suggestions = append(report.Suggestions, "Check if all cooking steps were parsed from source")
	}

	// Check for cooking methods structure
	if len(recipe.CookingMethods) > 0 {
		for _, method := range recipe.CookingMethods {
			if len(method.Instructions) == 0 {
				report.Issues = append(report.Issues, fmt.Sprintf("Cooking method '%s' has no instructions", method.Name))
			}
		}
	}

	// Check for missing source URL
	if recipe.SourceURL == "" {
		report.Issues = append(report.Issues, "Missing source URL")
		report.Suggestions = append(report.Suggestions, "Ensure source URL is preserved during recipe creation")
	}
}