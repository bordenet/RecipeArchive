import SwiftUI

struct RecipeListSidebar: View {
    @EnvironmentObject var recipeService: RecipeService
    @Binding var selectedRecipe: Recipe?
    @State private var showingAddRecipe = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                iPadSearchBar(text: $recipeService.searchText)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                
                // Recipe list
                Group {
                    if recipeService.isLoading {
                        VStack {
                            ProgressView("Loading recipes...")
                                .padding()
                            Spacer()
                        }
                    } else if recipeService.recipes.isEmpty {
                        iPadEmptyStateView()
                    } else {
                        List(recipeService.recipes, selection: $selectedRecipe) { recipe in
                            iPadRecipeRowView(recipe: recipe)
                                .tag(recipe)
                        }
                        .listStyle(SidebarListStyle())
                        .refreshable {
                            recipeService.refreshRecipes()
                        }
                    }
                }
                
                if let errorMessage = recipeService.errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .padding()
                        .background(Color(.systemBackground))
                }
            }
            .navigationTitle("My Recipes")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        showingAddRecipe = true
                    }) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                    }
                }
            }
            .sheet(isPresented: $showingAddRecipe) {
                AddRecipeView()
            }
        }
    }
}

struct iPadSearchBar: View {
    @Binding var text: String
    
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
                .font(.system(size: 16, weight: .medium))
            
            TextField("Search recipes, ingredients, cuisine...", text: $text)
                .textFieldStyle(PlainTextFieldStyle())
                .font(.body)
            
            if !text.isEmpty {
                Button(action: {
                    text = ""
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                        .font(.system(size: 16))
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
}

struct iPadRecipeRowView: View {
    let recipe: Recipe
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(recipe.title)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .lineLimit(2)
                
                Spacer()
                
                if let difficulty = recipe.difficulty {
                    Text(difficulty)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(difficultyColor(difficulty).opacity(0.2))
                        .foregroundColor(difficultyColor(difficulty))
                        .cornerRadius(8)
                }
            }
            
            if let description = recipe.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            HStack {
                if let totalTime = recipe.totalTime {
                    Label("\(totalTime)min", systemImage: "clock")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Label("\(recipe.servings)", systemImage: "person.2")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                if let cuisine = recipe.cuisine {
                    Label(cuisine, systemImage: "globe")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            
            if !recipe.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(recipe.tags.prefix(3), id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(Color.blue.opacity(0.1))
                                .foregroundColor(.blue)
                                .cornerRadius(6)
                        }
                        
                        if recipe.tags.count > 3 {
                            Text("+\(recipe.tags.count - 3)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
    
    private func difficultyColor(_ difficulty: String) -> Color {
        switch difficulty.lowercased() {
        case "easy": return .green
        case "medium": return .orange
        case "hard": return .red
        default: return .gray
        }
    }
}

struct iPadEmptyStateView: View {
    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "book.pages")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            VStack(spacing: 8) {
                Text("No Recipes Yet")
                    .font(.title2)
                    .fontWeight(.medium)
                
                Text("Start building your collection by adding your first recipe!")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }
}

#Preview {
    NavigationSplitView {
        RecipeListSidebar(selectedRecipe: .constant(nil))
            .environmentObject(RecipeService())
    } detail: {
        Text("Select a recipe")
    }
}