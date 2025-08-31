import SwiftUI

struct RecipeEditView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: RecipeEditViewModel
    
    init(recipe: Recipe) {
        _viewModel = StateObject(wrappedValue: RecipeEditViewModel(recipe: recipe))
    }
    
    var body: some View {
        NavigationView {
            TabView {
                // Basic Info Tab
                BasicInfoTab()
                    .tabItem {
                        Image(systemName: "info.circle")
                        Text("Basic Info")
                    }
                
                // Ingredients Tab
                IngredientsTab()
                    .tabItem {
                        Image(systemName: "list.bullet")
                        Text("Ingredients")
                    }
                
                // Instructions Tab
                InstructionsTab()
                    .tabItem {
                        Image(systemName: "list.number")
                        Text("Instructions")
                    }
                
                // Personal Tab
                PersonalTab()
                    .tabItem {
                        Image(systemName: "person.circle")
                        Text("Personal")
                    }
            }
            .environmentObject(viewModel)
            .navigationTitle("Edit Recipe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        if viewModel.hasUnsavedChanges {
                            viewModel.showingUnsavedChangesAlert = true
                        } else {
                            dismiss()
                        }
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            await viewModel.saveRecipe()
                            if viewModel.saveSuccessful {
                                dismiss()
                            }
                        }
                    }
                    .disabled(!viewModel.hasUnsavedChanges || viewModel.isLoading)
                }
            }
        }
        .alert("Unsaved Changes", isPresented: $viewModel.showingUnsavedChangesAlert) {
            Button("Discard Changes", role: .destructive) {
                dismiss()
            }
            Button("Keep Editing", role: .cancel) { }
        } message: {
            Text("You have unsaved changes. Are you sure you want to discard them?")
        }
        .alert("Error", isPresented: $viewModel.showingErrorAlert) {
            Button("OK") { }
        } message: {
            Text(viewModel.errorMessage)
        }
    }
}

// MARK: - Basic Info Tab
struct BasicInfoTab: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Group {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Recipe Title")
                            .font(.headline)
                        TextField("Enter recipe title", text: $viewModel.title)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(.headline)
                        TextField("Enter recipe description", text: $viewModel.description, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3...6)
                    }
                    
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Prep Time (min)")
                                .font(.headline)
                            TextField("15", value: $viewModel.prepTime, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.numberPad)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Cook Time (min)")
                                .font(.headline)
                            TextField("30", value: $viewModel.cookingTime, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.numberPad)
                        }
                    }
                    
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Servings")
                                .font(.headline)
                            TextField("4", value: $viewModel.servings, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .keyboardType(.numberPad)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Difficulty")
                                .font(.headline)
                            TextField("Easy", text: $viewModel.difficulty)
                                .textFieldStyle(.roundedBorder)
                        }
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Cuisine")
                            .font(.headline)
                        TextField("Enter cuisine type", text: $viewModel.cuisine)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    TagsSection()
                }
            }
            .padding()
        }
    }
}

// MARK: - Tags Section
struct TagsSection: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    @State private var newTag = ""
    @State private var showingAddTag = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Tags")
                    .font(.headline)
                
                Spacer()
                
                Button("Add Tag") {
                    showingAddTag = true
                }
                .font(.caption)
                .buttonStyle(.borderedProminent)
            }
            
            if !viewModel.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.tags, id: \.self) { tag in
                            TagChip(tag: tag) {
                                viewModel.removeTag(tag)
                            }
                        }
                    }
                    .padding(.horizontal, 4)
                }
            } else {
                Text("No tags added")
                    .foregroundColor(.secondary)
                    .font(.caption)
            }
        }
        .alert("Add Tag", isPresented: $showingAddTag) {
            TextField("Tag name", text: $newTag)
            Button("Add") {
                if !newTag.isEmpty {
                    viewModel.addTag(newTag.trimmingCharacters(in: .whitespacesAndNewlines))
                    newTag = ""
                }
            }
            Button("Cancel", role: .cancel) {
                newTag = ""
            }
        }
    }
}

// MARK: - Ingredients Tab
struct IngredientsTab: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Ingredients")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Spacer()
                
                Button("Add Ingredient") {
                    viewModel.addIngredient()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.horizontal)
            
            List {
                ForEach(Array(viewModel.ingredients.enumerated()), id: \.offset) { index, ingredient in
                    HStack {
                        Text("\(index + 1).")
                            .fontWeight(.semibold)
                            .frame(width: 30, alignment: .leading)
                        
                        TextField("Enter ingredient", text: $viewModel.ingredients[index])
                            .textFieldStyle(.roundedBorder)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button("Delete", role: .destructive) {
                            viewModel.removeIngredient(at: index)
                        }
                    }
                }
                .onMove(perform: viewModel.moveIngredient)
            }
            .listStyle(.plain)
        }
    }
}

