import SwiftUI

struct RecipeEditView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: RecipeEditViewModel
    @State private var selectedSection: EditSection = .basicInfo
    
    init(recipe: Recipe) {
        _viewModel = StateObject(wrappedValue: RecipeEditViewModel(recipe: recipe))
    }
    
    var body: some View {
        NavigationView {
            // iPad-optimized split view editing interface
            HSplitView {
                // Left sidebar for navigation
                EditSidebar(selectedSection: $selectedSection)
                    .frame(minWidth: 250, maxWidth: 350)
                
                // Main content area
                EditContentView(selectedSection: selectedSection)
                    .frame(minWidth: 500)
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
                    .buttonStyle(.borderedProminent)
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

// MARK: - Edit Section Enum
enum EditSection: String, CaseIterable {
    case basicInfo = "Basic Info"
    case ingredients = "Ingredients"
    case instructions = "Instructions"
    case personal = "Personal"
    
    var icon: String {
        switch self {
        case .basicInfo: return "info.circle"
        case .ingredients: return "list.bullet"
        case .instructions: return "list.number"
        case .personal: return "person.circle"
        }
    }
}

// MARK: - Edit Sidebar
struct EditSidebar: View {
    @Binding var selectedSection: EditSection
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        List(EditSection.allCases, id: \.self) { section in
            SidebarRow(
                section: section,
                isSelected: selectedSection == section
            ) {
                selectedSection = section
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Sections")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                if viewModel.hasUnsavedChanges {
                    Image(systemName: "circle.fill")
                        .foregroundColor(.orange)
                        .font(.caption)
                }
            }
        }
    }
}

struct SidebarRow: View {
    let section: EditSection
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        HStack {
            Image(systemName: section.icon)
                .foregroundColor(isSelected ? .accentColor : .secondary)
                .frame(width: 20)
            
            Text(section.rawValue)
                .font(.headline)
                .foregroundColor(isSelected ? .accentColor : .primary)
            
            Spacer()
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            action()
        }
    }
}

// MARK: - Main Content View
struct EditContentView: View {
    let selectedSection: EditSection
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        ScrollView {
            switch selectedSection {
            case .basicInfo:
                BasicInfoSection()
            case .ingredients:
                IngredientsSection()
            case .instructions:
                InstructionsSection()
            case .personal:
                PersonalSection()
            }
        }
        .padding()
    }
}

// MARK: - Basic Info Section
struct BasicInfoSection: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Basic Information")
                .font(.title)
                .fontWeight(.bold)
            
            // Two-column layout for iPad
            LazyVGrid(columns: [
                GridItem(.flexible(minimum: 200)),
                GridItem(.flexible(minimum: 200))
            ], spacing: 24) {
                // Title (spans full width)
                GridItem(columnSpan: 2) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Recipe Title")
                            .font(.headline)
                        TextField("Enter recipe title", text: $viewModel.title)
                            .textFieldStyle(.roundedBorder)
                            .font(.title3)
                    }
                }
                
                // Description (spans full width)
                GridItem(columnSpan: 2) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(.headline)
                        TextField("Enter recipe description", text: $viewModel.description, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3...6)
                    }
                }
                
                // Prep Time
                VStack(alignment: .leading, spacing: 8) {
                    Text("Prep Time (minutes)")
                        .font(.headline)
                    TextField("15", value: $viewModel.prepTime, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                }
                
                // Cook Time
                VStack(alignment: .leading, spacing: 8) {
                    Text("Cook Time (minutes)")
                        .font(.headline)
                    TextField("30", value: $viewModel.cookingTime, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                }
                
                // Servings
                VStack(alignment: .leading, spacing: 8) {
                    Text("Servings")
                        .font(.headline)
                    TextField("4", value: $viewModel.servings, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                }
                
                // Difficulty
                VStack(alignment: .leading, spacing: 8) {
                    Text("Difficulty")
                        .font(.headline)
                    TextField("Easy", text: $viewModel.difficulty)
                        .textFieldStyle(.roundedBorder)
                }
                
                // Cuisine (spans full width)
                GridItem(columnSpan: 2) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Cuisine")
                            .font(.headline)
                        TextField("Enter cuisine type", text: $viewModel.cuisine)
                            .textFieldStyle(.roundedBorder)
                    }
                }
            }
            
            TagsSection()
        }
    }
}

extension GridItem {
    init(columnSpan: Int, @ViewBuilder content: () -> Content) {
        // This is a conceptual extension - actual implementation would depend on SwiftUI version
        self.init(.flexible())
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
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("Add Tag") {
                    showingAddTag = true
                }
                .buttonStyle(.borderedProminent)
            }
            
            if !viewModel.tags.isEmpty {
                LazyVGrid(columns: [
                    GridItem(.adaptive(minimum: 120))
                ], spacing: 8) {
                    ForEach(viewModel.tags, id: \.self) { tag in
                        TagChip(tag: tag) {
                            viewModel.removeTag(tag)
                        }
                    }
                }
            } else {
                Text("No tags added")
                    .foregroundColor(.secondary)
                    .font(.body)
                    .padding(.vertical)
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

// MARK: - Ingredients Section
struct IngredientsSection: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Text("Ingredients")
                    .font(.title)
                    .fontWeight(.bold)
                
                Spacer()
                
                Button("Add Ingredient") {
                    viewModel.addIngredient()
                }
                .buttonStyle(.borderedProminent)
            }
            
