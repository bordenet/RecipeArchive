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
    
    var totalTime: Int? {
        guard let prep = prepTime, let cook = cookingTime else { return nil }
        return prep + cook
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
        sourceName: "Classic Recipes"
    )
}