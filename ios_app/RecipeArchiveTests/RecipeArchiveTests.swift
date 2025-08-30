import XCTest
@testable import RecipeArchive

final class RecipeArchiveTests: XCTestCase {
    
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
    
    // MARK: - Performance Tests
    
    func testRecipeSearchPerformance() throws {
        let recipeService = RecipeService()
        let recipes = Array(repeating: Recipe.sample, count: 1000)
        
        measure {
            let filtered = recipes.filter { recipe in
                recipe.title.localizedCaseInsensitiveContains("chocolate") ||
                recipe.tags.contains { $0.localizedCaseInsensitiveContains("chocolate") }
            }
            XCTAssertGreaterThan(filtered.count, 0)
        }
    }
    
    func testJSONPerformance() throws {
        let recipes = Array(repeating: Recipe.sample, count: 100)
        
        measure {
            let encoder = JSONEncoder()
            for recipe in recipes {
                _ = try? encoder.encode(recipe)
            }
        }
    }
}