import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var recipeService: RecipeService
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 30) {
                    // User profile section
                    iPadUserProfileSection()
                    
                    // Statistics section
                    iPadStatsSection()
                    
                    // Settings section
                    iPadSettingsSection()
                    
                    // Account actions
                    iPadAccountSection()
                }
                .padding(.horizontal, 40)
                .padding(.vertical, 30)
            }
            .navigationTitle("Profile")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    private func iPadUserProfileSection() -> some View {
        HStack(spacing: 24) {
            // Profile avatar
            Image(systemName: "person.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.blue)
            
            // User info
            VStack(alignment: .leading, spacing: 8) {
                if let user = authService.currentUser {
                    Text(user.username ?? "User")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text(user.email)
                        .font(.body)
                        .foregroundColor(.secondary)
                    
                    Text("Member since \(user.createdAt, formatter: dateFormatter)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
        }
        .padding(24)
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
    
    @ViewBuilder
    private func iPadStatsSection() -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Your Recipe Collection")
                .font(.title2)
                .fontWeight(.bold)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                
                iPadStatCard(
                    icon: "book.fill",
                    title: "Total Recipes",
                    value: "\(recipeService.recipes.count)",
                    color: .blue
                )
                
                iPadStatCard(
                    icon: "heart.fill",
                    title: "Favorites",
                    value: "0",
                    color: .red
                )
                
                iPadStatCard(
                    icon: "tag.fill",
                    title: "Unique Tags",
                    value: "\(uniqueTagsCount)",
                    color: .green
                )
            }
        }
    }
    
    @ViewBuilder
    private func iPadSettingsSection() -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Preferences")
                .font(.title2)
                .fontWeight(.bold)
            
            VStack(spacing: 16) {
                iPadPreferenceRow(
                    icon: "clock.fill",
                    title: "Show Preparation Times",
                    subtitle: "Display prep and cook times in recipe lists",
                    isOn: .constant(true)
                )
                
                iPadPreferenceRow(
                    icon: "star.fill",
                    title: "Show Difficulty Levels",
                    subtitle: "Display recipe difficulty indicators",
                    isOn: .constant(true)
                )
                
                iPadPreferenceRow(
                    icon: "icloud.fill",
                    title: "Automatic Sync",
                    subtitle: "Keep recipes synchronized across devices",
                    isOn: .constant(true)
                )
            }
            .padding(20)
            .background(Color(.systemGray6))
            .cornerRadius(16)
        }
    }
    
    @ViewBuilder
    private func iPadAccountSection() -> some View {
        VStack(spacing: 16) {
            Button(action: {
                recipeService.refreshRecipes()
            }) {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("Refresh Recipes")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.blue.opacity(0.1))
                .foregroundColor(.blue)
                .cornerRadius(12)
            }
            
            Button(action: {
                authService.signOut()
                presentationMode.wrappedValue.dismiss()
            }) {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                    Text("Sign Out")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.red.opacity(0.1))
                .foregroundColor(.red)
                .cornerRadius(12)
            }
        }
    }
    
    private var uniqueTagsCount: Int {
        let allTags = recipeService.recipes.flatMap { $0.tags }
        return Set(allTags).count
    }
    
    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter
    }
}

struct iPadStatCard: View {
    let icon: String
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(color)
            
            VStack(spacing: 4) {
                Text(value)
                    .font(.title)
                    .fontWeight(.bold)
                
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct iPadPreferenceRow: View {
    let icon: String
    let title: String
    let subtitle: String
    @Binding var isOn: Bool
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .labelsHidden()
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject(AuthService())
        .environmentObject(RecipeService())
}