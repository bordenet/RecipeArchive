package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

// Recipe represents a recipe model
type Recipe struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Ingredients  []string  `json:"ingredients"`
	Instructions []string  `json:"instructions"`
	Tags         []string  `json:"tags"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	IsDeleted    bool      `json:"is_deleted,omitempty"`
}

// LocalDB represents a simple in-memory database for local development
type LocalDB struct {
	recipes map[string]Recipe
}

var db *LocalDB

// MockAuthMiddleware provides simple JWT-like authentication for local testing
func MockAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check for Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
			return
		}

		// Simple mock validation - in production, validate JWT properly
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Mock user validation - accept any non-empty token
		if token == "" {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Extract mock user ID from token (in production, decode JWT)
		// For local testing, use the token as user ID (simplified)
		userID := "user-" + token
		if len(userID) > 20 {
			userID = userID[:20] // Truncate for reasonable length
		}

		// Set user ID in header for Lambda function to read
		r.Header.Set("X-User-ID", userID)

		next.ServeHTTP(w, r)
	})
}

// Health check handler
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":   "healthy",
		"service":  "recipe-archive-local",
		"database": "local-in-memory",
	})
}

// Test page handler for extension testing
func testPageHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(http.StatusOK)

	// Read the test validation page
	testPagePath := "/Users/Matt.Bordenet/GitHub/RecipeArchive/tests/chrome-extension-validation.html"
	content, err := ioutil.ReadFile(testPagePath)
	if err != nil {
		// Fallback to simple HTML if file doesn't exist
		w.Write([]byte(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chrome Extension Test Page</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
        .recipe { border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>🧪 Chrome Extension Test Page</h1>
    <p><strong>URL:</strong> ` + r.RequestURI + `</p>
    <p><strong>Time:</strong> ` + time.Now().Format("2006-01-02 15:04:05") + `</p>
    
    <div class="recipe">
        <h2>Sample Recipe: Chocolate Chip Cookies</h2>
        <h3>Ingredients:</h3>
        <ul>
            <li>2 1/4 cups all-purpose flour</li>
            <li>1 tsp baking soda</li>
            <li>1 tsp salt</li>
            <li>1 cup butter, softened</li>
            <li>3/4 cup granulated sugar</li>
            <li>2 large eggs</li>
            <li>2 tsp vanilla extract</li>
            <li>2 cups chocolate chips</li>
        </ul>
        
        <h3>Instructions:</h3>
        <ol>
            <li>Preheat oven to 375°F (190°C)</li>
            <li>Mix dry ingredients in a bowl</li>
            <li>Cream butter and sugars until fluffy</li>
            <li>Beat in eggs and vanilla</li>
            <li>Gradually blend in flour mixture</li>
            <li>Stir in chocolate chips</li>
            <li>Drop onto ungreased cookie sheets</li>
            <li>Bake 9-11 minutes until golden brown</li>
        </ol>
    </div>
    
    <p>✅ This page is ready for Chrome extension testing!</p>
    <p>📋 Instructions: Load the RecipeArchive extension, then click the extension icon to test popup functionality.</p>
    
    <script>
        console.log('🎯 Test page loaded for Chrome extension testing');
        console.log('📄 Page URL:', window.location.href);
        console.log('🕐 Loaded at:', new Date().toLocaleString());
        
        // Test extension communication
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            console.log('✅ Chrome runtime detected - extension context available');
        } else {
            console.log('⚠️ Chrome runtime not detected - extension may not be loaded');
        }
    </script>
</body>
</html>
		`))
		return
	}

	w.Write(content)
}

// Diagnostics handler for browser extension debugging
func diagnosticsHandler(w http.ResponseWriter, r *http.Request) {
	// Read the request body
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	// Parse the JSON
	var diagnosticData map[string]interface{}
	if err := json.Unmarshal(body, &diagnosticData); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Log the diagnostic data for debugging
	fmt.Printf("📊 Received diagnostic data from %s\n", r.UserAgent())
	fmt.Printf("🔍 Data: %s\n", string(body))

	// Respond with success
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "received",
		"timestamp": time.Now().Format(time.RFC3339),
		"message":   "Diagnostic data processed successfully",
		"dataSize":  len(body),
	})
}

// List recipes handler
func listRecipesHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")

	userRecipes := make([]Recipe, 0) // Initialize as empty slice, not nil
	for _, recipe := range db.recipes {
		if recipe.UserID == userID && !recipe.IsDeleted {
			userRecipes = append(userRecipes, recipe)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"recipes": userRecipes,
		"count":   len(userRecipes),
	})
}

