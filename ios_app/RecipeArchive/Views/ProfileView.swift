import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var recipeService: RecipeService
    
    var body: some View {
        NavigationView {
            List {
                // User Info Section
                Section {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 50))
                            .foregroundColor(.blue)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            if let user = authService.currentUser {
                                Text(user.username ?? "User")
                                    .font(.title2)
                                    .fontWeight(.semibold)
                                
                                Text(user.email)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        Spacer()
                    }
                    .padding(.vertical, 8)
                }
                
                // Stats Section
                Section(header: Text("Statistics")) {
                    HStack {
                        Image(systemName: "book.fill")
                            .foregroundColor(.blue)
                        Text("Total Recipes")
                        Spacer()
                        Text("\(recipeService.recipes.count)")
                            .fontWeight(.semibold)
                    }
                    
                    HStack {
                        Image(systemName: "heart.fill")
                            .foregroundColor(.red)
                        Text("Favorite Recipes")
                        Spacer()
                        Text("0")
                            .fontWeight(.semibold)
                    }
                    
                    HStack {
                        Image(systemName: "tag.fill")
                            .foregroundColor(.green)
                        Text("Unique Tags")
                        Spacer()
                        Text("\(uniqueTagsCount)")
                            .fontWeight(.semibold)
                    }
                }
                
                // Settings Section
                Section(header: Text("Settings")) {
                    NavigationLink(destination: SettingsView()) {
                        HStack {
                            Image(systemName: "gear")
                                .foregroundColor(.gray)
                            Text("App Settings")
                        }
                    }
                    
                    NavigationLink(destination: AboutView()) {
                        HStack {
                            Image(systemName: "info.circle")
                                .foregroundColor(.blue)
                            Text("About")
                        }
                    }
                }
                
                // Account Section
                Section {
                    Button(action: {
                        authService.signOut()
                    }) {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .foregroundColor(.red)
                            Text("Sign Out")
                                .foregroundColor(.red)
                        }
                    }
                }
            }
            .navigationTitle("Profile")
        }
    }
    
    private var uniqueTagsCount: Int {
        let allTags = recipeService.recipes.flatMap { $0.tags }
        return Set(allTags).count
    }
}

struct SettingsView: View {
    @AppStorage("showPrepTime") private var showPrepTime = true
    @AppStorage("showDifficulty") private var showDifficulty = true
    @AppStorage("defaultServings") private var defaultServings = 4
    
    var body: some View {
        Form {
            Section(header: Text("Display Options")) {
                Toggle("Show Prep Time", isOn: $showPrepTime)
                Toggle("Show Difficulty", isOn: $showDifficulty)
            }
            
            Section(header: Text("Defaults")) {
                Stepper("Default Servings: \(defaultServings)", value: $defaultServings, in: 1...12)
            }
            
            Section(header: Text("Data")) {
                Button("Refresh Recipes") {
                    // Refresh action would go here
                }
                .foregroundColor(.blue)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AboutView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .center, spacing: 12) {
                Image(systemName: "book.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.blue)
                
                Text("Recipe Archive")
                    .font(.title)
                    .fontWeight(.bold)
                
                Text("Version 1.0.0")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 40)
            
            VStack(alignment: .leading, spacing: 16) {
                Text("About This App")
                    .font(.headline)
                
                Text("Recipe Archive is your personal collection of favorite recipes. Save, organize, and discover new dishes from around the web.")
                    .font(.body)
                    .foregroundColor(.secondary)
                
                Text("Features:")
                    .font(.headline)
                    .padding(.top)
                
                VStack(alignment: .leading, spacing: 8) {
                    FeatureRow(icon: "square.and.arrow.down", text: "Save recipes from any website")
                    FeatureRow(icon: "magnifyingglass", text: "Search your recipe collection")
                    FeatureRow(icon: "tag", text: "Organize with tags and categories")
                    FeatureRow(icon: "icloud", text: "Sync across all your devices")
                }
            }
            .padding(.horizontal)
            
            Spacer()
        }
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct FeatureRow: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 20)
            Text(text)
                .font(.body)
            Spacer()
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject(AuthService())
        .environmentObject(RecipeService())
}