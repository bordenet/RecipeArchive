import XCTest
@testable import RecipeArchiveiPad

final class RecipeArchiveiPadTests: XCTestCase {
    
    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }
    
    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }
    
    // MARK: - Recipe Model Tests
    
    func testRecipeInitialization() throws {
        let recipe = Recipe.sample
        
        XCTAssertEqual(recipe.title, "Classic Chocolate Chip Cookies")
        XCTAssertEqual(recipe.servings, 48)
        XCTAssertEqual(recipe.prepTime, 15)
        XCTAssertEqual(recipe.cookingTime, 11)
        XCTAssertEqual(recipe.totalTime, 26)
        XCTAssertEqual(recipe.ingredients.count, 9)
        XCTAssertEqual(recipe.instructions.count, 9)
    }
    
    func testRecipeJSONSerialization() throws {
        let recipe = Recipe.sample
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(recipe)
        
        let decoder = JSONDecoder()
        let decodedRecipe = try decoder.decode(Recipe.self, from: data)
        
        XCTAssertEqual(recipe.id, decodedRecipe.id)
        XCTAssertEqual(recipe.title, decodedRecipe.title)
        XCTAssertEqual(recipe.servings, decodedRecipe.servings)
        XCTAssertEqual(recipe.ingredients.count, decodedRecipe.ingredients.count)
        XCTAssertEqual(recipe.instructions.count, decodedRecipe.instructions.count)
    }
    
    func testRecipeIngredientSerialization() throws {
        let ingredient = RecipeIngredient(text: "2 cups flour")
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(ingredient)
        
        let decoder = JSONDecoder()
        let decodedIngredient = try decoder.decode(RecipeIngredient.self, from: data)
        
        XCTAssertEqual(ingredient.text, decodedIngredient.text)
    }
    
    func testRecipeInstructionSerialization() throws {
        let instruction = RecipeInstruction(stepNumber: 1, text: "Preheat oven to 350°F")
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(instruction)
        
        let decoder = JSONDecoder()
        let decodedInstruction = try decoder.decode(RecipeInstruction.self, from: data)
        
        XCTAssertEqual(instruction.stepNumber, decodedInstruction.stepNumber)
        XCTAssertEqual(instruction.text, decodedInstruction.text)
    }
    
    // MARK: - User Model Tests
    
    func testUserInitialization() throws {
        let user = User(
            id: "test-123",
            email: "test@example.com",
            username: "testuser"
        )
        
        XCTAssertEqual(user.id, "test-123")
        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertEqual(user.username, "testuser")
        XCTAssertNotNil(user.createdAt)
        XCTAssertNil(user.lastLoginAt)
    }
    
    func testUserJSONSerialization() throws {
        let user = User(
            id: "test-123",
            email: "test@example.com",
            username: "testuser"
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(user)
        
        let decoder = JSONDecoder()
        let decodedUser = try decoder.decode(User.self, from: data)
        
        XCTAssertEqual(user.id, decodedUser.id)
        XCTAssertEqual(user.email, decodedUser.email)
        XCTAssertEqual(user.username, decodedUser.username)
    }
    
    // MARK: - iPad-Specific Tests
    
    func testIPadLayoutAdaptation() throws {
        // Test that iPad-specific components are properly configured
        // This would test layout constraints and responsive design elements
        
        // For now, we'll test that the sample data is appropriate for iPad display
        let recipe = Recipe.sample
        
        // iPad should handle longer content better
        XCTAssertTrue(recipe.instructions.count > 0)
        XCTAssertTrue(recipe.ingredients.count > 0)
        
        // Verify that recipe content is substantial enough for split-view display
        let totalInstructionLength = recipe.instructions.reduce(0) { $0 + $1.text.count }
        XCTAssertGreaterThan(totalInstructionLength, 100) // Ensure substantial content
    }
    
    func testSplitViewDataHandling() throws {
        // Test scenarios specific to iPad split-view interface
        let recipes = [Recipe.sample]
        
        // Ensure we can handle multiple recipes for sidebar display
        XCTAssertFalse(recipes.isEmpty)
        XCTAssertNotNil(recipes.first?.title)
        XCTAssertNotNil(recipes.first?.id)
    }
    
    // MARK: - Performance Tests
    
    func testRecipeSearchPerformanceiPad() throws {
        let recipeService = RecipeService()
        let recipes = Array(repeating: Recipe.sample, count: 1000)
        
        // iPad should handle larger datasets efficiently
        measure {
            let filtered = recipes.filter { recipe in
                recipe.title.localizedCaseInsensitiveContains("chocolate") ||
                recipe.tags.contains { $0.localizedCaseInsensitiveContains("chocolate") }
            }
            XCTAssertGreaterThan(filtered.count, 0)
        }
    }
    
    func testJSONPerformanceiPad() throws {
        let recipes = Array(repeating: Recipe.sample, count: 100)
        
        // iPad should handle JSON serialization efficiently for larger datasets
        measure {
            let encoder = JSONEncoder()
            for recipe in recipes {
                _ = try? encoder.encode(recipe)
            }
        }
    }
    
    func testLargeRecipeCollectionHandling() throws {
        // Test iPad's ability to handle large recipe collections
        var largeRecipeCollection: [Recipe] = []
        
        for i in 1...500 {
            let recipe = Recipe(
                id: "recipe-\(i)",
                title: "Recipe \(i)",
                description: "Description for recipe \(i)",
                ingredients: [RecipeIngredient(text: "Ingredient \(i)")],
                instructions: [RecipeInstruction(stepNumber: 1, text: "Step \(i)")],
                prepTime: i % 60,
                cookingTime: i % 120,
                servings: i % 8 + 1,
                difficulty: ["Easy", "Medium", "Hard"][i % 3],
                cuisine: ["Italian", "Mexican", "Asian"][i % 3],
                tags: ["tag\(i % 5)"],
                imageUrl: nil,
                sourceUrl: "https://example.com/recipe-\(i)",
                sourceName: "Source \(i)"
            )
            largeRecipeCollection.append(recipe)
        }
        
        XCTAssertEqual(largeRecipeCollection.count, 500)
        XCTAssertTrue(largeRecipeCollection.allSatisfy { !$0.title.isEmpty })
    }
}