import XCTest
import Combine
@testable import RecipeArchive

final class AuthServiceTests: XCTestCase {
    var authService: AuthService!
    var cancellables: Set<AnyCancellable>!
    
    override func setUpWithError() throws {
        authService = AuthService()
        cancellables = Set<AnyCancellable>()
        
        // Clear any existing authentication state
        authService.signOut()
    }
    
    override func tearDownWithError() throws {
        authService = nil
        cancellables = nil
    }
    
    func testInitialState() throws {
        XCTAssertNil(authService.currentUser)
        XCTAssertFalse(authService.isAuthenticated)
        XCTAssertFalse(authService.isLoading)
        XCTAssertNil(authService.errorMessage)
    }
    
    func testSignInValidation() throws {
        let expectation = XCTestExpectation(description: "Sign in validation")
        
        authService.signIn(email: "", password: "")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            XCTAssertNotNil(self.authService.errorMessage)
            XCTAssertEqual(self.authService.errorMessage, "Email and password are required")
            XCTAssertFalse(self.authService.isAuthenticated)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testSuccessfulSignIn() throws {
        let expectation = XCTestExpectation(description: "Successful sign in")
        
        authService.$isAuthenticated
            .dropFirst()
            .sink { isAuthenticated in
                if isAuthenticated {
                    XCTAssertNotNil(self.authService.currentUser)
                    XCTAssertEqual(self.authService.currentUser?.email, "test@example.com")
                    XCTAssertNil(self.authService.errorMessage)
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        authService.signIn(email: "test@example.com", password: "password123")
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testFailedSignIn() throws {
        let expectation = XCTestExpectation(description: "Failed sign in")
        
        authService.signIn(email: "invalid-email", password: "short")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            XCTAssertFalse(self.authService.isAuthenticated)
            XCTAssertNil(self.authService.currentUser)
            XCTAssertNotNil(self.authService.errorMessage)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testSignUpValidation() throws {
        let expectation = XCTestExpectation(description: "Sign up validation")
        
        authService.signUp(email: "", password: "", confirmPassword: "")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            XCTAssertNotNil(self.authService.errorMessage)
            XCTAssertEqual(self.authService.errorMessage, "All fields are required")
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testSignUpPasswordMismatch() throws {
        let expectation = XCTestExpectation(description: "Password mismatch")
        
        authService.signUp(email: "test@example.com", password: "password123", confirmPassword: "different")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            XCTAssertNotNil(self.authService.errorMessage)
            XCTAssertEqual(self.authService.errorMessage, "Passwords do not match")
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testSignUpShortPassword() throws {
        let expectation = XCTestExpectation(description: "Short password")
        
        authService.signUp(email: "test@example.com", password: "short", confirmPassword: "short")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            XCTAssertNotNil(self.authService.errorMessage)
            XCTAssertEqual(self.authService.errorMessage, "Password must be at least 8 characters")
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testSuccessfulSignUp() throws {
        let expectation = XCTestExpectation(description: "Successful sign up")
        
        authService.$isAuthenticated
            .dropFirst()
            .sink { isAuthenticated in
                if isAuthenticated {
                    XCTAssertNotNil(self.authService.currentUser)
                    XCTAssertEqual(self.authService.currentUser?.email, "newuser@example.com")
                    XCTAssertNil(self.authService.errorMessage)
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        authService.signUp(email: "newuser@example.com", password: "password123", confirmPassword: "password123")
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testSignOut() throws {
        // First sign in
        let signInExpectation = XCTestExpectation(description: "Sign in")
        
        authService.$isAuthenticated
            .dropFirst()
            .sink { isAuthenticated in
                if isAuthenticated {
                    signInExpectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        authService.signIn(email: "test@example.com", password: "password123")
        wait(for: [signInExpectation], timeout: 3.0)
        
        // Then sign out
        authService.signOut()
        
        XCTAssertFalse(authService.isAuthenticated)
        XCTAssertNil(authService.currentUser)
    }
    
    func testLoadingState() throws {
        XCTAssertFalse(authService.isLoading)
        
        authService.signIn(email: "test@example.com", password: "password123")
        
        // Should be loading immediately after sign in call
        XCTAssertTrue(authService.isLoading)
        
        let expectation = XCTestExpectation(description: "Loading complete")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            XCTAssertFalse(self.authService.isLoading)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 3.0)
    }
}