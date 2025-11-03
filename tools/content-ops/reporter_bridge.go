package main

import (
	"github.com/bordenet/recipe-archive/tools/content-ops/internal/analysis"
	"github.com/bordenet/recipe-archive/tools/content-ops/internal/fetcher"
	"github.com/bordenet/recipe-archive/tools/content-ops/internal/reporting"
)

// RecipeReporter is a bridge to the new modular Reporter
type RecipeReporter struct {
	*reporting.Reporter
	accessToken string
}

// NewRecipeReporter creates a new recipe reporter using the modular structure
func NewRecipeReporter(bucketName string) (*RecipeReporter, error) {
	reporter, err := reporting.NewReporter(bucketName)
	if err != nil {
		return nil, err
	}

	return &RecipeReporter{
		Reporter: reporter,
	}, nil
}

// Authenticate wraps the modular authentication and stores the access token
func (r *RecipeReporter) Authenticate(username, password string) error {
	err := r.Reporter.Authenticate(username, password)
	if err != nil {
		return err
	}

	// Store access token for backwards compatibility
	r.accessToken = r.GetAccessToken()
	return nil
}

// AnalyzeNormalization provides backwards compatibility for recipe analysis
func (r *RecipeReporter) AnalyzeNormalization(recipe *Recipe) {
	// Convert to analysis recipe and use new analyzer
	analysisRecipe := convertMainToAnalysisRecipe(recipe)

	analyzer := analysis.NewAnalyzer()
	analyzer.PrintAnalysis(analysisRecipe)
}

// FetchRecipe provides backwards compatibility for recipe fetching
func (r *RecipeReporter) FetchRecipe(recipeURL string) (*Recipe, error) {
	fetcher := fetcher.NewRecipeFetcher(r.accessToken)

	fetchedRecipe, err := fetcher.FetchRecipeWithValidation(recipeURL)
	if err != nil {
		return nil, err
	}

	// Convert fetcher recipe to main recipe type
	return convertFetcherToMainRecipe(fetchedRecipe), nil
}

// Generate report methods delegate to modular reporting
func (r *RecipeReporter) GenerateReport(userEmail string) ([]ReportEntry, error) {
	return r.Reporter.GenerateReport(userEmail)
}

func (r *RecipeReporter) GenerateReportForTenant(tenantID, tenantEmail string) ([]ReportEntry, error) {
	return r.Reporter.GenerateReportForTenant(tenantID, tenantEmail)
}

func (r *RecipeReporter) ListAllTenants() ([]Tenant, error) {
	return r.Reporter.ListAllTenants()
}

// Helper conversion functions

func convertMainToAnalysisRecipe(recipe *Recipe) *analysis.Recipe {
	return &analysis.Recipe{
		ID:        recipe.ID,
		Title:     recipe.Title,
		SourceURL: recipe.SourceURL,
		CreatedAt: recipe.CreatedAt,
		Ingredients: func() []analysis.Ingredient {
			var ingredients []analysis.Ingredient
			for _, ing := range recipe.Ingredients {
				ingredients = append(ingredients, analysis.Ingredient{
					Text: ing.Text,
				})
			}
			return ingredients
		}(),
		Instructions: func() []analysis.Instruction {
			var instructions []analysis.Instruction
			for _, inst := range recipe.Instructions {
				instructions = append(instructions, analysis.Instruction{
					StepNumber: inst.StepNumber,
					Text:       inst.Text,
				})
			}
			return instructions
		}(),
		CookingMethods: func() []analysis.CookingMethod {
			var methods []analysis.CookingMethod
			for _, method := range recipe.CookingMethods {
				var methodInstructions []analysis.Instruction
				for _, inst := range method.Instructions {
					methodInstructions = append(methodInstructions, analysis.Instruction{
						StepNumber: inst.StepNumber,
						Text:       inst.Text,
					})
				}
				methods = append(methods, analysis.CookingMethod{
					Name:         method.Name,
					Instructions: methodInstructions,
				})
			}
			return methods
		}(),
	}
}

func convertFetcherToMainRecipe(fetchedRecipe *fetcher.Recipe) *Recipe {
	return &Recipe{
		ID:        fetchedRecipe.ID,
		Title:     fetchedRecipe.Title,
		SourceURL: fetchedRecipe.SourceURL,
		URL:       fetchedRecipe.URL,
		CreatedAt: fetchedRecipe.CreatedAt,
		UserID:    fetchedRecipe.UserID,
		Ingredients: func() []Ingredient {
			var ingredients []Ingredient
			for _, ing := range fetchedRecipe.Ingredients {
				ingredients = append(ingredients, Ingredient{
					Text:       ing.Text,
					Amount:     ing.Amount,
					Unit:       ing.Unit,
					Ingredient: ing.Ingredient,
				})
			}
			return ingredients
		}(),
		Instructions: func() []Instruction {
			var instructions []Instruction
			for _, inst := range fetchedRecipe.Instructions {
				instructions = append(instructions, Instruction{
					StepNumber: inst.StepNumber,
					Text:       inst.Text,
				})
			}
			return instructions
		}(),
		CookingMethods: func() []CookingMethod {
			var methods []CookingMethod
			for _, method := range fetchedRecipe.CookingMethods {
				var methodInstructions []Instruction
				for _, inst := range method.Instructions {
					methodInstructions = append(methodInstructions, Instruction{
						StepNumber: inst.StepNumber,
						Text:       inst.Text,
					})
				}
				methods = append(methods, CookingMethod{
					Name:         method.Name,
					Instructions: methodInstructions,
					TimeEstimate: method.TimeEstimate,
					Equipment:    method.Equipment,
				})
			}
			return methods
		}(),
	}
}

// Type aliases for backwards compatibility
type ReportEntry = reporting.ReportEntry
type Recipe = reporting.Recipe
type Ingredient = reporting.Ingredient
type Instruction = reporting.Instruction
type CookingMethod = reporting.CookingMethod
type Tenant = reporting.Tenant
type ParseFailure = reporting.ParseFailure
