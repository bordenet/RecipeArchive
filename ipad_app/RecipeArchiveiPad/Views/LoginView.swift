import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authService: AuthService
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    @State private var isSignUp: Bool = false
    
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // Left side - Welcome content
                VStack(alignment: .leading, spacing: 30) {
                    VStack(alignment: .leading, spacing: 16) {
                        Image(systemName: "book.pages.fill")
                            .font(.system(size: 80))
                            .foregroundColor(.blue)
                        
                        Text("Recipe Archive")
                            .font(.system(size: 48, weight: .bold, design: .rounded))
                            .foregroundColor(.primary)
                        
                        Text("Your personal collection of favorite recipes from around the web.")
                            .font(.title2)
                            .foregroundColor(.secondary)
                            .lineLimit(nil)
                    }
                    
                    VStack(alignment: .leading, spacing: 20) {
                        iPadLoginFeature(
                            icon: "square.and.arrow.down.fill",
                            title: "Save Recipes",
                            description: "Import recipes from any website with just a click"
                        )
                        
                        iPadLoginFeature(
                            icon: "magnifyingglass.circle.fill",
                            title: "Smart Search",
                            description: "Find recipes by ingredients, cuisine, or dietary preferences"
                        )
                        
                        iPadLoginFeature(
                            icon: "icloud.fill",
                            title: "Sync Everywhere",
                            description: "Access your collection on all your devices"
                        )
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(60)
                .background(Color(.systemGray6))
                
                // Right side - Login form
                VStack(spacing: 0) {
                    Spacer()
                    
                    VStack(spacing: 24) {
                        Text(isSignUp ? "Create Account" : "Welcome Back")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        VStack(spacing: 16) {
                            TextField("Email Address", text: $email)
                                .textFieldStyle(iPadTextFieldStyle())
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                            
                            SecureField("Password", text: $password)
                                .textFieldStyle(iPadTextFieldStyle())
                                .textContentType(.password)
                            
                            if isSignUp {
                                SecureField("Confirm Password", text: $confirmPassword)
                                    .textFieldStyle(iPadTextFieldStyle())
                                    .textContentType(.newPassword)
                            }
                            
                            if let errorMessage = authService.errorMessage {
                                Text(errorMessage)
                                    .foregroundColor(.red)
                                    .font(.body)
                                    .multilineTextAlignment(.center)
                            }
                        }
                        
                        Button(action: {
                            if isSignUp {
                                authService.signUp(email: email, password: password, confirmPassword: confirmPassword)
                            } else {
                                authService.signIn(email: email, password: password)
                            }
                        }) {
                            HStack {
                                if authService.isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                        .scaleEffect(0.9)
                                }
                                Text(isSignUp ? "Create Account" : "Sign In")
                                    .fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(authService.isLoading)
                        
                        Button(action: {
                            isSignUp.toggle()
                            authService.errorMessage = nil
                        }) {
                            Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Create one")
                                .font(.body)
                                .foregroundColor(.blue)
                        }
                    }
                    .frame(maxWidth: 400)
                    .padding(40)
                    
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .background(Color(.systemBackground))
            }
        }
        .animation(.easeInOut, value: isSignUp)
    }
}

struct iPadLoginFeature: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 20) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(.blue)
                .frame(width: 40)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text(description)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .lineLimit(nil)
            }
            
            Spacer()
        }
    }
}

struct iPadTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(.systemGray6))
            .cornerRadius(10)
            .font(.body)
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthService())
}