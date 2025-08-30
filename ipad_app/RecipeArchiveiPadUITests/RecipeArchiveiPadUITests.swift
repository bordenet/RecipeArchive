import XCTest

final class RecipeArchiveiPadUITests: XCTestCase {
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
    
    func testLoginScreenLayoutiPad() throws {
        // Verify iPad-specific login screen layout with split design
        XCTAssertTrue(app.staticTexts["Recipe Archive"].exists)
        XCTAssertTrue(app.staticTexts["Your personal collection of favorite recipes from around the web."].exists)
        
        // Verify login form elements
        XCTAssertTrue(app.textFields["Email Address"].exists)
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertTrue(app.buttons["Sign In"].exists)
        XCTAssertTrue(app.buttons["Don't have an account? Create one"].exists)
        
        // Verify feature showcase on the left side
        XCTAssertTrue(app.staticTexts["Save Recipes"].exists)
        XCTAssertTrue(app.staticTexts["Smart Search"].exists)
        XCTAssertTrue(app.staticTexts["Sync Everywhere"].exists)
    }
    
    func testSignUpFlowiPad() throws {
        // Tap sign up button
        app.buttons["Don't have an account? Create one"].tap()
        
        // Verify sign up screen elements
        XCTAssertTrue(app.staticTexts["Create Account"].exists)
        XCTAssertTrue(app.textFields["Email Address"].exists)
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertTrue(app.secureTextFields["Confirm Password"].exists)
        XCTAssertTrue(app.buttons["Create Account"].exists)
        XCTAssertTrue(app.buttons["Already have an account? Sign In"].exists)
    }
    
    func testSuccessfulLoginiPad() throws {
        // Enter valid credentials
        app.textFields["Email Address"].tap()
        app.textFields["Email Address"].typeText("test@example.com")
        
        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText("password123")
        
        // Tap sign in
        app.buttons["Sign In"].tap()
        
        // Wait for main screen to load (split view interface)
        let sidebar = app.navigationBars["My Recipes"]
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: sidebar, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Verify iPad split-view interface
        XCTAssertTrue(sidebar.exists)
        XCTAssertTrue(app.staticTexts["Welcome to Recipe Archive"].exists)
    }
    
