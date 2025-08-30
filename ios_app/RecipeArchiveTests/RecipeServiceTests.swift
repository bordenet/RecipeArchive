import XCTest
import Combine
@testable import RecipeArchive

final class RecipeServiceTests: XCTestCase {
    var recipeService: RecipeService!
    var cancellables: Set<AnyCancellable>!
    
    override func setUpWithError() throws {
        recipeService = RecipeService()
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDownWithError() throws {
        recipeService = nil
        cancellables = nil
    }
    
    func testInitialState() throws {
        // Wait for initial load to complete
        let expectation = XCTestExpectation(description: "Initial load")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            XCTAssertFalse(self.recipeService.isLoading)
            XCTAssertGreaterThan(self.recipeService.recipes.count, 0)
            XCTAssertEqual(self.recipeService.searchText, "")
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testLoadRecipes() throws {
        let expectation = XCTestExpectation(description: "Load recipes")
        
        recipeService.$recipes
            .dropFirst()
            .sink { recipes in
                if !recipes.isEmpty {
                    XCTAssertGreaterThan(recipes.count, 0)
                    XCTAssertEqual(recipes.first?.title, "Classic Chocolate Chip Cookies")
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        recipeService.loadRecipes()
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testAddRecipe() throws {
        let expectation = XCTestExpectation(description: "Add recipe")
        
        // Wait for initial load
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            let initialCount = self.recipeService.recipes.count
            
            let newRecipe = Recipe(
                id: "test-recipe",
                title: "Test Recipe",
                description: "A test recipe",
                ingredients: [RecipeIngredient(text: "Test ingredient")],
                instructions: [RecipeInstruction(stepNumber: 1, text: "Test instruction")],
                prepTime: 10,
                cookingTime: 20,
                servings: 2,
                difficulty: "Easy",
                cuisine: "Test",
                tags: ["test"],
                imageUrl: nil,
                sourceUrl: nil,
                sourceName: nil
            )
            
            self.recipeService.addRecipe(newRecipe)
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                XCTAssertEqual(self.recipeService.recipes.count, initialCount + 1)
                XCTAssertTrue(self.recipeService.recipes.contains { $0.id == "test-recipe" })
                expectation.fulfill()
            }
        }
        
        wait(for: [expectation], timeout: 4.0)
    }
    
    func testDeleteRecipe() throws {
        let expectation = XCTestExpectation(description: "Delete recipe")
        
        // Wait for initial load
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            guard let firstRecipe = self.recipeService.recipes.first else {
                XCTFail("No recipes loaded")
                return
            }
            
            let initialCount = self.recipeService.recipes.count
            self.recipeService.deleteRecipe(firstRecipe)
            
            XCTAssertEqual(self.recipeService.recipes.count, initialCount - 1)
            XCTAssertFalse(self.recipeService.recipes.contains { $0.id == firstRecipe.id })
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testSearchFunctionality() throws {
        let expectation = XCTestExpectation(description: "Search recipes")
        
        // Wait for initial load
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            let totalCount = self.recipeService.recipes.count
            XCTAssertGreaterThan(totalCount, 0)
            
            // Test search by title
            self.recipeService.searchText = "chocolate"
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                let filteredCount = self.recipeService.recipes.count
                XCTAssertLessThanOrEqual(filteredCount, totalCount)
                XCTAssertTrue(self.recipeService.recipes.allSatisfy { recipe in
                    recipe.title.localizedCaseInsensitiveContains("chocolate") ||
                    recipe.description?.localizedCaseInsensitiveContains("chocolate") == true ||
                    recipe.tags.contains { $0.localizedCaseInsensitiveContains("chocolate") } ||
                    recipe.cuisine?.localizedCaseInsensitiveContains("chocolate") == true
                })
                
                // Clear search
                self.recipeService.searchText = ""
                
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    XCTAssertEqual(self.recipeService.recipes.count, totalCount)
                    expectation.fulfill()
                }
            }
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    func testSearchByCuisine() throws {
        let expectation = XCTestExpectation(description: "Search by cuisine")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.recipeService.searchText = "italian"
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                let italianRecipes = self.recipeService.recipes.filter { recipe in
                    recipe.cuisine?.localizedCaseInsensitiveContains("italian") == true
                }
                XCTAssertEqual(self.recipeService.recipes.count, italianRecipes.count)
                expectation.fulfill()
            }
        }
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testSearchByTags() throws {
        let expectation = XCTestExpectation(description: "Search by tags")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.recipeService.searchText = "dessert"
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                XCTAssertTrue(self.recipeService.recipes.allSatisfy { recipe in
                    recipe.tags.contains { $0.localizedCaseInsensitiveContains("dessert") } ||
                    recipe.title.localizedCaseInsensitiveContains("dessert") ||
                    recipe.description?.localizedCaseInsensitiveContains("dessert") == true ||
                    recipe.cuisine?.localizedCaseInsensitiveContains("dessert") == true
                })
                expectation.fulfill()
            }
        }
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testRefreshRecipes() throws {
        let expectation = XCTestExpectation(description: "Refresh recipes")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            XCTAssertFalse(self.recipeService.isLoading)
            
            self.recipeService.refreshRecipes()
            XCTAssertTrue(self.recipeService.isLoading)
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                XCTAssertFalse(self.recipeService.isLoading)
                XCTAssertGreaterThan(self.recipeService.recipes.count, 0)
                expectation.fulfill()
            }
        }
        
        wait(for: [expectation], timeout: 4.0)
    }
    
    func testLoadingState() throws {
        XCTAssertTrue(recipeService.isLoading) // Should be loading on init
        
        let expectation = XCTestExpectation(description: "Loading complete")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            XCTAssertFalse(self.recipeService.isLoading)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 3.0)
    }
}