import Foundation

struct Recipe: Identifiable, Codable {
    let id: String
    let title: String
    let description: String?
    let ingredients: [RecipeIngredient]
    let instructions: [RecipeInstruction]
    let prepTime: Int?
    let cookingTime: Int?
    let servings: Int
    let difficulty: String?
    let cuisine: String?
    let tags: [String]
    let imageUrl: String?
    let sourceUrl: String?
    let sourceName: String?
    
    // User personalization fields
    let personalNotes: String?
    let personalRating: Double?
    let cookingNotes: String?
    let categories: [String]
    let isFavorite: Bool
    let personalYield: Int?
    
    // Modification tracking
    let hasUserModifications: Bool
    let originalData: [String: Any]?
    let createdAt: Date?
    let updatedAt: Date?
    
    var totalTime: Int? {
        guard let prep = prepTime, let cook = cookingTime else { return nil }
        return prep + cook
    }
    
    // Get effective yield (user's preferred or original)
    var effectiveYield: Int {
        return personalYield ?? servings
    }
    
    // Check if recipe has any user modifications
    var hasPersonalizations: Bool {
        return personalNotes != nil || 
               personalRating != nil || 
               cookingNotes != nil || 
               !categories.isEmpty || 
               isFavorite || 
               personalYield != nil ||
               hasUserModifications
    }
    
    // Helper for creating an edited copy
    func copyWith(
        title: String? = nil,
        description: String? = nil,
        ingredients: [RecipeIngredient]? = nil,
        instructions: [RecipeInstruction]? = nil,
        prepTime: Int? = nil,
        cookingTime: Int? = nil,
        servings: Int? = nil,
        difficulty: String? = nil,
        cuisine: String? = nil,
        tags: [String]? = nil,
        personalNotes: String? = nil,
        personalRating: Double? = nil,
        cookingNotes: String? = nil,
        categories: [String]? = nil,
        isFavorite: Bool? = nil,
        personalYield: Int? = nil,
        hasUserModifications: Bool? = nil,
        updatedAt: Date? = nil
    ) -> Recipe {
        return Recipe(
            id: self.id,
            title: title ?? self.title,
            description: description ?? self.description,
            ingredients: ingredients ?? self.ingredients,
            instructions: instructions ?? self.instructions,
            prepTime: prepTime ?? self.prepTime,
            cookingTime: cookingTime ?? self.cookingTime,
            servings: servings ?? self.servings,
            difficulty: difficulty ?? self.difficulty,
            cuisine: cuisine ?? self.cuisine,
            tags: tags ?? self.tags,
            imageUrl: self.imageUrl,
            sourceUrl: self.sourceUrl,
            sourceName: self.sourceName,
            personalNotes: personalNotes ?? self.personalNotes,
            personalRating: personalRating ?? self.personalRating,
            cookingNotes: cookingNotes ?? self.cookingNotes,
            categories: categories ?? self.categories,
            isFavorite: isFavorite ?? self.isFavorite,
            personalYield: personalYield ?? self.personalYield,
            hasUserModifications: hasUserModifications ?? true,
            originalData: self.originalData,
            createdAt: self.createdAt,
            updatedAt: updatedAt ?? Date()
        )
    }
}

struct RecipeIngredient: Codable {
    let text: String
}

struct RecipeInstruction: Codable {
    let stepNumber: Int
    let text: String
}

extension Recipe {
    static let sample = Recipe(
        id: "sample-1",
        title: "Classic Chocolate Chip Cookies",
        description: "Soft and chewy chocolate chip cookies that are perfect for any occasion.",
        ingredients: [
            RecipeIngredient(text: "2 1/4 cups all-purpose flour"),
            RecipeIngredient(text: "1 tsp baking soda"),
            RecipeIngredient(text: "1 tsp salt"),
            RecipeIngredient(text: "1 cup butter, softened"),
            RecipeIngredient(text: "3/4 cup granulated sugar"),
            RecipeIngredient(text: "3/4 cup packed brown sugar"),
            RecipeIngredient(text: "2 large eggs"),
            RecipeIngredient(text: "2 tsp vanilla extract"),
            RecipeIngredient(text: "2 cups chocolate chips")
        ],
        instructions: [
            RecipeInstruction(stepNumber: 1, text: "Preheat oven to 375°F (190°C)."),
            RecipeInstruction(stepNumber: 2, text: "In a medium bowl, whisk together flour, baking soda, and salt."),
            RecipeInstruction(stepNumber: 3, text: "In a large bowl, beat butter and both sugars until creamy."),
            RecipeInstruction(stepNumber: 4, text: "Beat in eggs and vanilla extract."),
            RecipeInstruction(stepNumber: 5, text: "Gradually blend in flour mixture."),
            RecipeInstruction(stepNumber: 6, text: "Stir in chocolate chips."),
            RecipeInstruction(stepNumber: 7, text: "Drop rounded tablespoons of dough onto ungreased cookie sheets."),
            RecipeInstruction(stepNumber: 8, text: "Bake for 9-11 minutes or until golden brown."),
            RecipeInstruction(stepNumber: 9, text: "Cool on baking sheets for 2 minutes; remove to wire rack.")
        ],
        prepTime: 15,
        cookingTime: 11,
        servings: 48,
        difficulty: "Easy",
        cuisine: "American",
        tags: ["dessert", "cookies", "chocolate"],
        imageUrl: nil,
        sourceUrl: "https://example.com/chocolate-chip-cookies",
        sourceName: "Classic Recipes",
        personalNotes: nil,
        personalRating: nil,
        cookingNotes: nil,
        categories: [],
        isFavorite: false,
        personalYield: nil,
        hasUserModifications: false,
        originalData: nil,
        createdAt: Date(),
        updatedAt: nil
    )
}