    func testInvalidLoginiPad() throws {
        // Enter invalid credentials
        app.textFields["Email Address"].tap()
        app.textFields["Email Address"].typeText("invalid-email")
        
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
    
    func testSplitViewNavigationiPad() throws {
        loginWithValidCredentials()
        
        // Verify split view components
        XCTAssertTrue(app.navigationBars["My Recipes"].exists)
        XCTAssertTrue(app.staticTexts["Welcome to Recipe Archive"].exists)
        XCTAssertTrue(app.staticTexts["Select a recipe from the sidebar to get started"].exists)
        
        // Verify welcome screen features
        XCTAssertTrue(app.staticTexts["Smart Search"].exists)
        XCTAssertTrue(app.staticTexts["Easy Import"].exists)
        XCTAssertTrue(app.staticTexts["Cloud Sync"].exists)
    }
    
    func testRecipeListSidebariPad() throws {
        loginWithValidCredentials()
        
        // Wait for recipes to load in sidebar
        let recipeCell = app.collectionViews.cells.firstMatch
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: recipeCell, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Verify sidebar elements
        XCTAssertTrue(app.searchFields.element.exists)
        XCTAssertTrue(recipeCell.exists)
        XCTAssertTrue(app.navigationBars["My Recipes"].buttons.element(matching: .button, identifier: "plus.circle.fill").exists)
    }
    
    func testSearchFunctionalityiPad() throws {
        loginWithValidCredentials()
        
        // Wait for recipes to load
        let searchField = app.searchFields.element
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: searchField, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Test search with iPad-specific search bar
        searchField.tap()
        searchField.typeText("chocolate")
        
        // Wait a moment for search to filter
        Thread.sleep(forTimeInterval: 1.0)
        
        // Verify search results
        let recipeCells = app.collectionViews.cells
        XCTAssertGreaterThan(recipeCells.count, 0)
        
        // Clear search
        if app.buttons["xmark.circle.fill"].exists {
            app.buttons["xmark.circle.fill"].tap()
        }
    }
    
    func testRecipeSelectioniPad() throws {
        loginWithValidCredentials()
        
        // Wait for recipes to load and select first recipe
        let firstRecipe = app.collectionViews.cells.firstMatch
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: firstRecipe, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        firstRecipe.tap()
        
        // Wait for detail view to load in the detail pane
        let ingredientsSection = app.staticTexts["Ingredients"]
        let detailExists = NSPredicate(format: "exists == true")
        expectation(for: detailExists, evaluatedWith: ingredientsSection, handler: nil)
        waitForExpectations(timeout: 3, handler: nil)
        
        // Verify detail view elements in split view
        XCTAssertTrue(ingredientsSection.exists)
        XCTAssertTrue(app.staticTexts["Instructions"].exists)
        
        // Verify iPad-specific detail layout (two columns)
        XCTAssertTrue(app.staticTexts["Classic Chocolate Chip Cookies"].exists)
    }
    
    func testAddRecipeFlowiPad() throws {
        loginWithValidCredentials()
        
        // Tap add recipe button
        app.navigationBars["My Recipes"].buttons.element(matching: .button, identifier: "plus.circle.fill").tap()
        
        // Verify iPad-specific add recipe layout
        XCTAssertTrue(app.navigationBars["Add New Recipe"].exists)
        XCTAssertTrue(app.staticTexts["Basic Information"].exists)
        XCTAssertTrue(app.staticTexts["Recipe Details"].exists)
        XCTAssertTrue(app.staticTexts["Ingredients"].exists)
        XCTAssertTrue(app.staticTexts["Instructions"].exists)
        
        // Test form fields
        XCTAssertTrue(app.textFields["Enter recipe name"].exists)
        XCTAssertTrue(app.buttons["Cancel"].exists)
        XCTAssertTrue(app.buttons["Save Recipe"].exists)
        
        // Test cancel functionality
        app.buttons["Cancel"].tap()
        XCTAssertTrue(app.navigationBars["My Recipes"].exists)
    }
    
    func testAddRecipeFormFilloutipAd() throws {
        loginWithValidCredentials()
        
        // Open add recipe form
        app.navigationBars["My Recipes"].buttons.element(matching: .button, identifier: "plus.circle.fill").tap()
        
        // Fill out basic information
        app.textFields["Enter recipe name"].tap()
        app.textFields["Enter recipe name"].typeText("iPad Test Recipe")
        
        // Fill out servings
        let servingsField = app.textFields["4"]
        servingsField.tap()
        servingsField.clearAndTypeText("6")
        
        // Fill ingredients (scroll to find text editor)
        let ingredientsEditor = app.textViews.element(boundBy: 0)
        ingredientsEditor.tap()
        ingredientsEditor.typeText("Test ingredient 1\nTest ingredient 2")
        
        // Fill instructions
        let instructionsEditor = app.textViews.element(boundBy: 1)
        instructionsEditor.tap()
        instructionsEditor.typeText("Test step 1\nTest step 2")
        
        // Save recipe
        app.buttons["Save Recipe"].tap()
        
        // Verify return to main screen
        XCTAssertTrue(app.navigationBars["My Recipes"].exists)
    }
    
    func testProfileViewiPad() throws {
        loginWithValidCredentials()
        
        // Tap profile button in toolbar
        app.navigationBars["My Recipes"].buttons["person.circle"].tap()
        
        // Verify iPad-specific profile layout
        XCTAssertTrue(app.navigationBars["Profile"].exists)
        XCTAssertTrue(app.staticTexts["Your Recipe Collection"].exists)
        XCTAssertTrue(app.staticTexts["Total Recipes"].exists)
        XCTAssertTrue(app.staticTexts["Favorites"].exists)
        XCTAssertTrue(app.staticTexts["Unique Tags"].exists)
        XCTAssertTrue(app.staticTexts["Preferences"].exists)
        XCTAssertTrue(app.buttons["Sign Out"].exists)
        
        // Test Done button
        app.buttons["Done"].tap()
        XCTAssertTrue(app.navigationBars["My Recipes"].exists)
    }
    
    func testSignOutFromProfileiPad() throws {
        loginWithValidCredentials()
        
        // Navigate to profile and sign out
        app.navigationBars["My Recipes"].buttons["person.circle"].tap()
        app.buttons["Sign Out"].tap()
        
        // Verify return to login screen
        let loginTitle = app.staticTexts["Recipe Archive"]
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: loginTitle, handler: nil)
        waitForExpectations(timeout: 3, handler: nil)
        
        XCTAssertTrue(loginTitle.exists)
        XCTAssertTrue(app.buttons["Sign In"].exists)
    }
    
