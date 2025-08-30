import SwiftUI

struct AddRecipeView: View {
    @EnvironmentObject var recipeService: RecipeService
    @Environment(\.presentationMode) var presentationMode
    
    @State private var title: String = ""
    @State private var description: String = ""
    @State private var ingredientsText: String = ""
    @State private var instructionsText: String = ""
    @State private var prepTime: String = ""
    @State private var cookTime: String = ""
    @State private var servings: String = "4"
    @State private var difficulty: String = "Medium"
    @State private var cuisine: String = ""
    @State private var tags: String = ""
    @State private var sourceUrl: String = ""
    @State private var sourceName: String = ""
    
    private let difficultyOptions = ["Easy", "Medium", "Hard"]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 0) {
                    // Two-column layout for iPad
                    HStack(alignment: .top, spacing: 30) {
                        // Left column - Basic info
                        VStack(alignment: .leading, spacing: 20) {
                            iPadFormSection(title: "Basic Information") {
                                VStack(spacing: 16) {
                                    iPadTextField(title: "Recipe Title", text: $title, placeholder: "Enter recipe name")
                                    
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Description (Optional)")
                                            .font(.headline)
                                            .foregroundColor(.primary)
                                        
                                        TextEditor(text: $description)
                                            .frame(minHeight: 80)
                                            .padding(12)
                                            .background(Color(.systemGray6))
                                            .cornerRadius(10)
                                    }
                                }
                            }
                            
                            iPadFormSection(title: "Recipe Details") {
                                LazyVGrid(columns: [
                                    GridItem(.flexible()),
                                    GridItem(.flexible())
                                ], spacing: 16) {
                                    iPadNumberField(title: "Prep Time (min)", text: $prepTime, placeholder: "15")
                                    iPadNumberField(title: "Cook Time (min)", text: $cookTime, placeholder: "30")
                                    iPadNumberField(title: "Servings", text: $servings, placeholder: "4")
                                    
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("Difficulty")
                                            .font(.headline)
                                            .foregroundColor(.primary)
                                        
                                        Picker("Difficulty", selection: $difficulty) {
                                            ForEach(difficultyOptions, id: \.self) { option in
                                                Text(option).tag(option)
                                            }
                                        }
                                        .pickerStyle(SegmentedPickerStyle())
                                    }
                                }
                                
                                VStack(spacing: 16) {
                                    iPadTextField(title: "Cuisine (Optional)", text: $cuisine, placeholder: "e.g., Italian, Mexican")
                                    iPadTextField(title: "Tags", text: $tags, placeholder: "dessert, chocolate, cookies")
                                }
                            }
                            
                            iPadFormSection(title: "Source (Optional)") {
                                VStack(spacing: 16) {
                                    iPadTextField(title: "Source Name", text: $sourceName, placeholder: "Food Network")
                                    iPadTextField(title: "Source URL", text: $sourceUrl, placeholder: "https://...")
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .top)
                        
                        // Right column - Ingredients and instructions
                        VStack(alignment: .leading, spacing: 20) {
                            iPadFormSection(title: "Ingredients") {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Enter one ingredient per line")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    TextEditor(text: $ingredientsText)
                                        .frame(minHeight: 200)
                                        .padding(12)
                                        .background(Color(.systemGray6))
                                        .cornerRadius(10)
                                        .font(.body)
                                }
                            }
                            
                            iPadFormSection(title: "Instructions") {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Enter one step per line")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    
                                    TextEditor(text: $instructionsText)
                                        .frame(minHeight: 250)
                                        .padding(12)
                                        .background(Color(.systemGray6))
                                        .cornerRadius(10)
                                        .font(.body)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .top)
                    }
                    .padding(.horizontal, 30)
                    .padding(.vertical, 20)
                }
            }
            .navigationTitle("Add New Recipe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save Recipe") {
                        saveRecipe()
                    }
                    .fontWeight(.semibold)
                    .disabled(title.isEmpty || ingredientsText.isEmpty || instructionsText.isEmpty)
                }
            }
        }
    }
    
    private func saveRecipe() {
        let ingredients = ingredientsText
            .components(separatedBy: .newlines)
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { RecipeIngredient(text: $0.trimmingCharacters(in: .whitespaces)) }
        
        let instructions = instructionsText
            .components(separatedBy: .newlines)
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .enumerated()
            .map { RecipeInstruction(stepNumber: $0.offset + 1, text: $0.element.trimmingCharacters(in: .whitespaces)) }
        
        let tagList = tags
            .components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
        
        let recipe = Recipe(
            id: UUID().uuidString,
            title: title,
            description: description.isEmpty ? nil : description,
            ingredients: ingredients,
            instructions: instructions,
            prepTime: Int(prepTime),
            cookingTime: Int(cookTime),
            servings: Int(servings) ?? 4,
            difficulty: difficulty,
            cuisine: cuisine.isEmpty ? nil : cuisine,
            tags: tagList,
            imageUrl: nil,
            sourceUrl: sourceUrl.isEmpty ? nil : sourceUrl,
            sourceName: sourceName.isEmpty ? nil : sourceName
        )
        
        recipeService.addRecipe(recipe)
        presentationMode.wrappedValue.dismiss()
    }
}

struct iPadFormSection<Content: View>: View {
    let title: String
    let content: Content
    
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(title)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.primary)
            
            content
        }
    }
}

struct iPadTextField: View {
    let title: String
    @Binding var text: String
    let placeholder: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundColor(.primary)
            
            TextField(placeholder, text: $text)
                .textFieldStyle(iPadTextFieldStyle())
        }
    }
}

struct iPadNumberField: View {
    let title: String
    @Binding var text: String
    let placeholder: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundColor(.primary)
            
            TextField(placeholder, text: $text)
                .textFieldStyle(iPadTextFieldStyle())
                .keyboardType(.numberPad)
        }
    }
}

#Preview {
    AddRecipeView()
        .environmentObject(RecipeService())
}