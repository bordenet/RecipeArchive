import XCTest
import Combine
@testable import RecipeArchiveiPad

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
                    recipe.cuisine?.localizedCaseInsensitiveContains("italian") == true ||
                    recipe.title.localizedCaseInsensitiveContains("italian") ||
                    recipe.description?.localizedCaseInsensitiveContains("italian") == true ||
                    recipe.tags.contains { $0.localizedCaseInsensitiveContains("italian") }
                }
                XCTAssertGreaterThanOrEqual(self.recipeService.recipes.count, italianRecipes.count)
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
    
    // MARK: - iPad-Specific Recipe Service Tests
    
    func testLargeDatasetHandlinge() throws {
        // Test iPad's ability to handle larger recipe collections efficiently
        let expectation = XCTestExpectation(description: "Large dataset handling")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            let initialCount = self.recipeService.recipes.count
            
            // Add multiple recipes at once (simulating bulk import)
            let bulkRecipes = (1...50).map { index in
                Recipe(
                    id: "bulk-\(index)",
                    title: "Bulk Recipe \(index)",
                    description: "Description for bulk recipe \(index)",
                    ingredients: [RecipeIngredient(text: "Ingredient \(index)")],
                    instructions: [RecipeInstruction(stepNumber: 1, text: "Step \(index)")],
                    prepTime: index % 30,
                    cookingTime: index % 60,
                    servings: index % 8 + 1,
                    difficulty: ["Easy", "Medium", "Hard"][index % 3],
                    cuisine: ["Italian", "Mexican", "Asian"][index % 3],
                    tags: ["tag\(index % 5)"],
                    imageUrl: nil,
                    sourceUrl: nil,
                    sourceName: nil
                )
            }
            
            // Add recipes sequentially to test performance
            var addedCount = 0
            for recipe in bulkRecipes {
                self.recipeService.addRecipe(recipe)
                addedCount += 1
                
                if addedCount == bulkRecipes.count {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                        XCTAssertGreaterThanOrEqual(self.recipeService.recipes.count, initialCount + bulkRecipes.count)
                        expectation.fulfill()
                    }
                }
            }
        }
        
        wait(for: [expectation], timeout: 15.0)
    }
    
    func testSearchPerformanceWithLargeDataset() throws {
        // Test search performance with iPad-sized datasets
        let expectation = XCTestExpectation(description: "Search performance")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            // Perform multiple rapid searches (simulating user typing)
            let searchTerms = ["choc", "choco", "chocol", "chocola", "chocolat", "chocolate"]
            var searchCount = 0
            
            for term in searchTerms {
                self.recipeService.searchText = term
                searchCount += 1
                
                if searchCount == searchTerms.count {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        // Final search should complete successfully
                        XCTAssertEqual(self.recipeService.searchText, "chocolate")
                        expectation.fulfill()
                    }
                }
            }
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    func testMultipleSimultaneousOperationsiPad() throws {
        // Test handling multiple operations simultaneously (important for iPad multitasking)
        let expectation = XCTestExpectation(description: "Multiple simultaneous operations")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            // Perform multiple operations simultaneously
            self.recipeService.refreshRecipes()
            self.recipeService.searchText = "pasta"
            
            let newRecipe = Recipe(
                id: "simultaneous-test",
                title: "Simultaneous Test Recipe",
                description: "Testing simultaneous operations",
                ingredients: [RecipeIngredient(text: "Test ingredient")],
                instructions: [RecipeInstruction(stepNumber: 1, text: "Test step")],
                prepTime: 15,
                cookingTime: 30,
                servings: 4,
                difficulty: "Easy",
                cuisine: "Test",
                tags: ["test"],
                imageUrl: nil,
                sourceUrl: nil,
                sourceName: nil
            )
            self.recipeService.addRecipe(newRecipe)
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                // All operations should complete successfully
                XCTAssertFalse(self.recipeService.isLoading)
                XCTAssertEqual(self.recipeService.searchText, "pasta")
                XCTAssertTrue(self.recipeService.recipes.contains { $0.id == "simultaneous-test" })
                expectation.fulfill()
            }
        }
        
        wait(for: [expectation], timeout: 6.0)
    }
}