package localdb

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"recipe-archive/models"
)

// LocalDB implements a file-based database for local development
type LocalDB struct {
	dataDir string
	mutex   sync.RWMutex
}

// NewLocalDB creates a new local database instance
func NewLocalDB(dataDir string) *LocalDB {
	return &LocalDB{
		dataDir: dataDir,
	}
}

// GetRecipe retrieves a recipe by user ID and recipe ID
func (db *LocalDB) GetRecipe(userID, recipeID string) (*models.Recipe, error) {
	db.mutex.RLock()
	defer db.mutex.RUnlock()

	filePath := filepath.Join(db.dataDir, userID, fmt.Sprintf("%s.json", recipeID))
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("recipe not found: %w", err)
	}

	var recipe models.Recipe
	if err := json.Unmarshal(data, &recipe); err != nil {
		return nil, fmt.Errorf("failed to unmarshal recipe: %w", err)
	}

	return &recipe, nil
}

// ListRecipes returns a list of recipes for a user
func (db *LocalDB) ListRecipes(userID string, limit int) ([]models.Recipe, error) {
	db.mutex.RLock()
	defer db.mutex.RUnlock()

	userDir := filepath.Join(db.dataDir, userID)
	entries, err := os.ReadDir(userDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read user directory: %w", err)
	}

	var recipes []models.Recipe
	count := 0
	for _, entry := range entries {
		if count >= limit && limit > 0 {
			break
		}

		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".json" {
			filePath := filepath.Join(userDir, entry.Name())
			data, err := os.ReadFile(filePath)
			if err != nil {
				continue
			}

			var recipe models.Recipe
			if err := json.Unmarshal(data, &recipe); err != nil {
				continue
			}

			recipes = append(recipes, recipe)
			count++
		}
	}

	return recipes, nil
}

// CreateRecipe creates a new recipe
func (db *LocalDB) CreateRecipe(recipe models.Recipe) error {
	db.mutex.Lock()
	defer db.mutex.Unlock()

	userDir := filepath.Join(db.dataDir, recipe.UserID)
	if err := os.MkdirAll(userDir, 0755); err != nil {
		return fmt.Errorf("failed to create user directory: %w", err)
	}

	filePath := filepath.Join(userDir, fmt.Sprintf("%s.json", recipe.ID))
	data, err := json.MarshalIndent(recipe, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal recipe: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write recipe file: %w", err)
	}

	return nil
}

// UpdateRecipe updates an existing recipe
func (db *LocalDB) UpdateRecipe(userID, recipeID string, updates map[string]interface{}) error {
	db.mutex.Lock()
	defer db.mutex.Unlock()

	// Get existing recipe
	recipe, err := db.GetRecipe(userID, recipeID)
	if err != nil {
		return err
	}

	// Apply updates (simplified - in real implementation, you'd handle this more robustly)
	data, err := json.Marshal(recipe)
	if err != nil {
		return err
	}

	var recipeMap map[string]interface{}
	if err := json.Unmarshal(data, &recipeMap); err != nil {
		return err
	}

	for key, value := range updates {
		recipeMap[key] = value
	}

	updatedData, err := json.Marshal(recipeMap)
	if err != nil {
		return err
	}

	var updatedRecipe models.Recipe
	if err := json.Unmarshal(updatedData, &updatedRecipe); err != nil {
		return err
	}

	return db.CreateRecipe(updatedRecipe)
}

// DeleteRecipe deletes a recipe
func (db *LocalDB) DeleteRecipe(userID, recipeID string) error {
	db.mutex.Lock()
	defer db.mutex.Unlock()

	filePath := filepath.Join(db.dataDir, userID, fmt.Sprintf("%s.json", recipeID))
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("failed to delete recipe: %w", err)
	}

	return nil
}