            LazyVStack(spacing: 12) {
                ForEach(Array(viewModel.ingredients.enumerated()), id: \.offset) { index, ingredient in
                    HStack(spacing: 16) {
                        // Step number
                        Text("\(index + 1).")
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.accentColor)
                            .frame(width: 40, alignment: .leading)
                        
                        // Ingredient text field
                        TextField("Enter ingredient", text: $viewModel.ingredients[index])
                            .textFieldStyle(.roundedBorder)
                            .font(.body)
                        
                        // Delete button
                        Button(action: {
                            viewModel.removeIngredient(at: index)
                        }) {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.borderless)
                    }
                    .padding(.vertical, 4)
                }
                .onMove(perform: viewModel.moveIngredient)
            }
            
            if viewModel.ingredients.isEmpty {
                Text("No ingredients added")
                    .foregroundColor(.secondary)
                    .font(.body)
                    .padding(.vertical, 40)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

// MARK: - Instructions Section
struct InstructionsSection: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Text("Instructions")
                    .font(.title)
                    .fontWeight(.bold)
                
                Spacer()
                
                Button("Add Step") {
                    viewModel.addInstruction()
                }
                .buttonStyle(.borderedProminent)
            }
            
            LazyVStack(spacing: 16) {
                ForEach(Array(viewModel.instructions.enumerated()), id: \.offset) { index, instruction in
                    HStack(alignment: .top, spacing: 16) {
                        // Step number circle
                        ZStack {
                            Circle()
                                .fill(Color.accentColor)
                                .frame(width: 32, height: 32)
                            
                            Text("\(index + 1)")
                                .foregroundColor(.white)
                                .font(.headline)
                                .fontWeight(.semibold)
                        }
                        .padding(.top, 8)
                        
                        // Instruction text field
                        TextField("Enter instruction step", text: $viewModel.instructions[index], axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(2...8)
                            .font(.body)
                        
                        // Delete button
                        Button(action: {
                            viewModel.removeInstruction(at: index)
                        }) {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.borderless)
                        .padding(.top, 8)
                    }
                }
                .onMove(perform: viewModel.moveInstruction)
            }
            
            if viewModel.instructions.isEmpty {
                Text("No instructions added")
                    .foregroundColor(.secondary)
                    .font(.body)
                    .padding(.vertical, 40)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

// MARK: - Personal Section
struct PersonalSection: View {
    @EnvironmentObject var viewModel: RecipeEditViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Personal Information")
                .font(.title)
                .fontWeight(.bold)
            
            LazyVGrid(columns: [
                GridItem(.flexible(minimum: 200)),
                GridItem(.flexible(minimum: 200))
            ], spacing: 24) {
                // Favorite Toggle
                HStack {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Favorite Recipe")
                            .font(.headline)
                        Text("Mark as a favorite recipe")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Toggle("", isOn: $viewModel.isFavorite)
                        .scaleEffect(1.2)
                }
                
                // Personal Rating
                VStack(alignment: .leading, spacing: 12) {
                    Text("Personal Rating")
                        .font(.headline)
                    Text("Rate this recipe (1-5 stars)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
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
                
                // Empty cell for spacing
                Color.clear
                    .frame(height: 1)
                
                // Personal Notes (full width)
                GridItem(columnSpan: 2) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Personal Notes")
                            .font(.headline)
                        Text("Your thoughts about this recipe")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextField("Enter your notes", text: $viewModel.personalNotes, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(4...8)
                    }
                }
                
                // Cooking Notes (full width)
                GridItem(columnSpan: 2) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Cooking Notes")
                            .font(.headline)
                        Text("Tips and modifications you've made")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextField("Enter cooking notes", text: $viewModel.cookingNotes, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(4...8)
                    }
                }
            }
            
            CategoriesSection()
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
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("Add Category") {
                    showingAddCategory = true
                }
                .buttonStyle(.borderedProminent)
            }
            
            if !viewModel.categories.isEmpty {
                LazyVGrid(columns: [
                    GridItem(.adaptive(minimum: 120))
                ], spacing: 8) {
                    ForEach(viewModel.categories, id: \.self) { category in
                        TagChip(tag: category, backgroundColor: .green) {
                            viewModel.removeCategory(category)
                        }
                    }
                }
            } else {
                Text("No categories added")
                    .foregroundColor(.secondary)
                    .font(.body)
                    .padding(.vertical)
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
        HStack(spacing: 6) {
            Text(tag)
                .font(.body)
                .foregroundColor(.white)
                .lineLimit(1)
            
            Button(action: onDelete) {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.8))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

struct StarRatingView: View {
    @Binding var rating: Double
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(1...5, id: \.self) { index in
                Button(action: {
                    rating = Double(index)
                }) {
                    Image(systemName: index <= Int(rating) ? "star.fill" : "star")
                        .foregroundColor(.yellow)
                        .font(.title2)
                }
                .buttonStyle(.borderless)
            }
            
            Button("Clear") {
                rating = 0
            }
            .font(.caption)
            .foregroundColor(.secondary)
            .padding(.leading, 8)
        }
    }
}

#Preview {
    RecipeEditView(recipe: Recipe.sample)
}