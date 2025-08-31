package com.recipearchive.android.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "recipes")
data class Recipe(
    @PrimaryKey
    val id: String,
    val title: String,
    val description: String? = null,
    val ingredients: List<RecipeIngredient>,
    val instructions: List<RecipeInstruction>,
    val prepTime: Int? = null,
    val cookingTime: Int? = null,
    val servings: Int,
    val difficulty: String? = null,
    val cuisine: String? = null,
    val tags: List<String> = emptyList(),
    val imageUrl: String? = null,
    val sourceUrl: String? = null,
    val sourceName: String? = null,
    
    // User personalization fields
    val personalNotes: String? = null,
    val personalRating: Float? = null, // 1-5 stars
    val cookingNotes: String? = null,
    val categories: List<String> = emptyList(), // User-defined categories
    val isFavorite: Boolean = false,
    val personalYield: Int? = null, // User's preferred serving size
    
    // Modification tracking
    val hasUserModifications: Boolean = false,
    val originalData: Map<String, Any?>? = null, // Store original recipe data
    
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
) {
    val totalTime: Int?
        get() = if (prepTime != null && cookingTime != null) {
            prepTime + cookingTime
        } else null
        
    // Get effective yield (user's preferred or original)
    val effectiveYield: Int
        get() = personalYield ?: servings
        
    // Check if recipe has any user modifications
    val hasPersonalizations: Boolean
        get() = personalNotes != null || 
                personalRating != null || 
                cookingNotes != null || 
                categories.isNotEmpty() || 
                isFavorite || 
                personalYield != null ||
                hasUserModifications
                
    // Helper for creating an edited copy
    fun copyWith(
        title: String? = null,
        description: String? = null,
        ingredients: List<RecipeIngredient>? = null,
        instructions: List<RecipeInstruction>? = null,
        prepTime: Int? = null,
        cookingTime: Int? = null,
        servings: Int? = null,
        difficulty: String? = null,
        cuisine: String? = null,
        tags: List<String>? = null,
        personalNotes: String? = null,
        personalRating: Float? = null,
        cookingNotes: String? = null,
        categories: List<String>? = null,
        isFavorite: Boolean? = null,
        personalYield: Int? = null,
        hasUserModifications: Boolean? = null,
        updatedAt: Long? = null
    ) = Recipe(
        id = this.id,
        title = title ?: this.title,
        description = description ?: this.description,
        ingredients = ingredients ?: this.ingredients,
        instructions = instructions ?: this.instructions,
        prepTime = prepTime ?: this.prepTime,
        cookingTime = cookingTime ?: this.cookingTime,
        servings = servings ?: this.servings,
        difficulty = difficulty ?: this.difficulty,
        cuisine = cuisine ?: this.cuisine,
        tags = tags ?: this.tags,
        imageUrl = this.imageUrl,
        sourceUrl = this.sourceUrl,
        sourceName = this.sourceName,
        personalNotes = personalNotes ?: this.personalNotes,
        personalRating = personalRating ?: this.personalRating,
        cookingNotes = cookingNotes ?: this.cookingNotes,
        categories = categories ?: this.categories,
        isFavorite = isFavorite ?: this.isFavorite,
        personalYield = personalYield ?: this.personalYield,
        hasUserModifications = hasUserModifications ?: true,
        originalData = this.originalData,
        createdAt = this.createdAt,
        updatedAt = updatedAt ?: System.currentTimeMillis()
    )

    companion object {
        fun sample() = Recipe(
            id = "sample-1",
            title = "Classic Chocolate Chip Cookies",
            description = "Soft and chewy chocolate chip cookies that are perfect for any occasion.",
            ingredients = listOf(
                RecipeIngredient("2 1/4 cups all-purpose flour"),
                RecipeIngredient("1 tsp baking soda"),
                RecipeIngredient("1 tsp salt"),
                RecipeIngredient("1 cup butter, softened"),
                RecipeIngredient("3/4 cup granulated sugar"),
                RecipeIngredient("3/4 cup packed brown sugar"),
                RecipeIngredient("2 large eggs"),
                RecipeIngredient("2 tsp vanilla extract"),
                RecipeIngredient("2 cups chocolate chips")
            ),
            instructions = listOf(
                RecipeInstruction(1, "Preheat oven to 375°F (190°C)."),
                RecipeInstruction(2, "In a medium bowl, whisk together flour, baking soda, and salt."),
                RecipeInstruction(3, "In a large bowl, beat butter and both sugars until creamy."),
                RecipeInstruction(4, "Beat in eggs and vanilla extract."),
                RecipeInstruction(5, "Gradually blend in flour mixture."),
                RecipeInstruction(6, "Stir in chocolate chips."),
                RecipeInstruction(7, "Drop rounded tablespoons of dough onto ungreased cookie sheets."),
                RecipeInstruction(8, "Bake for 9-11 minutes or until golden brown."),
                RecipeInstruction(9, "Cool on baking sheets for 2 minutes; remove to wire rack.")
            ),
            prepTime = 15,
            cookingTime = 11,
            servings = 48,
            difficulty = "Easy",
            cuisine = "American",
            tags = listOf("dessert", "cookies", "chocolate"),
            sourceUrl = "https://example.com/chocolate-chip-cookies",
            sourceName = "Classic Recipes"
        )
    }
}

@Serializable
data class RecipeIngredient(
    val text: String
)

@Serializable
data class RecipeInstruction(
    val stepNumber: Int,
    val text: String
)