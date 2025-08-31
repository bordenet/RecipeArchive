package com.recipearchive.android.presentation.recipes

import com.recipearchive.android.data.model.Recipe
import com.recipearchive.android.data.model.RecipeIngredient
import com.recipearchive.android.data.model.RecipeInstruction
import com.recipearchive.android.data.repository.RecipeRepository
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
class RecipeListViewModelTest {

    private lateinit var viewModel: RecipeListViewModel
    private val mockRecipeRepository = mockk<RecipeRepository>()
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        
        // Setup default mocks
        every { mockRecipeRepository.searchRecipes(any()) } returns flowOf(emptyList())
        coEvery { mockRecipeRepository.getRecipeCount() } returns 0
        coEvery { mockRecipeRepository.loadSampleRecipes() } returns Result.success(emptyList())
        
        viewModel = RecipeListViewModel(mockRecipeRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        clearAllMocks()
    }

    @Test
    fun `initial state should be loading false and no error`() = runTest {
        // Assert
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertFalse(state.isRefreshing)
        assertNull(state.errorMessage)
    }

    @Test
    fun `initial search query should be empty`() = runTest {
        // Assert
        assertEquals("", viewModel.searchQuery.value)
    }

    @Test
    fun `updateSearchQuery should update search query`() = runTest {
        // Act
        viewModel.updateSearchQuery("chocolate")

        // Assert
        assertEquals("chocolate", viewModel.searchQuery.value)
    }

    @Test
    fun `clearSearch should clear search query`() = runTest {
        // Arrange
        viewModel.updateSearchQuery("chocolate")
        assertEquals("chocolate", viewModel.searchQuery.value)

        // Act
        viewModel.clearSearch()

        // Assert
        assertEquals("", viewModel.searchQuery.value)
    }

    @Test
    fun `refreshRecipes should set and clear refreshing state`() = runTest {
        // Act
        viewModel.refreshRecipes()

        // Assert - Should be refreshing initially
        assertTrue(viewModel.uiState.value.isRefreshing)

        // Fast-forward past the delay
        advanceUntilIdle()

        // Assert - Should no longer be refreshing
        assertFalse(viewModel.uiState.value.isRefreshing)
    }

    @Test
    fun `deleteRecipe should call repository delete`() = runTest {
        // Arrange
        val recipe = createSampleRecipe()
        coEvery { mockRecipeRepository.deleteRecipe(recipe) } returns Result.success(Unit)

        // Act
        viewModel.deleteRecipe(recipe)
        advanceUntilIdle()

        // Assert
        coVerify { mockRecipeRepository.deleteRecipe(recipe) }
        assertNull(viewModel.uiState.value.errorMessage)
    }

    @Test
    fun `deleteRecipe failure should set error message`() = runTest {
        // Arrange
        val recipe = createSampleRecipe()
        coEvery { mockRecipeRepository.deleteRecipe(recipe) } returns Result.failure(Exception("Delete failed"))

        // Act
        viewModel.deleteRecipe(recipe)
        advanceUntilIdle()

        // Assert
        assertEquals("Delete failed", viewModel.uiState.value.errorMessage)
    }

    @Test
    fun `clearErrorMessage should clear error state`() = runTest {
        // Arrange - Set up initial error state
        val recipe = createSampleRecipe()
        coEvery { mockRecipeRepository.deleteRecipe(recipe) } returns Result.failure(Exception("Test error"))
        viewModel.deleteRecipe(recipe)
        advanceUntilIdle()
        
        // Verify error is set
        assertEquals("Test error", viewModel.uiState.value.errorMessage)

        // Act
        viewModel.clearErrorMessage()

        // Assert
        assertNull(viewModel.uiState.value.errorMessage)
    }

    @Test
    fun `should load sample recipes if recipe count is zero`() = runTest {
        // Arrange
        coEvery { mockRecipeRepository.getRecipeCount() } returns 0
        coEvery { mockRecipeRepository.loadSampleRecipes() } returns Result.success(listOf(createSampleRecipe()))

        // Create new view model to trigger init
        val newViewModel = RecipeListViewModel(mockRecipeRepository)
        advanceUntilIdle()

        // Assert
        coVerify { mockRecipeRepository.getRecipeCount() }
        coVerify { mockRecipeRepository.loadSampleRecipes() }
    }

    @Test
    fun `should not load sample recipes if recipes already exist`() = runTest {
        // Arrange
        coEvery { mockRecipeRepository.getRecipeCount() } returns 5

        // Create new view model to trigger init
        val newViewModel = RecipeListViewModel(mockRecipeRepository)
        advanceUntilIdle()

        // Assert
        coVerify { mockRecipeRepository.getRecipeCount() }
        coVerify(exactly = 0) { mockRecipeRepository.loadSampleRecipes() }
    }

    @Test
    fun `loadSampleRecipes failure should set error message`() = runTest {
        // Arrange
        coEvery { mockRecipeRepository.getRecipeCount() } returns 0
        coEvery { mockRecipeRepository.loadSampleRecipes() } returns Result.failure(Exception("Load failed"))

        // Create new view model to trigger init
        val newViewModel = RecipeListViewModel(mockRecipeRepository)
        advanceUntilIdle()

        // Assert
        assertEquals("Load failed", newViewModel.uiState.value.errorMessage)
        assertFalse(newViewModel.uiState.value.isLoading)
    }

    @Test
    fun `search should trigger repository search with query`() = runTest {
        // Arrange
        val recipes = listOf(createSampleRecipe("Chocolate Cake"))
        every { mockRecipeRepository.searchRecipes("%chocolate%") } returns flowOf(recipes)

        // Act
        viewModel.updateSearchQuery("chocolate")
        advanceUntilIdle() // Wait for debounce

        // Assert
        verify { mockRecipeRepository.searchRecipes("%chocolate%") }
    }

    @Test
    fun `empty search should use getAllRecipes`() = runTest {
        // Arrange
        val recipes = listOf(createSampleRecipe())
        every { mockRecipeRepository.searchRecipes("") } returns flowOf(recipes)

        // Act
        viewModel.updateSearchQuery("")
        advanceUntilIdle()

        // Assert
        verify { mockRecipeRepository.searchRecipes("") }
    }

    private fun createSampleRecipe(title: String = "Test Recipe"): Recipe {
        return Recipe(
            id = "test-id",
            title = title,
            description = "Test description",
            ingredients = listOf(RecipeIngredient("Test ingredient")),
            instructions = listOf(RecipeInstruction(1, "Test instruction")),
            prepTime = 10,
            cookingTime = 20,
            servings = 4,
            difficulty = "Easy",
            cuisine = "Test",
            tags = listOf("test")
        )
    }
}