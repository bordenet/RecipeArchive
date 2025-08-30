import SwiftUI

@main
struct RecipeArchiveApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(AuthService())
                .environmentObject(RecipeService())
        }
    }
}