package com.recipearchive.android.presentation.recipes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.recipearchive.android.data.model.Recipe
import com.recipearchive.android.data.model.RecipeIngredient
import com.recipearchive.android.data.model.RecipeInstruction
import com.recipearchive.android.data.repository.RecipeRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RecipeEditUiState(
    val isLoading: Boolean = false,
    val isSaveSuccessful: Boolean = false,
    val errorMessage: String? = null,
    val hasUnsavedChanges: Boolean = false,
    
    // Basic recipe fields
    val title: String = "",
    val description: String = "",
    val prepTime: Int? = null,
    val cookingTime: Int? = null,
    val servings: Int = 4,
    val difficulty: String = "",
    val cuisine: String = "",
    val tags: List<String> = emptyList(),
    val ingredients: List<String> = emptyList(),
    val instructions: List<String> = emptyList(),
    
    // Personal fields
    val personalNotes: String = "",
    val personalRating: Float? = null,
    val cookingNotes: String = "",
    val categories: List<String> = emptyList(),
    val isFavorite: Boolean = false,
    val personalYield: Int? = null
)

@HiltViewModel
class RecipeEditViewModel @Inject constructor(
    private val recipeRepository: RecipeRepository
) : ViewModel() {
    
    private var originalRecipe: Recipe? = null
    
    private val _uiState = MutableStateFlow(RecipeEditUiState())
    val uiState: StateFlow<RecipeEditUiState> = _uiState.asStateFlow()
    
    fun initializeWithRecipe(recipe: Recipe) {
        originalRecipe = recipe
        _uiState.value = RecipeEditUiState(
            title = recipe.title,
            description = recipe.description ?: "",
            prepTime = recipe.prepTime,
            cookingTime = recipe.cookingTime,
            servings = recipe.servings,
            difficulty = recipe.difficulty ?: "",
            cuisine = recipe.cuisine ?: "",
            tags = recipe.tags,
            ingredients = recipe.ingredients.map { it.text },
            instructions = recipe.instructions.map { it.text },
            personalNotes = recipe.personalNotes ?: "",
            personalRating = recipe.personalRating,
            cookingNotes = recipe.cookingNotes ?: "",
            categories = recipe.categories,
            isFavorite = recipe.isFavorite,
            personalYield = recipe.personalYield
        )
    }
    
    private fun updateUiState(update: RecipeEditUiState.() -> RecipeEditUiState) {
        val newState = _uiState.value.update()
        _uiState.value = newState.copy(
            hasUnsavedChanges = hasUnsavedChanges(newState)
        )
    }
    
    private fun hasUnsavedChanges(state: RecipeEditUiState): Boolean {
        val original = originalRecipe ?: return false
        
        return state.title != original.title ||
               state.description != (original.description ?: "") ||
               state.prepTime != original.prepTime ||
               state.cookingTime != original.cookingTime ||
               state.servings != original.servings ||
               state.difficulty != (original.difficulty ?: "") ||
               state.cuisine != (original.cuisine ?: "") ||
               state.tags != original.tags ||
               state.ingredients != original.ingredients.map { it.text } ||
               state.instructions != original.instructions.map { it.text } ||
               state.personalNotes != (original.personalNotes ?: "") ||
               state.personalRating != original.personalRating ||
               state.cookingNotes != (original.cookingNotes ?: "") ||
               state.categories != original.categories ||
               state.isFavorite != original.isFavorite ||
               state.personalYield != original.personalYield
    }
    
    // Basic info updates
    fun updateTitle(title: String) = updateUiState { copy(title = title) }
    fun updateDescription(description: String) = updateUiState { copy(description = description) }
    fun updatePrepTime(prepTime: Int?) = updateUiState { copy(prepTime = prepTime) }
    fun updateCookingTime(cookingTime: Int?) = updateUiState { copy(cookingTime = cookingTime) }
    fun updateServings(servings: Int) = updateUiState { copy(servings = servings) }
    fun updateDifficulty(difficulty: String) = updateUiState { copy(difficulty = difficulty) }
    fun updateCuisine(cuisine: String) = updateUiState { copy(cuisine = cuisine) }
    
    // Tags management
    fun addTag(tag: String) {
        val trimmedTag = tag.trim()
        if (trimmedTag.isNotBlank() && !_uiState.value.tags.contains(trimmedTag)) {
            updateUiState { copy(tags = tags + trimmedTag) }
        }
    }
    
    fun removeTag(tag: String) = updateUiState { copy(tags = tags - tag) }
    
    // Ingredients management
    fun addIngredient() = updateUiState { copy(ingredients = ingredients + "") }
    
    fun updateIngredient(index: Int, ingredient: String) {
        if (index in 0 until _uiState.value.ingredients.size) {
            val newIngredients = _uiState.value.ingredients.toMutableList()
            newIngredients[index] = ingredient
            updateUiState { copy(ingredients = newIngredients) }
        }
    }
    
    fun removeIngredient(index: Int) {
        if (index in 0 until _uiState.value.ingredients.size) {
            val newIngredients = _uiState.value.ingredients.toMutableList()
            newIngredients.removeAt(index)
            updateUiState { copy(ingredients = newIngredients) }
        }
    }
    
    // Instructions management
    fun addInstruction() = updateUiState { copy(instructions = instructions + "") }
    
    fun updateInstruction(index: Int, instruction: String) {
        if (index in 0 until _uiState.value.instructions.size) {
            val newInstructions = _uiState.value.instructions.toMutableList()
            newInstructions[index] = instruction
            updateUiState { copy(instructions = newInstructions) }
        }
    }
    
    fun removeInstruction(index: Int) {
        if (index in 0 until _uiState.value.instructions.size) {
            val newInstructions = _uiState.value.instructions.toMutableList()
            newInstructions.removeAt(index)
            updateUiState { copy(instructions = newInstructions) }
        }
    }
    
    // Personal info updates
    fun updatePersonalNotes(notes: String) = updateUiState { copy(personalNotes = notes) }
    fun updatePersonalRating(rating: Float?) = updateUiState { copy(personalRating = rating) }
    fun updateCookingNotes(notes: String) = updateUiState { copy(cookingNotes = notes) }
    fun updateIsFavorite(favorite: Boolean) = updateUiState { copy(isFavorite = favorite) }
    fun updatePersonalYield(yield: Int?) = updateUiState { copy(personalYield = yield) }
    
    // Categories management
    fun addCategory(category: String) {
        val trimmedCategory = category.trim()
        if (trimmedCategory.isNotBlank() && !_uiState.value.categories.contains(trimmedCategory)) {
            updateUiState { copy(categories = categories + trimmedCategory) }
        }
    }
    
    fun removeCategory(category: String) = updateUiState { copy(categories = categories - category) }
    
    // Save recipe
    fun saveRecipe() {
        val original = originalRecipe ?: return
        val state = _uiState.value
        
        if (state.title.isBlank()) {
            _uiState.value = state.copy(errorMessage = "Recipe title cannot be empty")
            return
        }
        
        if (state.servings <= 0) {
            _uiState.value = state.copy(errorMessage = "Servings must be greater than 0")
            return
        }
        
        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, errorMessage = null)
            
            try {
                // Filter out empty ingredients and instructions
                val filteredIngredients = state.ingredients
                    .map { it.trim() }
                    .filter { it.isNotBlank() }
                    .map { RecipeIngredient(it) }
                
                val filteredInstructions = state.instructions
                    .map { it.trim() }
                    .filter { it.isNotBlank() }
                    .mapIndexed { index, instruction -> 
                        RecipeInstruction(index + 1, instruction) 
                    }
                
                // Create updated recipe
                val updatedRecipe = original.copyWith(
                    title = state.title.trim(),
                    description = state.description.trim().ifBlank { null },
                    ingredients = filteredIngredients,
                    instructions = filteredInstructions,
                    prepTime = state.prepTime,
                    cookingTime = state.cookingTime,
                    servings = state.servings,
                    difficulty = state.difficulty.trim().ifBlank { null },
                    cuisine = state.cuisine.trim().ifBlank { null },
                    tags = state.tags,
                    personalNotes = state.personalNotes.trim().ifBlank { null },
                    personalRating = state.personalRating,
                    cookingNotes = state.cookingNotes.trim().ifBlank { null },
                    categories = state.categories,
                    isFavorite = state.isFavorite,
                    personalYield = state.personalYield,
                    hasUserModifications = true,
                    updatedAt = System.currentTimeMillis()
                )
                
                // Update recipe via repository
                recipeRepository.updateRecipe(updatedRecipe).fold(
                    onSuccess = {
                        _uiState.value = state.copy(
                            isLoading = false,
                            isSaveSuccessful = true,
                            hasUnsavedChanges = false
                        )
                    },
                    onFailure = { error ->
                        _uiState.value = state.copy(
                            isLoading = false,
                            errorMessage = "Failed to save recipe: ${error.message}"
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = state.copy(
                    isLoading = false,
                    errorMessage = "Failed to save recipe: ${e.message}"
                )
            }
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
}