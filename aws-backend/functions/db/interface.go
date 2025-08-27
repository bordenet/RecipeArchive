package db

import (
	"recipe-archive/models"
)

// RecipeDB interface for database operations (S3-optimized)
type RecipeDB interface {
	GetRecipe(userID, recipeID string) (*models.Recipe, error)
	ListRecipes(userID string) ([]models.Recipe, error)
	CreateRecipe(recipe *models.Recipe) error
	UpdateRecipe(recipe *models.Recipe) error
	DeleteRecipe(userID, recipeID string) error
}
