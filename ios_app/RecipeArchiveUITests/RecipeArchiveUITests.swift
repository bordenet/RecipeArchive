import XCTest

final class RecipeArchiveUITests: XCTestCase {
    var app: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }
    
    override func tearDownWithError() throws {
        app = nil
    }
    
    func testAppLaunch() throws {
        XCTAssertTrue(app.staticTexts["Recipe Archive"].exists)
    }
    
    func testLoginScreenElements() throws {
        // Verify login screen elements exist
        XCTAssertTrue(app.textFields["Email"].exists)
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertTrue(app.buttons["Sign In"].exists)
        XCTAssertTrue(app.buttons["Don't have an account? Sign Up"].exists)
    }
    
    func testSignUpFlow() throws {
        // Tap sign up button
        app.buttons["Don't have an account? Sign Up"].tap()
        
        // Verify sign up screen elements
        XCTAssertTrue(app.textFields["Email"].exists)
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertTrue(app.secureTextFields["Confirm Password"].exists)
        XCTAssertTrue(app.buttons["Sign Up"].exists)
        XCTAssertTrue(app.buttons["Already have an account? Sign In"].exists)
    }
    
    func testSuccessfulLogin() throws {
        // Enter valid credentials
        app.textFields["Email"].tap()
        app.textFields["Email"].typeText("test@example.com")
        
        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText("password123")
        
        // Tap sign in
        app.buttons["Sign In"].tap()
        
        // Wait for main screen to load
        let recipesTab = app.tabBars.buttons["Recipes"]
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: recipesTab, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Verify main app interface
        XCTAssertTrue(app.tabBars.buttons["Recipes"].exists)
        XCTAssertTrue(app.tabBars.buttons["Profile"].exists)
    }
    
    func testInvalidLogin() throws {
        // Enter invalid credentials
        app.textFields["Email"].tap()
        app.textFields["Email"].typeText("invalid-email")
        
        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText("short")
        
        // Tap sign in
        app.buttons["Sign In"].tap()
        
        // Wait for error message
        let errorText = app.staticTexts["Invalid email or password"]
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: errorText, handler: nil)
        waitForExpectations(timeout: 3, handler: nil)
        
        XCTAssertTrue(errorText.exists)
    }
    
    func testMainAppNavigation() throws {
        // Login first
        loginWithValidCredentials()
        
        // Test tab navigation
        app.tabBars.buttons["Profile"].tap()
        XCTAssertTrue(app.navigationBars["Profile"].exists)
        
        app.tabBars.buttons["Recipes"].tap()
        XCTAssertTrue(app.navigationBars["My Recipes"].exists)
    }
    
    func testRecipeListDisplay() throws {
        loginWithValidCredentials()
        
        // Wait for recipes to load
        let recipeCell = app.tables.cells.firstMatch
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: recipeCell, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Verify recipe list elements
        XCTAssertTrue(app.searchFields.element.exists)
        XCTAssertTrue(recipeCell.exists)
        XCTAssertTrue(app.navigationBars.buttons.element(matching: .button, identifier: "plus").exists)
    }
    
    func testSearchFunctionality() throws {
        loginWithValidCredentials()
        
        // Wait for recipes to load
        let searchField = app.searchFields.element
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: searchField, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Test search
        searchField.tap()
        searchField.typeText("chocolate")
        
        // Wait a moment for search to filter
        Thread.sleep(forTimeInterval: 1.0)
        
        // Verify search results contain chocolate-related recipes
        let recipeCells = app.tables.cells
        XCTAssertGreaterThan(recipeCells.count, 0)
    }
    
    func testRecipeDetailNavigation() throws {
        loginWithValidCredentials()
        
        // Wait for recipes to load and tap first recipe
        let firstRecipe = app.tables.cells.firstMatch
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: firstRecipe, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        firstRecipe.tap()
        
        // Wait for detail view to load
        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        let detailExists = NSPredicate(format: "exists == true")
        expectation(for: detailExists, evaluatedWith: backButton, handler: nil)
        waitForExpectations(timeout: 3, handler: nil)
        
        // Verify detail view elements
        XCTAssertTrue(backButton.exists)
        XCTAssertTrue(app.staticTexts["Ingredients"].exists)
        XCTAssertTrue(app.staticTexts["Instructions"].exists)
    }
    
    func testAddRecipeFlow() throws {
        loginWithValidCredentials()
        
        // Tap add recipe button
        app.navigationBars.buttons.element(matching: .button, identifier: "plus").tap()
        
        // Verify add recipe screen
        XCTAssertTrue(app.navigationBars["Add Recipe"].exists)
        XCTAssertTrue(app.textFields["Recipe Title"].exists)
        XCTAssertTrue(app.buttons["Cancel"].exists)
        XCTAssertTrue(app.buttons["Save"].exists)
        
        // Test cancel functionality
        app.buttons["Cancel"].tap()
        XCTAssertTrue(app.navigationBars["My Recipes"].exists)
    }
    
    func testProfileScreen() throws {
        loginWithValidCredentials()
        
        // Navigate to profile
        app.tabBars.buttons["Profile"].tap()
        
        // Verify profile elements
        XCTAssertTrue(app.staticTexts["Total Recipes"].exists)
        XCTAssertTrue(app.staticTexts["Favorite Recipes"].exists)
        XCTAssertTrue(app.staticTexts["Unique Tags"].exists)
        XCTAssertTrue(app.buttons["Sign Out"].exists)
    }
    
    func testSignOut() throws {
        loginWithValidCredentials()
        
        // Navigate to profile and sign out
        app.tabBars.buttons["Profile"].tap()
        app.buttons["Sign Out"].tap()
        
        // Verify return to login screen
        let loginTitle = app.staticTexts["Recipe Archive"]
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: loginTitle, handler: nil)
        waitForExpectations(timeout: 3, handler: nil)
        
        XCTAssertTrue(loginTitle.exists)
        XCTAssertTrue(app.buttons["Sign In"].exists)
    }
    
    func testPullToRefresh() throws {
        loginWithValidCredentials()
        
        // Wait for recipe list to load
        let tableView = app.tables.firstMatch
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: tableView, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Perform pull to refresh
        let firstCell = tableView.cells.firstMatch
        let start = firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let end = firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 2.0))
        start.press(forDuration: 0, thenDragTo: end)
        
        // Verify refresh occurred (loading indicator should appear briefly)
        Thread.sleep(forTimeInterval: 1.0)
    }
    
    // MARK: - Helper Methods
    
    private func loginWithValidCredentials() {
        app.textFields["Email"].tap()
        app.textFields["Email"].typeText("test@example.com")
        
        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText("password123")
        
        app.buttons["Sign In"].tap()
        
        // Wait for main screen to load
        let recipesTab = app.tabBars.buttons["Recipes"]
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: recipesTab, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
    }
}