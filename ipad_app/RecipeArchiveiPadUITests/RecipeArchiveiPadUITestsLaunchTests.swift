import XCTest

final class RecipeArchiveiPadUITestsLaunchTests: XCTestCase {

    override class var runsForEachTargetApplicationUIConfiguration: Bool {
        true
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunchiPad() throws {
        let app = XCUIApplication()
        app.launch()

        // Insert steps here to perform after app launch but before taking a screenshot
        // In this example, we're waiting for the main UI elements to appear
        let recipeArchiveTitle = app.staticTexts["Recipe Archive"]
        XCTAssertTrue(recipeArchiveTitle.waitForExistence(timeout: 5))
        
        // Verify iPad-specific launch elements
        let welcomeMessage = app.staticTexts["Your personal collection of favorite recipes from around the web."]
        XCTAssertTrue(welcomeMessage.waitForExistence(timeout: 3))
        
        // Take a screenshot for launch testing
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "iPad Launch Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    
    func testLaunchPerformanceiPad() throws {
        if #available(macOS 10.15, iOS 13.0, tvOS 13.0, watchOS 7.0, *) {
            // This measures how long it takes to launch your application on iPad.
            measure(metrics: [XCTApplicationLaunchMetric()]) {
                XCUIApplication().launch()
            }
        }
    }
    
    func testOrientationLaunchiPad() throws {
        // Test launch in different orientations
        let orientations: [UIDeviceOrientation] = [.portrait, .landscapeLeft, .landscapeRight]
        
        for orientation in orientations {
            XCUIDevice.shared.orientation = orientation
            
            let app = XCUIApplication()
            app.launch()
            
            // Verify app launches correctly in each orientation
            let recipeArchiveTitle = app.staticTexts["Recipe Archive"]
            XCTAssertTrue(recipeArchiveTitle.waitForExistence(timeout: 5))
            
            // Take screenshot for each orientation
            let attachment = XCTAttachment(screenshot: app.screenshot())
            attachment.name = "iPad Launch - \(orientation.rawValue)"
            attachment.lifetime = .keepAlways
            add(attachment)
            
            app.terminate()
        }
        
        // Reset to portrait
        XCUIDevice.shared.orientation = .portrait
    }
    
    func testMultitaskingLaunchiPad() throws {
        let app = XCUIApplication()
        app.launch()
        
        // Verify app launches and is ready for multitasking
        let recipeArchiveTitle = app.staticTexts["Recipe Archive"]
        XCTAssertTrue(recipeArchiveTitle.waitForExistence(timeout: 5))
        
        // Simulate moving to background (iPad multitasking scenario)
        XCUIDevice.shared.press(.home)
        
        // Wait a moment
        Thread.sleep(forTimeInterval: 1.0)
        
        // Return to app
        app.activate()
        
        // Verify app resumed correctly
        XCTAssertTrue(recipeArchiveTitle.waitForExistence(timeout: 3))
        
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "iPad Multitasking Resume"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}