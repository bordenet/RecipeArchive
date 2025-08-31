package com.recipearchive.android.data.model

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class RecipeTest {

    @Test
    fun `totalTime should return sum of prep and cook time when both exist`() {
        // Arrange
        val recipe = Recipe(
            id = "test",
            title = "Test Recipe",
            ingredients = emptyList(),
            instructions = emptyList(),
            servings = 4,
            prepTime = 15,
            cookingTime = 30
        )

        // Act & Assert
        assertEquals(45, recipe.totalTime)
    }

    @Test
    fun `totalTime should return null when prep time is null`() {
        // Arrange
        val recipe = Recipe(
            id = "test",
            title = "Test Recipe",
            ingredients = emptyList(),
            instructions = emptyList(),
            servings = 4,
            prepTime = null,
            cookingTime = 30
        )

        // Act & Assert
        assertNull(recipe.totalTime)
    }

    @Test
    fun `totalTime should return null when cooking time is null`() {
        // Arrange
        val recipe = Recipe(
            id = "test",
            title = "Test Recipe",
            ingredients = emptyList(),
            instructions = emptyList(),
            servings = 4,
            prepTime = 15,
            cookingTime = null
        )

        // Act & Assert
        assertNull(recipe.totalTime)
    }

    @Test
    fun `sample recipe should have all required fields`() {
        // Act
        val recipe = Recipe.sample()

        // Assert
        assertNotNull(recipe.id)
        assertEquals("Classic Chocolate Chip Cookies", recipe.title)
        assertNotNull(recipe.description)
        assertEquals(9, recipe.ingredients.size)
        assertEquals(9, recipe.instructions.size)
        assertEquals(15, recipe.prepTime)
        assertEquals(11, recipe.cookingTime)
        assertEquals(48, recipe.servings)
        assertEquals("Easy", recipe.difficulty)
        assertEquals("American", recipe.cuisine)
        assertEquals(3, recipe.tags.size)
        assertEquals(26, recipe.totalTime)
    }

    @Test
    fun `recipe ingredients should contain expected text`() {
        // Arrange
        val recipe = Recipe.sample()

        // Act & Assert
        assertEquals("2 1/4 cups all-purpose flour", recipe.ingredients[0].text)
        assertEquals("2 cups chocolate chips", recipe.ingredients[8].text)
    }

    @Test
    fun `recipe instructions should be numbered correctly`() {
        // Arrange
        val recipe = Recipe.sample()

        // Act & Assert
        assertEquals(1, recipe.instructions[0].stepNumber)
        assertEquals(9, recipe.instructions[8].stepNumber)
        assertEquals("Preheat oven to 375°F (190°C).", recipe.instructions[0].text)
    }

    @Test
    fun `recipe should handle empty optional fields`() {
        // Arrange
        val recipe = Recipe(
            id = "test",
            title = "Minimal Recipe",
            description = null,
            ingredients = emptyList(),
            instructions = emptyList(),
            servings = 1,
            prepTime = null,
            cookingTime = null,
            difficulty = null,
            cuisine = null,
            tags = emptyList(),
            imageUrl = null,
            sourceUrl = null,
            sourceName = null
        )

        // Act & Assert
        assertEquals("test", recipe.id)
        assertEquals("Minimal Recipe", recipe.title)
        assertNull(recipe.description)
        assertEquals(0, recipe.ingredients.size)
        assertEquals(0, recipe.instructions.size)
        assertEquals(1, recipe.servings)
        assertNull(recipe.totalTime)
        assertNull(recipe.difficulty)
        assertNull(recipe.cuisine)
        assertEquals(0, recipe.tags.size)
    }
}