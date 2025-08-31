package com.recipearchive.android.data.repository

import com.recipearchive.android.data.local.RecipeDao
import com.recipearchive.android.data.model.Recipe
import com.recipearchive.android.data.model.RecipeIngredient
import com.recipearchive.android.data.model.RecipeInstruction
import io.mockk.*
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class RecipeRepositoryTest {

    private lateinit var recipeRepository: RecipeRepository
    private val mockRecipeDao = mockk<RecipeDao>()

    @Before
    fun setup() {
        recipeRepository = RecipeRepository(mockRecipeDao)
    }

    @After
    fun tearDown() {
        clearAllMocks()
    }

    @Test
    fun `getAllRecipes should return flow from dao`() = runTest {
        // Arrange
        val recipes = listOf(createSampleRecipe())
        every { mockRecipeDao.getAllRecipes() } returns flowOf(recipes)

        // Act
        val result = recipeRepository.getAllRecipes()

        // Assert
        result.collect { 
            assertEquals(1, it.size)
            assertEquals("Test Recipe", it.first().title)
        }
    }

    @Test
    fun `searchRecipes with query should return filtered results`() = runTest {
        // Arrange
        val query = "chocolate"
        val recipes = listOf(createSampleRecipe("Chocolate Cake"))
        every { mockRecipeDao.searchRecipes("%$query%") } returns flowOf(recipes)

        // Act
        val result = recipeRepository.searchRecipes(query)

        // Assert
        result.collect { 
            assertEquals(1, it.size)
            assertTrue(it.first().title.contains("Chocolate"))
        }
    }

    @Test
    fun `searchRecipes with blank query should return all recipes`() = runTest {
        // Arrange
        val recipes = listOf(createSampleRecipe())
        every { mockRecipeDao.getAllRecipes() } returns flowOf(recipes)

        // Act
        val result = recipeRepository.searchRecipes("")

        // Assert
        result.collect { 
            assertEquals(1, it.size)
        }
        verify { mockRecipeDao.getAllRecipes() }
        verify(exactly = 0) { mockRecipeDao.searchRecipes(any()) }
    }

    @Test
    fun `getRecipeById should return recipe from dao`() = runTest {
        // Arrange
        val recipe = createSampleRecipe()
        coEvery { mockRecipeDao.getRecipeById("test-id") } returns recipe

        // Act
        val result = recipeRepository.getRecipeById("test-id")

        // Assert
        assertNotNull(result)
        assertEquals("Test Recipe", result.title)
        coVerify { mockRecipeDao.getRecipeById("test-id") }
    }

    @Test
    fun `insertRecipe should generate id if empty and return success`() = runTest {
        // Arrange
        val recipe = createSampleRecipe(id = "")
        coEvery { mockRecipeDao.insertRecipe(any()) } returns Unit

        // Act
        val result = recipeRepository.insertRecipe(recipe)

        // Assert
        assertTrue(result.isSuccess)
        val insertedRecipe = result.getOrNull()
        assertNotNull(insertedRecipe)
        assertTrue(insertedRecipe.id.isNotEmpty())
        assertTrue(insertedRecipe.updatedAt > recipe.updatedAt)
        coVerify { mockRecipeDao.insertRecipe(any()) }
    }

    @Test
    fun `insertRecipe should preserve existing id`() = runTest {
        // Arrange
        val recipe = createSampleRecipe(id = "existing-id")
        coEvery { mockRecipeDao.insertRecipe(any()) } returns Unit

        // Act
        val result = recipeRepository.insertRecipe(recipe)

        // Assert
        assertTrue(result.isSuccess)
        val insertedRecipe = result.getOrNull()
        assertNotNull(insertedRecipe)
        assertEquals("existing-id", insertedRecipe.id)
        coVerify { mockRecipeDao.insertRecipe(any()) }
    }

    @Test
    fun `updateRecipe should update timestamp and return success`() = runTest {
        // Arrange
        val recipe = createSampleRecipe()
        val originalTime = recipe.updatedAt
        coEvery { mockRecipeDao.updateRecipe(any()) } returns Unit

        // Act
        val result = recipeRepository.updateRecipe(recipe)

        // Assert
        assertTrue(result.isSuccess)
        val updatedRecipe = result.getOrNull()
        assertNotNull(updatedRecipe)
        assertTrue(updatedRecipe.updatedAt > originalTime)
        coVerify { mockRecipeDao.updateRecipe(any()) }
    }

    @Test
    fun `deleteRecipe should call dao and return success`() = runTest {
        // Arrange
        val recipe = createSampleRecipe()
        coEvery { mockRecipeDao.deleteRecipe(recipe) } returns Unit

        // Act
        val result = recipeRepository.deleteRecipe(recipe)

        // Assert
        assertTrue(result.isSuccess)
        coVerify { mockRecipeDao.deleteRecipe(recipe) }
    }

    @Test
    fun `loadSampleRecipes should insert sample data and return success`() = runTest {
        // Arrange
        coEvery { mockRecipeDao.insertRecipes(any()) } returns Unit

        // Act
        val result = recipeRepository.loadSampleRecipes()

        // Assert
        assertTrue(result.isSuccess)
        val recipes = result.getOrNull()
        assertNotNull(recipes)
        assertTrue(recipes.isNotEmpty())
        assertTrue(recipes.any { it.title == "Classic Chocolate Chip Cookies" })
        assertTrue(recipes.any { it.title == "Spaghetti Carbonara" })
        coVerify { mockRecipeDao.insertRecipes(any()) }
    }

    @Test
    fun `getRecipeCount should return count from dao`() = runTest {
        // Arrange
        coEvery { mockRecipeDao.getRecipeCount() } returns 5

        // Act
        val result = recipeRepository.getRecipeCount()

        // Assert
        assertEquals(5, result)
        coVerify { mockRecipeDao.getRecipeCount() }
    }

    private fun createSampleRecipe(
        title: String = "Test Recipe",
        id: String = "test-id"
    ): Recipe {
        return Recipe(
            id = id,
            title = title,
            description = "Test description",
            ingredients = listOf(RecipeIngredient("Test ingredient")),
            instructions = listOf(RecipeInstruction(1, "Test instruction")),
            prepTime = 10,
            cookingTime = 20,
            servings = 4,
            difficulty = "Easy",
            cuisine = "Test",
            tags = listOf("test"),
            createdAt = System.currentTimeMillis() - 1000,
            updatedAt = System.currentTimeMillis() - 1000
        )
    }
}