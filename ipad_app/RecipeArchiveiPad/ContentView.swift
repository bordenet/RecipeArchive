import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authService: AuthService
    
    var body: some View {
        Group {
            if authService.isAuthenticated {
                iPadMainView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut, value: authService.isAuthenticated)
    }
}

struct iPadMainView: View {
    @State private var selectedRecipe: Recipe? = nil
    @State private var showingProfile = false
    
    var body: some View {
        NavigationSplitView {
            // Sidebar with recipe list
            RecipeListSidebar(selectedRecipe: $selectedRecipe)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(action: {
                            showingProfile = true
                        }) {
                            Image(systemName: "person.circle")
                                .font(.title2)
                        }
                    }
                }
        } detail: {
            // Detail view showing selected recipe or welcome screen
            Group {
                if let recipe = selectedRecipe {
                    RecipeDetailView(recipe: recipe, isInSplitView: true)
                } else {
                    iPadWelcomeView()
                }
            }
        }
        .sheet(isPresented: $showingProfile) {
            ProfileView()
        }
    }
}

struct iPadWelcomeView: View {
    var body: some View {
        VStack(spacing: 30) {
            Image(systemName: "book.pages")
                .font(.system(size: 80))
                .foregroundColor(.blue.opacity(0.6))
            
            Text("Welcome to Recipe Archive")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("Select a recipe from the sidebar to get started")
                .font(.title2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            VStack(spacing: 16) {
                iPadFeatureRow(
                    icon: "magnifyingglass",
                    title: "Smart Search",
                    description: "Find recipes by ingredients, cuisine, or tags"
                )
                
                iPadFeatureRow(
                    icon: "square.and.arrow.down",
                    title: "Easy Import",
                    description: "Save recipes from your favorite websites"
                )
                
                iPadFeatureRow(
                    icon: "icloud.and.arrow.up",
                    title: "Cloud Sync",
                    description: "Access your recipes across all devices"
                )
            }
            .padding(.top, 20)
        }
        .frame(maxWidth: 600)
        .padding(40)
    }
}

struct iPadFeatureRow: View {
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
            }
            
            Spacer()
        }
        .padding(.horizontal)
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthService())
        .environmentObject(RecipeService())
}