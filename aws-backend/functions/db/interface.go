package db

import (
	"github.com/bordenet/recipe-archive/models"
)

// RecipeDB interface for database operations
type RecipeDB interface {
	GetRecipe(userID, recipeID string) (*models.Recipe, error)
	ListRecipes(userID string, limit int) ([]models.Recipe, error)
	CreateRecipe(recipe models.Recipe) error
	UpdateRecipe(userID, recipeID string, updates map[string]interface{}) error
	DeleteRecipe(userID, recipeID string) error
}