    func testPullToRefreshiPad() throws {
        loginWithValidCredentials()
        
        // Wait for recipe list to load
        let collectionView = app.collectionViews.firstMatch
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: collectionView, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Perform pull to refresh on iPad
        let firstCell = collectionView.cells.firstMatch
        let start = firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let end = firstCell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 2.0))
        start.press(forDuration: 0, thenDragTo: end)
        
        // Verify refresh occurred
        Thread.sleep(forTimeInterval: 1.0)
    }
    
    func testiPadSpecificGestures() throws {
        loginWithValidCredentials()
        
        // Test iPad-specific interactions
        let firstRecipe = app.collectionViews.cells.firstMatch
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: firstRecipe, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
        
        // Test long press on recipe (iPad should show context menu or selection)
        firstRecipe.press(forDuration: 1.0)
        
        // Test tap to select
        firstRecipe.tap()
        
        // Verify detail view appears
        XCTAssertTrue(app.staticTexts["Ingredients"].waitForExistence(timeout: 3))
    }
    
    func testLandscapeOrientationiPad() throws {
        // Test iPad landscape orientation
        XCUIDevice.shared.orientation = .landscapeLeft
        
        loginWithValidCredentials()
        
        // Verify layout adapts to landscape
        XCTAssertTrue(app.navigationBars["My Recipes"].exists)
        XCTAssertTrue(app.staticTexts["Welcome to Recipe Archive"].exists)
        
        // Test recipe selection in landscape
        let firstRecipe = app.collectionViews.cells.firstMatch
        if firstRecipe.exists {
            firstRecipe.tap()
            XCTAssertTrue(app.staticTexts["Ingredients"].waitForExistence(timeout: 3))
        }
        
        // Return to portrait
        XCUIDevice.shared.orientation = .portrait
    }
    
    // MARK: - Helper Methods
    
    private func loginWithValidCredentials() {
        app.textFields["Email Address"].tap()
        app.textFields["Email Address"].typeText("test@example.com")
        
        app.secureTextFields["Password"].tap()
        app.secureTextFields["Password"].typeText("password123")
        
        app.buttons["Sign In"].tap()
        
        // Wait for main screen to load
        let sidebar = app.navigationBars["My Recipes"]
        let exists = NSPredicate(format: "exists == true")
        expectation(for: exists, evaluatedWith: sidebar, handler: nil)
        waitForExpectations(timeout: 5, handler: nil)
    }
}

extension XCUIElement {
    func clearAndTypeText(_ text: String) {
        tap()
        press(forDuration: 1.0)
        if app.menuItems["Select All"].exists {
            app.menuItems["Select All"].tap()
        } else {
            // Fallback: select all using keyboard shortcut
            coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            app.keys["cmd"].press(forDuration: 0, thenDragTo: app.keys["a"])
        }
        typeText(text)
    }
}