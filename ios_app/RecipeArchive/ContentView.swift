import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authService: AuthService
    
    var body: some View {
        Group {
            if authService.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut, value: authService.isAuthenticated)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            RecipeListView()
                .tabItem {
                    Image(systemName: "list.bullet")
                    Text("Recipes")
                }
            
            ProfileView()
                .tabItem {
                    Image(systemName: "person.circle")
                    Text("Profile")
                }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthService())
        .environmentObject(RecipeService())
}