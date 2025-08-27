package db

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"recipe-archive/models"
)

// S3RecipeDB implements RecipeDB using S3 for simple, cost-effective storage
// Structure: /recipes/{userID}/{recipeID}.json
type S3RecipeDB struct {
	client     *s3.Client
	bucketName string
}

// NewS3RecipeDB creates a new S3-based recipe database
func NewS3RecipeDB(client *s3.Client, bucketName string) *S3RecipeDB {
	return &S3RecipeDB{
		client:     client,
		bucketName: bucketName,
	}
}

// GetRecipe retrieves a recipe by ID and userID from S3
func (db *S3RecipeDB) GetRecipe(userID, recipeID string) (*models.Recipe, error) {
	key := fmt.Sprintf("recipes/%s/%s.json", userID, recipeID)

	result, err := db.client.GetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(db.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get recipe: %w", err)
	}
	defer result.Body.Close()

	data, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read recipe data: %w", err)
	}

	var recipe models.Recipe
	if err := json.Unmarshal(data, &recipe); err != nil {
		return nil, fmt.Errorf("failed to unmarshal recipe: %w", err)
	}

	return &recipe, nil
}

// CreateRecipe stores a new recipe in S3
func (db *S3RecipeDB) CreateRecipe(recipe *models.Recipe) error {
	key := fmt.Sprintf("recipes/%s/%s.json", recipe.UserID, recipe.ID)

	data, err := json.Marshal(recipe)
	if err != nil {
		return fmt.Errorf("failed to marshal recipe: %w", err)
	}

	_, err = db.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(db.bucketName),
		Key:         aws.String(key),
		Body:        strings.NewReader(string(data)),
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		return fmt.Errorf("failed to store recipe: %w", err)
	}

	return nil
}

// ListRecipes lists all recipes for a user by listing S3 objects
func (db *S3RecipeDB) ListRecipes(userID string) ([]models.Recipe, error) {
	prefix := fmt.Sprintf("recipes/%s/", userID)

	result, err := db.client.ListObjectsV2(context.Background(), &s3.ListObjectsV2Input{
		Bucket: aws.String(db.bucketName),
		Prefix: aws.String(prefix),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list recipes: %w", err)
	}

	var recipes []models.Recipe
	for _, obj := range result.Contents {
		// Extract recipeID from key
		key := *obj.Key
		recipeID := strings.TrimSuffix(strings.TrimPrefix(key, prefix), ".json")

		recipe, err := db.GetRecipe(userID, recipeID)
		if err != nil {
			// Log error but continue with other recipes
			continue
		}
		recipes = append(recipes, *recipe)
	}

	return recipes, nil
}

// UpdateRecipe updates an existing recipe (same as create in S3)
func (db *S3RecipeDB) UpdateRecipe(recipe *models.Recipe) error {
	return db.CreateRecipe(recipe) // S3 overwrites by default
}

// DeleteRecipe removes a recipe from S3
func (db *S3RecipeDB) DeleteRecipe(userID, recipeID string) error {
	key := fmt.Sprintf("recipes/%s/%s.json", userID, recipeID)

	_, err := db.client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(db.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete recipe: %w", err)
	}

	return nil
}
