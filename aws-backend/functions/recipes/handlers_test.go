package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"

	"recipe-archive/db"
	"recipe-archive/models"
)

// MockRecipeDB implements db.RecipeDB for testing
type MockRecipeDB struct {
	recipes    map[string]map[string]*models.Recipe // userID -> recipeID -> recipe
	createErr  error
	getErr     error
	listErr    error
	updateErr  error
	deleteErr  error
}

func NewMockRecipeDB() *MockRecipeDB {
	return &MockRecipeDB{
		recipes: make(map[string]map[string]*models.Recipe),
	}
}

func (m *MockRecipeDB) GetRecipe(userID, recipeID string) (*models.Recipe, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	if userRecipes, ok := m.recipes[userID]; ok {
		if recipe, ok := userRecipes[recipeID]; ok {
			return recipe, nil
		}
	}
	return nil, errors.New("NoSuchKey: recipe not found")
}

func (m *MockRecipeDB) ListRecipes(userID string) ([]models.Recipe, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	var recipes []models.Recipe
	if userRecipes, ok := m.recipes[userID]; ok {
		for _, recipe := range userRecipes {
			recipes = append(recipes, *recipe)
		}
	}
	return recipes, nil
}

func (m *MockRecipeDB) CreateRecipe(recipe *models.Recipe) error {
	if m.createErr != nil {
		return m.createErr
	}
	if m.recipes[recipe.UserID] == nil {
		m.recipes[recipe.UserID] = make(map[string]*models.Recipe)
	}
	m.recipes[recipe.UserID][recipe.ID] = recipe
	return nil
}

func (m *MockRecipeDB) UpdateRecipe(recipe *models.Recipe) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	if m.recipes[recipe.UserID] == nil {
		m.recipes[recipe.UserID] = make(map[string]*models.Recipe)
	}
	m.recipes[recipe.UserID][recipe.ID] = recipe
	return nil
}

func (m *MockRecipeDB) DeleteRecipe(userID, recipeID string) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	if userRecipes, ok := m.recipes[userID]; ok {
		delete(userRecipes, recipeID)
	}
	return nil
}

// Ensure MockRecipeDB implements db.RecipeDB interface
var _ db.RecipeDB = (*MockRecipeDB)(nil)

// Helper to set up test environment
func setupTestEnv() func() {
	originalDB := recipeDB
	originalLogger := logger
	
	// Set up test logger that discards output
	logger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	
	return func() {
		recipeDB = originalDB
		logger = originalLogger
	}
}

// Helper to create API Gateway request
func makeRequest(method, body string, pathParams, queryParams map[string]string) events.APIGatewayProxyRequest {
	return events.APIGatewayProxyRequest{
		HTTPMethod:            method,
		Body:                  body,
		PathParameters:        pathParams,
		QueryStringParameters: queryParams,
	}
}

// ========== GET Handler Tests ==========

func TestHandleGetRecipeByID_Success(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB
	
	// Add a test recipe
	testRecipe := &models.Recipe{
		ID:        "recipe-123",
		UserID:    "user-456",
		Title:     "Test Recipe",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	mockDB.CreateRecipe(testRecipe)

	resp, err := handleGetRecipeByID(context.Background(), "user-456", "recipe-123")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestHandleGetRecipeByID_NotFound(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	resp, err := handleGetRecipeByID(context.Background(), "user-456", "nonexistent")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", resp.StatusCode)
	}
}

func TestHandleGetRecipeByID_SoftDeleted(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	// Add a soft-deleted recipe
	testRecipe := &models.Recipe{
		ID:        "recipe-123",
		UserID:    "user-456",
		Title:     "Deleted Recipe",
		IsDeleted: true,
	}
	mockDB.CreateRecipe(testRecipe)

	resp, err := handleGetRecipeByID(context.Background(), "user-456", "recipe-123")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status 404 for soft-deleted recipe, got %d", resp.StatusCode)
	}
}

func TestHandleGetRecipeByID_InternalError(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	mockDB.getErr = errors.New("database connection failed")
	recipeDB = mockDB

	resp, err := handleGetRecipeByID(context.Background(), "user-456", "recipe-123")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", resp.StatusCode)
	}
}

