package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHealthHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(healthHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusOK)
	}

	var response map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Errorf("Could not parse response: %v", err)
	}

	expected := "healthy"
	if response["status"] != expected {
		t.Errorf("handler returned unexpected status: got %v want %v",
			response["status"], expected)
	}
}

func TestDiagnosticsHandler(t *testing.T) {
	diagnosticData := map[string]interface{}{
		"test": "extension",
		"url":  "http://example.com",
		"diagnosticData": map[string]interface{}{
			"pageAnalysis": "test",
		},
	}

	jsonData, err := json.Marshal(diagnosticData)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/diagnostics", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(diagnosticsHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusOK)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Errorf("Could not parse response: %v", err)
	}

	if response["status"] != "received" {
		t.Errorf("handler returned unexpected status: got %v want %v",
			response["status"], "received")
	}
}

func TestMockAuthMiddleware(t *testing.T) {
	// Test missing Authorization header
	req, err := http.NewRequest("GET", "/api/recipes", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()

	// Create a test handler that just returns 200 if auth passes
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Wrap with auth middleware
	authHandler := MockAuthMiddleware(testHandler)
	authHandler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("handler should return unauthorized without auth header: got %v want %v",
			status, http.StatusUnauthorized)
	}

	// Test valid Authorization header
	req.Header.Set("Authorization", "Bearer test123")
	rr = httptest.NewRecorder()
	authHandler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler should return OK with valid auth header: got %v want %v",
			status, http.StatusOK)
	}
}

func TestRecipeHandler_CreateRecipe(t *testing.T) {
	// Initialize database
	db = &LocalDB{
		recipes: make(map[string]Recipe),
	}

	recipeData := Recipe{
		Title:        "Test Recipe",
		Description:  "A test recipe",
		Ingredients:  []string{"1 cup flour", "2 eggs"},
		Instructions: []string{"Mix flour and eggs", "Bake at 350°F"},
		Tags:         []string{"test", "easy"},
	}

	jsonData, err := json.Marshal(recipeData)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/api/recipes", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", "test-user")

	rr := httptest.NewRecorder()

	// Test the create handler directly
	createRecipeHandler(rr, req)

	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusCreated)
	}

	// Parse the actual response structure: {"message": "...", "recipe": {...}}
	var response map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Errorf("Could not parse response: %v", err)
	}

	// Extract the recipe from the response
	recipeData2, ok := response["recipe"].(map[string]interface{})
	if !ok {
		t.Errorf("Expected recipe object in response")
		return
	}

	if recipeData2["title"] != "Test Recipe" {
		t.Errorf("handler returned unexpected title: got %v want %v",
			recipeData2["title"], "Test Recipe")
	}

	if recipeData2["user_id"] != "test-user" {
		t.Errorf("handler returned unexpected user ID: got %v want %v",
			recipeData2["user_id"], "test-user")
	}
}

func TestRecipeHandler_ListRecipes(t *testing.T) {
	// Initialize database with test data
	db = &LocalDB{
		recipes: map[string]Recipe{
			"test-id": {
				ID:          "test-id",
				UserID:      "test-user",
				Title:       "Test Recipe",
				Description: "A test recipe",
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
		},
	}

	req, err := http.NewRequest("GET", "/api/recipes", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("X-User-ID", "test-user")

	rr := httptest.NewRecorder()

	// Test the list handler directly
	listRecipesHandler(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusOK)
	}

	// Parse the actual response structure: {"recipes": [...], "count": N}
	var response map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Errorf("Could not parse response: %v", err)
	}

	recipes, ok := response["recipes"].([]interface{})
	if !ok {
		t.Errorf("Expected recipes array in response")
		return
	}

	if len(recipes) != 1 {
		t.Errorf("expected 1 recipe, got %d", len(recipes))
	}

	firstRecipe, ok := recipes[0].(map[string]interface{})
	if !ok {
		t.Errorf("Expected recipe object")
		return
	}

	if firstRecipe["title"] != "Test Recipe" {
		t.Errorf("unexpected recipe title: got %v want %v",
			firstRecipe["title"], "Test Recipe")
	}
}
