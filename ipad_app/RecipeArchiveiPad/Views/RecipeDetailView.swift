import SwiftUI

struct RecipeDetailView: View {
    let recipe: Recipe
    var isInSplitView: Bool = false
    @EnvironmentObject var recipeService: RecipeService
    @State private var showingDeleteAlert = false
    @State private var showingEditView = false
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Header section with larger iPad layout
                iPadRecipeHeader(recipe: recipe)
                
                Divider()
                    .padding(.vertical, 20)
                
                HStack(alignment: .top, spacing: 40) {
                    // Left column - Ingredients
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Ingredients")
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        LazyVStack(alignment: .leading, spacing: 12) {
                            ForEach(Array(recipe.ingredients.enumerated()), id: \.offset) { index, ingredient in
                                HStack(alignment: .top, spacing: 12) {
                                    Circle()
                                        .fill(Color.blue)
                                        .frame(width: 8, height: 8)
                                        .padding(.top, 8)
                                    
                                    Text(ingredient.text)
                                        .font(.body)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                    // Right column - Instructions
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Instructions")
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        LazyVStack(alignment: .leading, spacing: 20) {
                            ForEach(recipe.instructions, id: \.stepNumber) { instruction in
                                HStack(alignment: .top, spacing: 16) {
                                    Text("\(instruction.stepNumber)")
                                        .font(.headline)
                                        .fontWeight(.bold)
                                        .foregroundColor(.white)
                                        .frame(width: 32, height: 32)
                                        .background(Color.blue)
                                        .clipShape(Circle())
                                    
                                    Text(instruction.text)
                                        .font(.body)
                                        .fixedSize(horizontal: false, vertical: true)
                                        .lineLimit(nil)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 30)
                
                // Source information
                if let sourceName = recipe.sourceName {
                    Divider()
                        .padding(.vertical, 20)
                    
                    HStack {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Source")
                                .font(.headline)
                            
                            Text(sourceName)
                                .font(.body)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        if let sourceUrl = recipe.sourceUrl {
                            Link("View Original", destination: URL(string: sourceUrl)!)
                                .font(.body)
                                .foregroundColor(.blue)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color.blue.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                    .padding(.horizontal, 30)
                }
                
                // Bottom padding
                Rectangle()
                    .fill(Color.clear)
                    .frame(height: 30)
            }
        }
        .navigationBarTitleDisplayMode(.never)
        .toolbar {
            if !isInSplitView {
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    Button("Edit") {
                        showingEditView = true
                    }
                    
                    Button("Delete") {
                        showingDeleteAlert = true
                    }
                    .foregroundColor(.red)
                }
            } else {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("Edit Recipe") {
                            showingEditView = true
                        }
                        
                        Button("Delete Recipe", role: .destructive) {
                            showingDeleteAlert = true
                        }
                        
                        if let sourceUrl = recipe.sourceUrl {
                            Link("View Original", destination: URL(string: sourceUrl)!)
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.title2)
                    }
                }
            }
        }
        .sheet(isPresented: $showingEditView) {
            RecipeEditView(recipe: recipe)
        }
        .alert("Delete Recipe", isPresented: $showingDeleteAlert) {
            Button("Delete", role: .destructive) {
                recipeService.deleteRecipe(recipe)
                if !isInSplitView {
                    presentationMode.wrappedValue.dismiss()
                }
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Are you sure you want to delete \"\(recipe.title)\"? This action cannot be undone.")
        }
    }
}

struct iPadRecipeHeader: View {
    let recipe: Recipe
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Title and description
            VStack(alignment: .leading, spacing: 12) {
                Text(recipe.title)
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .lineLimit(nil)
                
                if let description = recipe.description {
                    Text(description)
                        .font(.title3)
                        .foregroundColor(.secondary)
                        .lineLimit(nil)
                }
            }
            
            // Recipe metadata in a grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], alignment: .leading, spacing: 16) {
                
                if let prepTime = recipe.prepTime {
                    iPadMetricPill(icon: "clock.fill", label: "Prep", value: "\(prepTime)m", color: .blue)
                }
                
                if let cookTime = recipe.cookingTime {
                    iPadMetricPill(icon: "flame.fill", label: "Cook", value: "\(cookTime)m", color: .orange)
                }
                
                iPadMetricPill(icon: "person.2.fill", label: "Serves", value: "\(recipe.servings)", color: .green)
                
                if let difficulty = recipe.difficulty {
                    iPadMetricPill(icon: "star.fill", label: "Level", value: difficulty, color: difficultyColor(difficulty))
                }
                
                if let cuisine = recipe.cuisine {
                    iPadMetricPill(icon: "globe", label: "Cuisine", value: cuisine, color: .purple)
                }
            }
            
            // Tags
            if !recipe.tags.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Tags")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 80))
                    ], alignment: .leading, spacing: 8) {
                        ForEach(recipe.tags, id: \.self) { tag in
                            Text(tag.capitalized)
                                .font(.caption)
                                .fontWeight(.medium)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.blue.opacity(0.1))
                                .foregroundColor(.blue)
                                .cornerRadius(12)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 30)
        .padding(.vertical, 20)
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

struct iPadMetricPill: View {
    let icon: String
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .textCase(.uppercase)
                
                Text(value)
                    .font(.caption)
                    .fontWeight(.semibold)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
}

#Preview {
    NavigationView {
        RecipeDetailView(recipe: Recipe.sample, isInSplitView: true)
            .environmentObject(RecipeService())
    }
}