func TestHandleListRecipes_Success(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	// Add test recipes
	for i := 0; i < 3; i++ {
		recipe := &models.Recipe{
			ID:        "recipe-" + string(rune('a'+i)),
			UserID:    "user-456",
			Title:     "Recipe " + string(rune('A'+i)),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		mockDB.CreateRecipe(recipe)
	}

	resp, err := handleListRecipes(context.Background(), "user-456", nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result models.RecipesListResponse
	if err := json.Unmarshal([]byte(resp.Body), &result); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}
	if len(result.Recipes) != 3 {
		t.Errorf("Expected 3 recipes, got %d", len(result.Recipes))
	}
}

func TestHandleListRecipes_WithPagination(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	// Add 5 recipes
	for i := 0; i < 5; i++ {
		recipe := &models.Recipe{
			ID:        "recipe-" + string(rune('a'+i)),
			UserID:    "user-456",
			Title:     "Recipe " + string(rune('A'+i)),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		mockDB.CreateRecipe(recipe)
	}

	// Request with limit of 2
	queryParams := map[string]string{"limit": "2"}
	resp, err := handleListRecipes(context.Background(), "user-456", queryParams)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	var result models.RecipesListResponse
	if err := json.Unmarshal([]byte(resp.Body), &result); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}
	if len(result.Recipes) != 2 {
		t.Errorf("Expected 2 recipes with limit, got %d", len(result.Recipes))
	}
	if !result.Pagination.HasMore {
		t.Error("Expected HasMore to be true")
	}
}

func TestHandleListRecipes_FiltersSoftDeleted(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	// Add one active and one deleted recipe
	activeRecipe := &models.Recipe{
		ID:     "active-1",
		UserID: "user-456",
		Title:  "Active Recipe",
	}
	deletedRecipe := &models.Recipe{
		ID:        "deleted-1",
		UserID:    "user-456",
		Title:     "Deleted Recipe",
		IsDeleted: true,
	}
	mockDB.CreateRecipe(activeRecipe)
	mockDB.CreateRecipe(deletedRecipe)

	resp, err := handleListRecipes(context.Background(), "user-456", nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	var result models.RecipesListResponse
	if err := json.Unmarshal([]byte(resp.Body), &result); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}
	if len(result.Recipes) != 1 {
		t.Errorf("Expected 1 active recipe, got %d", len(result.Recipes))
	}
}

func TestHandleListRecipes_Error(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	mockDB.listErr = errors.New("database error")
	recipeDB = mockDB

	resp, err := handleListRecipes(context.Background(), "user-456", nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", resp.StatusCode)
	}
}

func TestHandleGetRecipes_RoutesToGetByID(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	testRecipe := &models.Recipe{
		ID:     "recipe-123",
		UserID: "user-456",
		Title:  "Test Recipe",
	}
	mockDB.CreateRecipe(testRecipe)

	request := makeRequest("GET", "", map[string]string{"recipeId": "recipe-123"}, nil)
	resp, err := handleGetRecipes(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestHandleGetRecipes_RoutesToList(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	testRecipe := &models.Recipe{
		ID:     "recipe-123",
		UserID: "user-456",
		Title:  "Test Recipe",
	}
	mockDB.CreateRecipe(testRecipe)

	request := makeRequest("GET", "", nil, nil)
	resp, err := handleGetRecipes(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

// ========== CREATE Handler Tests ==========

func TestHandleCreateRecipe_InvalidJSON(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	request := makeRequest("POST", "invalid json{", nil, nil)
	resp, err := handleCreateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid JSON, got %d", resp.StatusCode)
	}
}

func TestHandleCreateRecipe_EmptyTitle(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	body := `{"title": "", "ingredients": [{"text": "1 cup flour"}], "instructions": [{"text": "Mix"}]}`
	request := makeRequest("POST", body, nil, nil)
	resp, err := handleCreateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for empty title, got %d", resp.StatusCode)
	}
}

func TestHandleCreateRecipe_NoContent(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	// Recipe with title but no ingredients, instructions, HTML, or valid URL
	body := `{"title": "Empty Recipe", "sourceUrl": ""}`
	request := makeRequest("POST", body, nil, nil)
	resp, err := handleCreateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for empty content, got %d: %s", resp.StatusCode, resp.Body)
	}
}

func TestHandleCreateRecipe_WithValidURL(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	// Recipe with valid URL but no ingredients (should be accepted for later parsing)
	body := `{"title": "URL Recipe", "sourceUrl": "https://example.com/recipe"}`
	request := makeRequest("POST", body, nil, nil)

	// Note: This will try to fetch HTML which will fail, but validation should pass
	resp, err := handleCreateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	// The handler will accept the recipe (validation passes) - it may fail later on HTML fetch
	// but that's a different error path
	if resp.StatusCode == http.StatusBadRequest {
		t.Errorf("Expected validation to pass with valid URL, got 400: %s", resp.Body)
	}
}

func TestHandleCreateRecipe_WithIngredients(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	body := `{
		"title": "Test Recipe",
		"ingredients": [{"text": "1 cup flour"}, {"text": "2 eggs"}],
		"instructions": [{"text": "Mix flour and eggs"}],
		"sourceUrl": "https://example.com/recipe"
	}`
	request := makeRequest("POST", body, nil, nil)
	resp, err := handleCreateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	// Should succeed (may have other issues but validation passes)
	if resp.StatusCode == http.StatusBadRequest {
		t.Errorf("Expected validation to pass, got 400: %s", resp.Body)
	}
}

// ========== UPDATE Handler Tests ==========

func TestHandleUpdateRecipe_MissingRecipeID(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	request := makeRequest("PUT", `{"title": "Updated"}`, nil, nil)
	resp, err := handleUpdateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for missing recipe ID, got %d", resp.StatusCode)
	}
}

func TestHandleUpdateRecipe_InvalidJSON(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	request := makeRequest("PUT", "invalid{json", map[string]string{"recipeId": "recipe-123"}, nil)
	resp, err := handleUpdateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid JSON, got %d", resp.StatusCode)
	}
}

