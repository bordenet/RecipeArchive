/// Business logic operations for recipe management
library;

import 'package:flutter/material.dart';
import '../models/recipe.dart';
import '../services/recipe_service.dart';

/// Handles recipe CRUD operations with proper error handling
class RecipeOperations {
  final RecipeService _recipeService;

  const RecipeOperations(this._recipeService);

  /// Deletes a recipe with loading state management
  Future<void> deleteRecipe(
    String recipeId, {
    required VoidCallback onStart,
    required VoidCallback onSuccess,
    required void Function(String error) onError,
  }) async {
    onStart();

    try {
      await _recipeService.deleteRecipe(recipeId);
      onSuccess();
    } catch (e) {
      debugPrint('ERROR: Failed to delete recipe: $e');
      onError('Failed to delete recipe: ${e.toString()}');
    }
  }

  /// Adds a tag to a recipe
  Future<Recipe> addTag(Recipe recipe, String newTag) async {
    final trimmedTag = newTag.trim();
    if (trimmedTag.isEmpty) {
      throw ArgumentError('Tag cannot be empty');
    }

    // Avoid duplicates
    if (recipe.tags.contains(trimmedTag)) {
      throw ArgumentError('Tag already exists');
    }

    final updatedTags = [...recipe.tags, trimmedTag];
    final updatedRecipe = recipe.copyWith(tags: updatedTags);

    return await _recipeService.updateRecipe(updatedRecipe);
  }

  /// Removes a tag from a recipe
  Future<Recipe> removeTag(Recipe recipe, String tagToRemove) async {
    final updatedTags = recipe.tags.where((tag) => tag != tagToRemove).toList();
    final updatedRecipe = recipe.copyWith(tags: updatedTags);

    return await _recipeService.updateRecipe(updatedRecipe);
  }

  /// Updates recipe servings and returns scaled recipe
  Recipe updateServings(Recipe recipe, int newServings) {
    if (newServings <= 0) {
      throw ArgumentError('Servings must be positive');
    }

    return recipe.copyWith(servings: newServings);
  }
}
