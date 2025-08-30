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
            Form {
                Section(header: Text("Basic Information")) {
                    TextField("Recipe Title", text: $title)
                    TextField("Description (optional)", text: $description)
                        .lineLimit(3)
                }
                
                Section(header: Text("Recipe Details")) {
                    HStack {
                        Text("Prep Time (minutes)")
                        Spacer()
                        TextField("15", text: $prepTime)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                    }
                    
                    HStack {
                        Text("Cook Time (minutes)")
                        Spacer()
                        TextField("30", text: $cookTime)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                    }
                    
                    HStack {
                        Text("Servings")
                        Spacer()
                        TextField("4", text: $servings)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                    }
                    
                    Picker("Difficulty", selection: $difficulty) {
                        ForEach(difficultyOptions, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    
                    TextField("Cuisine (optional)", text: $cuisine)
                    TextField("Tags (comma-separated)", text: $tags)
                }
                
                Section(header: Text("Ingredients")) {
                    TextField("Enter ingredients, one per line", text: $ingredientsText, axis: .vertical)
                        .lineLimit(5...10)
                }
                
                Section(header: Text("Instructions")) {
                    TextField("Enter instructions, one step per line", text: $instructionsText, axis: .vertical)
                        .lineLimit(5...15)
                }
                
                Section(header: Text("Source (Optional)")) {
                    TextField("Source Name", text: $sourceName)
                    TextField("Source URL", text: $sourceUrl)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                }
            }
            .navigationTitle("Add Recipe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveRecipe()
                    }
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

#Preview {
    AddRecipeView()
        .environmentObject(RecipeService())
}