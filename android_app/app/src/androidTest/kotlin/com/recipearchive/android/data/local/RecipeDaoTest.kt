package com.recipearchive.android.data.local

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.recipearchive.android.data.model.Recipe
import com.recipearchive.android.data.model.RecipeIngredient
import com.recipearchive.android.data.model.RecipeInstruction
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@RunWith(AndroidJUnit4::class)
class RecipeDaoTest {

    private lateinit var database: RecipeDatabase
    private lateinit var recipeDao: RecipeDao

    @Before
    fun setup() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            RecipeDatabase::class.java
        ).allowMainThreadQueries().build()
        
        recipeDao = database.recipeDao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun insertAndGetRecipe() = runTest {
        // Arrange
        val recipe = createSampleRecipe()

        // Act
        recipeDao.insertRecipe(recipe)
        val retrieved = recipeDao.getRecipeById(recipe.id)

        // Assert
        assertNotNull(retrieved)
        assertEquals(recipe.id, retrieved.id)
        assertEquals(recipe.title, retrieved.title)
        assertEquals(recipe.ingredients.size, retrieved.ingredients.size)
        assertEquals(recipe.instructions.size, retrieved.instructions.size)
    }

    @Test
    fun getAllRecipes() = runTest {
        // Arrange
        val recipe1 = createSampleRecipe(id = "1", title = "Recipe 1")
        val recipe2 = createSampleRecipe(id = "2", title = "Recipe 2")

        // Act
        recipeDao.insertRecipe(recipe1)
        recipeDao.insertRecipe(recipe2)
        val recipes = recipeDao.getAllRecipes().first()

        // Assert
        assertEquals(2, recipes.size)
        assertTrue(recipes.any { it.title == "Recipe 1" })
        assertTrue(recipes.any { it.title == "Recipe 2" })
    }

    @Test
    fun searchRecipes() = runTest {
        // Arrange
        val recipe1 = createSampleRecipe(id = "1", title = "Chocolate Cake")
        val recipe2 = createSampleRecipe(id = "2", title = "Vanilla Pudding")
        val recipe3 = createSampleRecipe(id = "3", title = "Chocolate Cookies")

        // Act
        recipeDao.insertRecipe(recipe1)
        recipeDao.insertRecipe(recipe2)
        recipeDao.insertRecipe(recipe3)
        val chocolateRecipes = recipeDao.searchRecipes("%chocolate%").first()

        // Assert
        assertEquals(2, chocolateRecipes.size)
        assertTrue(chocolateRecipes.all { it.title.contains("Chocolate", ignoreCase = true) })
    }

    @Test
    fun searchRecipesByDescription() = runTest {
        // Arrange
        val recipe1 = createSampleRecipe(id = "1", description = "Delicious chocolate dessert")
        val recipe2 = createSampleRecipe(id = "2", description = "Healthy vanilla smoothie")

        // Act
        recipeDao.insertRecipe(recipe1)
        recipeDao.insertRecipe(recipe2)
        val results = recipeDao.searchRecipes("%chocolate%").first()

        // Assert
        assertEquals(1, results.size)
        assertEquals("Delicious chocolate dessert", results.first().description)
    }

    @Test
    fun updateRecipe() = runTest {
        // Arrange
        val originalRecipe = createSampleRecipe()
        recipeDao.insertRecipe(originalRecipe)

        // Act
        val updatedRecipe = originalRecipe.copy(title = "Updated Title")
        recipeDao.updateRecipe(updatedRecipe)
        val retrieved = recipeDao.getRecipeById(originalRecipe.id)

        // Assert
        assertNotNull(retrieved)
        assertEquals("Updated Title", retrieved.title)
    }

    @Test
    fun deleteRecipe() = runTest {
        // Arrange
        val recipe = createSampleRecipe()
        recipeDao.insertRecipe(recipe)
        
        // Verify it exists
        assertNotNull(recipeDao.getRecipeById(recipe.id))

        // Act
        recipeDao.deleteRecipe(recipe)

        // Assert
        assertNull(recipeDao.getRecipeById(recipe.id))
    }

    @Test
    fun deleteRecipeById() = runTest {
        // Arrange
        val recipe = createSampleRecipe()
        recipeDao.insertRecipe(recipe)
        
        // Verify it exists
        assertNotNull(recipeDao.getRecipeById(recipe.id))

        // Act
        recipeDao.deleteRecipeById(recipe.id)

        // Assert
        assertNull(recipeDao.getRecipeById(recipe.id))
    }

    @Test
    fun getRecipeCount() = runTest {
        // Arrange
        val recipe1 = createSampleRecipe(id = "1")
        val recipe2 = createSampleRecipe(id = "2")

        // Act & Assert
        assertEquals(0, recipeDao.getRecipeCount())
        
        recipeDao.insertRecipe(recipe1)
        assertEquals(1, recipeDao.getRecipeCount())
        
        recipeDao.insertRecipe(recipe2)
        assertEquals(2, recipeDao.getRecipeCount())
    }

    @Test
    fun insertMultipleRecipes() = runTest {
        // Arrange
        val recipes = listOf(
            createSampleRecipe(id = "1", title = "Recipe 1"),
            createSampleRecipe(id = "2", title = "Recipe 2"),
            createSampleRecipe(id = "3", title = "Recipe 3")
        )

        // Act
        recipeDao.insertRecipes(recipes)
        val allRecipes = recipeDao.getAllRecipes().first()

        // Assert
        assertEquals(3, allRecipes.size)
        assertEquals(3, recipeDao.getRecipeCount())
    }

    @Test
    fun deleteAllRecipes() = runTest {
        // Arrange
        val recipes = listOf(
            createSampleRecipe(id = "1"),
            createSampleRecipe(id = "2")
        )
        recipeDao.insertRecipes(recipes)
        assertEquals(2, recipeDao.getRecipeCount())

        // Act
        recipeDao.deleteAllRecipes()

        // Assert
        assertEquals(0, recipeDao.getRecipeCount())
        assertTrue(recipeDao.getAllRecipes().first().isEmpty())
    }

    @Test
    fun recipesOrderedByUpdatedAtDesc() = runTest {
        // Arrange
        val now = System.currentTimeMillis()
        val recipe1 = createSampleRecipe(id = "1", title = "Older Recipe").copy(updatedAt = now - 1000)
        val recipe2 = createSampleRecipe(id = "2", title = "Newer Recipe").copy(updatedAt = now)

        // Act
        recipeDao.insertRecipe(recipe1)
        recipeDao.insertRecipe(recipe2)
        val recipes = recipeDao.getAllRecipes().first()

        // Assert
        assertEquals(2, recipes.size)
        assertEquals("Newer Recipe", recipes.first().title) // Most recent first
        assertEquals("Older Recipe", recipes.last().title)
    }

    private fun createSampleRecipe(
        id: String = "test-id",
        title: String = "Test Recipe",
        description: String = "Test description"
    ): Recipe {
        return Recipe(
            id = id,
            title = title,
            description = description,
            ingredients = listOf(
                RecipeIngredient("1 cup flour"),
                RecipeIngredient("2 eggs")
            ),
            instructions = listOf(
                RecipeInstruction(1, "Mix ingredients"),
                RecipeInstruction(2, "Bake for 30 minutes")
            ),
            prepTime = 15,
            cookingTime = 30,
            servings = 4,
            difficulty = "Easy",
            cuisine = "Test",
            tags = listOf("test", "sample")
        )
    }
}