// Create recipe handler
func createRecipeHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	var recipe Recipe
	if err := json.Unmarshal(body, &recipe); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Set metadata
	recipe.ID = uuid.New().String()
	recipe.UserID = userID
	recipe.CreatedAt = time.Now()
	recipe.UpdatedAt = time.Now()
	recipe.IsDeleted = false

	// Store in database
	db.recipes[recipe.ID] = recipe

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Recipe created successfully",
		"recipe":  recipe,
	})
}

// Get recipe handler
func getRecipeHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	vars := mux.Vars(r)
	recipeID := vars["id"]

	recipe, exists := db.recipes[recipeID]
	if !exists || recipe.UserID != userID || recipe.IsDeleted {
		http.Error(w, "Recipe not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"recipe": recipe,
	})
}

// Update recipe handler
func updateRecipeHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	vars := mux.Vars(r)
	recipeID := vars["id"]

	recipe, exists := db.recipes[recipeID]
	if !exists || recipe.UserID != userID || recipe.IsDeleted {
		http.Error(w, "Recipe not found", http.StatusNotFound)
		return
	}

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	var updates map[string]interface{}
	if err := json.Unmarshal(body, &updates); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Apply updates
	if title, ok := updates["title"].(string); ok {
		recipe.Title = title
	}
	if description, ok := updates["description"].(string); ok {
		recipe.Description = description
	}
	if ingredients, ok := updates["ingredients"].([]interface{}); ok {
		var strIngredients []string
		for _, ing := range ingredients {
			if str, ok := ing.(string); ok {
				strIngredients = append(strIngredients, str)
			}
		}
		recipe.Ingredients = strIngredients
	}
	if instructions, ok := updates["instructions"].([]interface{}); ok {
		var strInstructions []string
		for _, inst := range instructions {
			if str, ok := inst.(string); ok {
				strInstructions = append(strInstructions, str)
			}
		}
		recipe.Instructions = strInstructions
	}
	if tags, ok := updates["tags"].([]interface{}); ok {
		var strTags []string
		for _, tag := range tags {
			if str, ok := tag.(string); ok {
				strTags = append(strTags, str)
			}
		}
		recipe.Tags = strTags
	}

	recipe.UpdatedAt = time.Now()
	db.recipes[recipeID] = recipe

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Recipe updated successfully",
		"recipe":  recipe,
	})
}

// Delete recipe handler
func deleteRecipeHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	vars := mux.Vars(r)
	recipeID := vars["id"]

	recipe, exists := db.recipes[recipeID]
	if !exists || recipe.UserID != userID || recipe.IsDeleted {
		http.Error(w, "Recipe not found", http.StatusNotFound)
		return
	}

	recipe.IsDeleted = true
	recipe.UpdatedAt = time.Now()
	db.recipes[recipeID] = recipe

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Recipe deleted successfully",
	})
}

// Recipe routes handler
func recipeHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		vars := mux.Vars(r)
		if recipeID := vars["id"]; recipeID != "" {
			getRecipeHandler(w, r)
		} else {
			listRecipesHandler(w, r)
		}
	case "POST":
		createRecipeHandler(w, r)
	case "PUT":
		updateRecipeHandler(w, r)
	case "DELETE":
		deleteRecipeHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func main() {
	// Initialize local database
	db = &LocalDB{
		recipes: make(map[string]Recipe),
	}

	// Create router
	r := mux.NewRouter()

	// Health check endpoint (no auth required)
	r.HandleFunc("/health", healthHandler).Methods("GET", "OPTIONS")

	// Test page endpoint (no auth required for extension testing)
	r.HandleFunc("/test-page", testPageHandler).Methods("GET", "OPTIONS")

	// Diagnostics endpoint (no auth required for extension debugging)
	r.HandleFunc("/diagnostics", diagnosticsHandler).Methods("POST", "OPTIONS")

	// Protected API routes (with auth middleware)
	api := r.PathPrefix("/api").Subrouter()
	api.Use(MockAuthMiddleware)

	// Recipe routes
	api.HandleFunc("/recipes", recipeHandler).Methods("GET", "POST", "OPTIONS")
	api.HandleFunc("/recipes/{id}", recipeHandler).Methods("GET", "PUT", "DELETE", "OPTIONS")

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://localhost:8080",
			"http://127.0.0.1:8080",
			"chrome-extension://*",
			"safari-web-extension://*",
			"moz-extension://*",
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowCredentials: true,
		AllowedHeaders:   []string{"*"},
	})

	handler := c.Handler(r)

	// Get port from environment or default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Recipe Archive Local Server starting on port %s\n", port)
	fmt.Printf("📝 Health check: http://localhost:%s/health\n", port)
	fmt.Printf("🔐 API endpoints: http://localhost:%s/api/recipes\n", port)
	fmt.Printf("💾 Using in-memory database for local development\n")
	fmt.Printf("🔧 Mock authentication enabled (use any Bearer token)\n")

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		fmt.Printf("❌ Server failed to start: %v\n", err)
		os.Exit(1)
	}
}