// MARK: - Instructions Tab
struct InstructionsTab: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Instructions")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Spacer()
                
                Button("Add Step") {
                    viewModel.addInstruction()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(.horizontal)
            
            List {
                ForEach(Array(viewModel.instructions.enumerated()), id: \.offset) { index, instruction in
                    HStack(alignment: .top) {
                        ZStack {
                            Circle()
                                .fill(Color.blue)
                                .frame(width: 24, height: 24)
                            
                            Text("\(index + 1)")
                                .foregroundColor(.white)
                                .font(.caption)
                                .fontWeight(.semibold)
                        }
                        .padding(.top, 8)
                        
                        TextField("Enter instruction", text: $viewModel.instructions[index], axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(2...5)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button("Delete", role: .destructive) {
                            viewModel.removeInstruction(at: index)
                        }
                    }
                }
                .onMove(perform: viewModel.moveInstruction)
            }
            .listStyle(.plain)
        }
    }
}

// MARK: - Personal Tab
struct PersonalTab: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Group {
                    // Favorite Toggle
                    HStack {
                        Text("Favorite Recipe")
                            .font(.headline)
                        
                        Spacer()
                        
                        Toggle("", isOn: $viewModel.isFavorite)
                    }
                    
                    // Personal Rating
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Personal Rating")
                            .font(.headline)
                        
                        StarRatingView(rating: $viewModel.personalRating)
                    }
                    
                    // Personal Yield
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Personal Preferred Yield")
                            .font(.headline)
                        Text("Your preferred number of servings")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextField("Enter preferred servings", value: $viewModel.personalYield, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.numberPad)
                    }
                    
                    // Personal Notes
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Personal Notes")
                            .font(.headline)
                        Text("Your thoughts about this recipe")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextField("Enter your notes", text: $viewModel.personalNotes, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3...6)
                    }
                    
                    // Cooking Notes
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Cooking Notes")
                            .font(.headline)
                        Text("Tips and modifications you've made")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextField("Enter cooking notes", text: $viewModel.cookingNotes, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3...6)
                    }
                    
                    CategoriesSection()
                }
            }
            .padding()
        }
    }
}

// MARK: - Categories Section
struct CategoriesSection: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    @State private var newCategory = ""
    @State private var showingAddCategory = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Personal Categories")
                    .font(.headline)
                
                Spacer()
                
                Button("Add Category") {
                    showingAddCategory = true
                }
                .font(.caption)
                .buttonStyle(.borderedProminent)
            }
            
            if !viewModel.categories.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.categories, id: \.self) { category in
                            TagChip(tag: category, backgroundColor: .green) {
                                viewModel.removeCategory(category)
                            }
                        }
                    }
                    .padding(.horizontal, 4)
                }
            } else {
                Text("No categories added")
                    .foregroundColor(.secondary)
                    .font(.caption)
            }
        }
        .alert("Add Category", isPresented: $showingAddCategory) {
            TextField("Category name", text: $newCategory)
            Button("Add") {
                if !newCategory.isEmpty {
                    viewModel.addCategory(newCategory.trimmingCharacters(in: .whitespacesAndNewlines))
                    newCategory = ""
                }
            }
            Button("Cancel", role: .cancel) {
                newCategory = ""
            }
        }
    }
}

// MARK: - Supporting Views

struct TagChip: View {
    let tag: String
    var backgroundColor: Color = .blue
    let onDelete: () -> Void
    
    var body: some View {
        HStack(spacing: 4) {
            Text(tag)
                .font(.caption)
                .foregroundColor(.white)
            
            Button(action: onDelete) {
                Image(systemName: "xmark")
                    .font(.caption2)
                    .foregroundColor(.white)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(backgroundColor)
        .clipShape(Capsule())
    }
}

struct StarRatingView: View {
    @Binding var rating: Double
    
    var body: some View {
        HStack(spacing: 4) {
            ForEach(1...5, id: \.self) { index in
                Button(action: {
                    rating = Double(index)
                }) {
                    Image(systemName: index <= Int(rating) ? "star.fill" : "star")
                        .foregroundColor(.yellow)
                        .font(.title2)
                }
            }
            
            Button("Clear") {
                rating = 0
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
    }
}

#Preview {
    RecipeEditView(recipe: Recipe.sample)
}