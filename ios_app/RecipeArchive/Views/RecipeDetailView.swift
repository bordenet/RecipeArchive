import SwiftUI

struct RecipeDetailView: View {
    let recipe: Recipe
    @EnvironmentObject var recipeService: RecipeService
    @State private var showingDeleteAlert = false
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header Section
                VStack(alignment: .leading, spacing: 8) {
                    Text(recipe.title)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    if let description = recipe.description {
                        Text(description)
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                    
                    // Recipe Info
                    HStack(spacing: 20) {
                        if let prepTime = recipe.prepTime {
                            InfoPill(icon: "clock", text: "Prep: \(prepTime)m")
                        }
                        
                        if let cookTime = recipe.cookingTime {
                            InfoPill(icon: "flame", text: "Cook: \(cookTime)m")
                        }
                        
                        InfoPill(icon: "person.2", text: "\(recipe.servings)")
                        
                        if let difficulty = recipe.difficulty {
                            InfoPill(icon: "star", text: difficulty)
                        }
                    }
                    
                    // Tags
                    if !recipe.tags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(recipe.tags, id: \.self) { tag in
                                    Text(tag.capitalized)
                                        .font(.caption)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(Color.blue.opacity(0.1))
                                        .foregroundColor(.blue)
                                        .cornerRadius(16)
                                }
                            }
                            .padding(.horizontal, 1)
                        }
                    }
                }
                .padding(.horizontal)
                
                Divider()
                
                // Ingredients Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("Ingredients")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .padding(.horizontal)
                    
                    ForEach(Array(recipe.ingredients.enumerated()), id: \.offset) { index, ingredient in
                        HStack(alignment: .top) {
                            Circle()
                                .fill(Color.blue)
                                .frame(width: 6, height: 6)
                                .padding(.top, 8)
                            
                            Text(ingredient.text)
                                .font(.body)
                        }
                        .padding(.horizontal)
                    }
                }
                
                Divider()
                
                // Instructions Section
                VStack(alignment: .leading, spacing: 16) {
                    Text("Instructions")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .padding(.horizontal)
                    
                    ForEach(recipe.instructions, id: \.stepNumber) { instruction in
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(instruction.stepNumber)")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(width: 24, height: 24)
                                .background(Color.blue)
                                .clipShape(Circle())
                            
                            Text(instruction.text)
                                .font(.body)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.horizontal)
                    }
                }
                
                // Source Information
                if let sourceName = recipe.sourceName {
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Source")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        HStack {
                            Text(sourceName)
                                .font(.body)
                                .foregroundColor(.secondary)
                            
                            Spacer()
                            
                            if let sourceUrl = recipe.sourceUrl {
                                Link("View Original", destination: URL(string: sourceUrl)!)
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Delete") {
                    showingDeleteAlert = true
                }
                .foregroundColor(.red)
            }
        }
        .alert("Delete Recipe", isPresented: $showingDeleteAlert) {
            Button("Delete", role: .destructive) {
                recipeService.deleteRecipe(recipe)
                presentationMode.wrappedValue.dismiss()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Are you sure you want to delete \"\(recipe.title)\"? This action cannot be undone.")
        }
    }
}

struct InfoPill: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
            Text(text)
                .font(.caption)
        }
        .foregroundColor(.secondary)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

#Preview {
    NavigationView {
        RecipeDetailView(recipe: Recipe.sample)
            .environmentObject(RecipeService())
    }
}