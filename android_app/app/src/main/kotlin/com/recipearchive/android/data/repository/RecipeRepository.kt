package com.recipearchive.android.data.repository

import com.recipearchive.android.data.local.RecipeDao
import com.recipearchive.android.data.model.Recipe
import com.recipearchive.android.data.model.RecipeIngredient
import com.recipearchive.android.data.model.RecipeInstruction
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecipeRepository @Inject constructor(
    private val recipeDao: RecipeDao
) {
    
    fun getAllRecipes(): Flow<List<Recipe>> = recipeDao.getAllRecipes()
    
    fun searchRecipes(query: String): Flow<List<Recipe>> {
        return if (query.isBlank()) {
            recipeDao.getAllRecipes()
        } else {
            recipeDao.searchRecipes("%$query%")
        }
    }
    
    suspend fun getRecipeById(id: String): Recipe? = recipeDao.getRecipeById(id)
    
    suspend fun insertRecipe(recipe: Recipe): Result<Recipe> {
        return try {
            // Simulate network delay
            delay(500)
            
            val recipeToInsert = recipe.copy(
                id = if (recipe.id.isEmpty()) UUID.randomUUID().toString() else recipe.id,
                updatedAt = System.currentTimeMillis()
            )
            
            recipeDao.insertRecipe(recipeToInsert)
            Result.success(recipeToInsert)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateRecipe(recipe: Recipe): Result<Recipe> {
        return try {
            delay(300)
            
            val updatedRecipe = recipe.copy(updatedAt = System.currentTimeMillis())
            recipeDao.updateRecipe(updatedRecipe)
            Result.success(updatedRecipe)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteRecipe(recipe: Recipe): Result<Unit> {
        return try {
            recipeDao.deleteRecipe(recipe)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun loadSampleRecipes(): Result<List<Recipe>> {
        return try {
            delay(1000)
            
            val sampleRecipes = listOf(
                Recipe.sample(),
                Recipe(
                    id = "sample-2",
                    title = "Spaghetti Carbonara",
                    description = "Classic Italian pasta dish with eggs, cheese, and pancetta.",
                    ingredients = listOf(
                        RecipeIngredient("400g spaghetti"),
                        RecipeIngredient("200g pancetta"),
                        RecipeIngredient("4 large eggs"),
                        RecipeIngredient("100g Pecorino Romano cheese"),
                        RecipeIngredient("Black pepper"),
                        RecipeIngredient("Salt")
                    ),
                    instructions = listOf(
                        RecipeInstruction(1, "Cook spaghetti in salted boiling water until al dente."),
                        RecipeInstruction(2, "Cook pancetta until crispy."),
                        RecipeInstruction(3, "Whisk eggs with grated cheese and black pepper."),
                        RecipeInstruction(4, "Toss hot pasta with pancetta and egg mixture."),
                        RecipeInstruction(5, "Serve immediately with extra cheese.")
                    ),
                    prepTime = 10,
                    cookingTime = 15,
                    servings = 4,
                    difficulty = "Medium",
                    cuisine = "Italian",
                    tags = listOf("pasta", "dinner", "italian"),
                    sourceUrl = "https://example.com/carbonara",
                    sourceName = "Italian Classics"
                ),
                Recipe(
                    id = "sample-3",
                    title = "Avocado Toast",
                    description = "Simple and healthy avocado toast with various toppings.",
                    ingredients = listOf(
                        RecipeIngredient("2 slices whole grain bread"),
                        RecipeIngredient("1 ripe avocado"),
                        RecipeIngredient("1 tbsp lemon juice"),
                        RecipeIngredient("Salt and pepper"),
                        RecipeIngredient("Optional: tomatoes, eggs, seeds")
                    ),
                    instructions = listOf(
                        RecipeInstruction(1, "Toast bread until golden brown."),
                        RecipeInstruction(2, "Mash avocado with lemon juice, salt, and pepper."),
                        RecipeInstruction(3, "Spread avocado mixture on toast."),
                        RecipeInstruction(4, "Add desired toppings.")
                    ),
                    prepTime = 5,
                    cookingTime = 2,
                    servings = 1,
                    difficulty = "Easy",
                    cuisine = "Modern",
                    tags = listOf("breakfast", "healthy", "vegetarian"),
                    sourceUrl = "https://example.com/avocado-toast",
                    sourceName = "Healthy Eats"
                ),
                Recipe(
                    id = "sample-4",
                    title = "Chicken Tikka Masala",
                    description = "Creamy and flavorful Indian curry with tender chicken pieces.",
                    ingredients = listOf(
                        RecipeIngredient("2 lbs chicken breast, cubed"),
                        RecipeIngredient("1 cup plain yogurt"),
                        RecipeIngredient("2 tbsp garam masala"),
                        RecipeIngredient("1 can crushed tomatoes"),
                        RecipeIngredient("1 cup heavy cream"),
                        RecipeIngredient("3 cloves garlic, minced"),
                        RecipeIngredient("1 inch ginger, grated"),
                        RecipeIngredient("Basmati rice")
                    ),
                    instructions = listOf(
                        RecipeInstruction(1, "Marinate chicken in yogurt and spices for 2 hours."),
                        RecipeInstruction(2, "Grill or pan-fry chicken until cooked through."),
                        RecipeInstruction(3, "In a pan, sauté garlic and ginger."),
                        RecipeInstruction(4, "Add tomatoes and simmer for 15 minutes."),
                        RecipeInstruction(5, "Add cream and chicken, simmer until thickened."),
                        RecipeInstruction(6, "Serve over basmati rice.")
                    ),
                    prepTime = 30,
                    cookingTime = 45,
                    servings = 8,
                    difficulty = "Medium",
                    cuisine = "Indian",
                    tags = listOf("dinner", "curry", "chicken"),
                    sourceUrl = "https://example.com/tikka-masala",
                    sourceName = "Indian Delights"
                )
            )
            
            recipeDao.insertRecipes(sampleRecipes)
            Result.success(sampleRecipes)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getRecipeCount(): Int = recipeDao.getRecipeCount()
}