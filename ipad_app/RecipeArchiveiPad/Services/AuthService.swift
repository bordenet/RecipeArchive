import Foundation
import Combine

class AuthService: ObservableObject {
    @Published var currentUser: User?
    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        checkAuthenticationStatus()
    }
    
    func signIn(email: String, password: String) {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Email and password are required"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        // Simulate AWS Cognito authentication
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            if email.contains("@") && password.count >= 6 {
                let user = User(
                    id: UUID().uuidString,
                    email: email,
                    username: email.components(separatedBy: "@").first,
                    lastLoginAt: Date()
                )
                self.currentUser = user
                self.isAuthenticated = true
                self.saveAuthenticationState()
            } else {
                self.errorMessage = "Invalid email or password"
            }
            self.isLoading = false
        }
    }
    
    func signUp(email: String, password: String, confirmPassword: String) {
        guard !email.isEmpty, !password.isEmpty, !confirmPassword.isEmpty else {
            errorMessage = "All fields are required"
            return
        }
        
        guard password == confirmPassword else {
            errorMessage = "Passwords do not match"
            return
        }
        
        guard password.count >= 8 else {
            errorMessage = "Password must be at least 8 characters"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        // Simulate AWS Cognito user creation
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if email.contains("@") {
                let user = User(
                    id: UUID().uuidString,
                    email: email,
                    username: email.components(separatedBy: "@").first
                )
                self.currentUser = user
                self.isAuthenticated = true
                self.saveAuthenticationState()
            } else {
                self.errorMessage = "Invalid email format"
            }
            self.isLoading = false
        }
    }
    
    func signOut() {
        currentUser = nil
        isAuthenticated = false
        clearAuthenticationState()
    }
    
    private func checkAuthenticationStatus() {
        // Check UserDefaults for saved authentication state
        if let userData = UserDefaults.standard.data(forKey: "currentUser"),
           let user = try? JSONDecoder().decode(User.self, from: userData) {
            currentUser = user
            isAuthenticated = true
        }
    }
    
    private func saveAuthenticationState() {
        if let user = currentUser,
           let userData = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(userData, forKey: "currentUser")
        }
    }
    
    private func clearAuthenticationState() {
        UserDefaults.standard.removeObject(forKey: "currentUser")
    }
}