func TestHandleUpdateRecipe_RecipeNotFound(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	request := makeRequest("PUT", `{"title": "Updated"}`, map[string]string{"recipeId": "nonexistent"}, nil)
	resp, err := handleUpdateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status 404 for not found, got %d", resp.StatusCode)
	}
}

func TestHandleUpdateRecipe_SoftDeleted(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	deletedRecipe := &models.Recipe{
		ID:        "recipe-123",
		UserID:    "user-456",
		Title:     "Deleted Recipe",
		IsDeleted: true,
	}
	mockDB.CreateRecipe(deletedRecipe)

	request := makeRequest("PUT", `{"title": "Updated"}`, map[string]string{"recipeId": "recipe-123"}, nil)
	resp, err := handleUpdateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status 404 for soft-deleted recipe, got %d", resp.StatusCode)
	}
}

func TestHandleUpdateRecipe_EmptyTitle(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	existingRecipe := &models.Recipe{
		ID:     "recipe-123",
		UserID: "user-456",
		Title:  "Original Title",
	}
	mockDB.CreateRecipe(existingRecipe)

	emptyTitle := ""
	request := makeRequest("PUT", `{"title": "  "}`, map[string]string{"recipeId": "recipe-123"}, nil)
	_ = emptyTitle
	resp, err := handleUpdateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for empty title, got %d", resp.StatusCode)
	}
}

func TestHandleUpdateRecipe_Success(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	existingRecipe := &models.Recipe{
		ID:      "recipe-123",
		UserID:  "user-456",
		Title:   "Original Title",
		Version: 1,
	}
	mockDB.CreateRecipe(existingRecipe)

	request := makeRequest("PUT", `{"title": "Updated Title"}`, map[string]string{"recipeId": "recipe-123"}, nil)
	resp, err := handleUpdateRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", resp.StatusCode, resp.Body)
	}

	// Verify the recipe was updated
	updated, _ := mockDB.GetRecipe("user-456", "recipe-123")
	if updated.Title != "Updated Title" {
		t.Errorf("Expected title 'Updated Title', got '%s'", updated.Title)
	}
	if updated.Version != 2 {
		t.Errorf("Expected version 2, got %d", updated.Version)
	}
}

// ========== DELETE Handler Tests ==========

func TestHandleDeleteRecipe_MissingRecipeID(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	request := makeRequest("DELETE", "", nil, nil)
	resp, err := handleDeleteRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for missing recipe ID, got %d", resp.StatusCode)
	}
}

func TestHandleDeleteRecipe_NotFound(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	request := makeRequest("DELETE", "", map[string]string{"recipeId": "nonexistent"}, nil)
	resp, err := handleDeleteRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", resp.StatusCode)
	}
}

func TestHandleDeleteRecipe_AlreadyDeleted(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	deletedRecipe := &models.Recipe{
		ID:        "recipe-123",
		UserID:    "user-456",
		Title:     "Deleted Recipe",
		IsDeleted: true,
	}
	mockDB.CreateRecipe(deletedRecipe)

	request := makeRequest("DELETE", "", map[string]string{"recipeId": "recipe-123"}, nil)
	resp, err := handleDeleteRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status 404 for already deleted, got %d", resp.StatusCode)
	}
}

func TestHandleDeleteRecipe_Success(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	existingRecipe := &models.Recipe{
		ID:     "recipe-123",
		UserID: "user-456",
		Title:  "Recipe to Delete",
	}
	mockDB.CreateRecipe(existingRecipe)

	request := makeRequest("DELETE", "", map[string]string{"recipeId": "recipe-123"}, nil)
	resp, err := handleDeleteRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", resp.StatusCode, resp.Body)
	}

	// Verify the recipe was deleted
	_, err = mockDB.GetRecipe("user-456", "recipe-123")
	if err == nil {
		t.Error("Expected recipe to be deleted")
	}
}

func TestHandleDeleteRecipe_DatabaseError(t *testing.T) {
	cleanup := setupTestEnv()
	defer cleanup()

	mockDB := NewMockRecipeDB()
	recipeDB = mockDB

	existingRecipe := &models.Recipe{
		ID:     "recipe-123",
		UserID: "user-456",
		Title:  "Recipe",
	}
	mockDB.CreateRecipe(existingRecipe)
	mockDB.deleteErr = errors.New("database error")

	request := makeRequest("DELETE", "", map[string]string{"recipeId": "recipe-123"}, nil)
	resp, err := handleDeleteRecipe(context.Background(), request, "user-456")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("Expected status 500, got %d", resp.StatusCode)
	}
}

// Test getDomainFromURL
func TestGetDomainFromURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		expected string
	}{
		{"basic domain", "https://example.com/page", "example.com"},
		{"www prefix", "https://www.example.com/page", "example.com"},
		{"subdomain", "https://blog.example.com/page", "blog.example.com"},
		{"invalid URL", "not a url", ""},
		{"complex path", "https://www.recipes.cooking.com/category/item?query=1", "recipes.cooking.com"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getDomainFromURL(tt.url)
			if result != tt.expected {
				t.Errorf("getDomainFromURL(%q) = %q, expected %q", tt.url, result, tt.expected)
			}
		})
	}
}

// Test validateImageURL
func TestValidateImageURL_NilOrEmpty(t *testing.T) {
	err := validateImageURL(nil)
	if err != nil {
		t.Errorf("Expected nil error for nil URL, got %v", err)
	}

	empty := ""
	err = validateImageURL(&empty)
	if err != nil {
		t.Errorf("Expected nil error for empty URL, got %v", err)
	}
}

func TestValidateImageURL_InvalidURL(t *testing.T) {
	invalid := "not a valid url %%"
	err := validateImageURL(&invalid)
	if err == nil {
		t.Error("Expected error for invalid URL format")
	}
}

func TestValidateImageURL_NonHTTPS(t *testing.T) {
	httpURL := "http://example.com/image.jpg"
	err := validateImageURL(&httpURL)
	if err == nil {
		t.Error("Expected error for non-HTTPS URL")
	}
}

func TestValidateImageURL_ExternalURL(t *testing.T) {
	// Set a bucket name for testing
	originalBucket := bucketName
	bucketName = "test-bucket"
	defer func() { bucketName = originalBucket }()

	externalURL := "https://external-site.com/image.jpg"
	err := validateImageURL(&externalURL)
	if err == nil {
		t.Error("Expected error for external URL")
	}
}

func TestValidateImageURL_ValidS3URL(t *testing.T) {
	// Set a bucket name for testing
	originalBucket := bucketName
	bucketName = "test-bucket"
	defer func() { bucketName = originalBucket }()

	// Pattern 1: BUCKET.s3.amazonaws.com
	validURL1 := "https://test-bucket.s3.amazonaws.com/images/photo.jpg"
	err := validateImageURL(&validURL1)
	if err != nil {
		t.Errorf("Expected valid S3 URL (pattern 1) to pass, got error: %v", err)
	}

	// Pattern 3: Regional S3
	validURL3 := "https://test-bucket.s3.us-west-2.amazonaws.com/images/photo.jpg"
	err = validateImageURL(&validURL3)
	if err != nil {
		t.Errorf("Expected valid S3 URL (pattern 3) to pass, got error: %v", err)
	}
}

