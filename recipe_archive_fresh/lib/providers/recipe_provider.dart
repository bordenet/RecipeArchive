import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/recipe.dart';
import '../services/recipe_service.dart';
import '../services/auth_service.dart';

// Recipe service provider
final recipeServiceProvider = Provider<RecipeService>((ref) {
  final authService = ref.read(authServiceProvider);
  return RecipeService(authService);
});

// Recipe state notifier
class RecipeNotifier extends StateNotifier<AsyncValue<List<Recipe>>> {
  final RecipeService _recipeService;

  RecipeNotifier(this._recipeService) : super(const AsyncValue.loading()) {
    loadRecipes();
  }

  Future<void> loadRecipes() async {
    try {
      state = const AsyncValue.loading();
      final recipes = await _recipeService.getRecipes();
      state = AsyncValue.data(recipes);
    } catch (e, stackTrace) {
      state = AsyncValue.error(e, stackTrace);
    }
  }

  Future<void> addRecipe(Recipe recipe) async {
    try {
      final updatedRecipe = await _recipeService.saveRecipe(recipe);
      
      state.whenData((recipes) {
        state = AsyncValue.data([...recipes, updatedRecipe]);
      });
    } catch (e, stackTrace) {
      state = AsyncValue.error(e, stackTrace);
    }
  }

  Future<void> updateRecipe(Recipe recipe) async {
    try {
      final updatedRecipe = await _recipeService.updateRecipe(recipe);
      
      state.whenData((recipes) {
        final updatedRecipes = recipes.map((r) => 
          r.id == updatedRecipe.id ? updatedRecipe : r
        ).toList();
        state = AsyncValue.data(updatedRecipes);
      });
    } catch (e, stackTrace) {
      state = AsyncValue.error(e, stackTrace);
    }
  }

  Future<void> deleteRecipe(String recipeId) async {
    try {
      await _recipeService.deleteRecipe(recipeId);
      
      state.whenData((recipes) {
        final updatedRecipes = recipes.where((r) => r.id != recipeId).toList();
        state = AsyncValue.data(updatedRecipes);
      });
    } catch (e, stackTrace) {
      state = AsyncValue.error(e, stackTrace);
    }
  }

  Future<void> toggleFavorite(String recipeId) async {
    state.whenData((recipes) async {
      final recipeIndex = recipes.indexWhere((r) => r.id == recipeId);
      if (recipeIndex != -1) {
        final recipe = recipes[recipeIndex];
        final updatedRecipe = recipe.copyWith(isFavorite: !recipe.isFavorite);
        
        try {
          await updateRecipe(updatedRecipe);
        } catch (e) {
          // Handle error - could show a toast or snackbar
          rethrow;
        }
      }
    });
  }

  Future<void> addPersonalNote(String recipeId, String note) async {
    state.whenData((recipes) async {
      final recipeIndex = recipes.indexWhere((r) => r.id == recipeId);
      if (recipeIndex != -1) {
        final recipe = recipes[recipeIndex];
        final updatedRecipe = recipe.copyWith(personalNotes: note);
        await updateRecipe(updatedRecipe);
      }
    });
  }

  Future<void> updatePersonalRating(String recipeId, double rating) async {
    state.whenData((recipes) async {
      final recipeIndex = recipes.indexWhere((r) => r.id == recipeId);
      if (recipeIndex != -1) {
        final recipe = recipes[recipeIndex];
        final updatedRecipe = recipe.copyWith(personalRating: rating);
        await updateRecipe(updatedRecipe);
      }
    });
  }

  Future<void> addToCategory(String recipeId, String category) async {
    state.whenData((recipes) async {
      final recipeIndex = recipes.indexWhere((r) => r.id == recipeId);
      if (recipeIndex != -1) {
        final recipe = recipes[recipeIndex];
        if (!recipe.categories.contains(category)) {
          final updatedCategories = [...recipe.categories, category];
          final updatedRecipe = recipe.copyWith(categories: updatedCategories);
          await updateRecipe(updatedRecipe);
        }
      }
    });
  }

  Future<void> removeFromCategory(String recipeId, String category) async {
    state.whenData((recipes) async {
      final recipeIndex = recipes.indexWhere((r) => r.id == recipeId);
      if (recipeIndex != -1) {
        final recipe = recipes[recipeIndex];
        final updatedCategories = recipe.categories.where((c) => c != category).toList();
        final updatedRecipe = recipe.copyWith(categories: updatedCategories);
        await updateRecipe(updatedRecipe);
      }
    });
  }

  Future<void> updatePersonalYield(String recipeId, int? personalYield) async {
    state.whenData((recipes) async {
      final recipeIndex = recipes.indexWhere((r) => r.id == recipeId);
      if (recipeIndex != -1) {
        final recipe = recipes[recipeIndex];
        final updatedRecipe = recipe.copyWith(personalYield: personalYield);
        await updateRecipe(updatedRecipe);
      }
    });
  }

  Future<void> bulkUpdateRecipes(List<Recipe> updatedRecipes) async {
    try {
      // Save all recipes to AWS backend
      final savedRecipes = <Recipe>[];
      for (final recipe in updatedRecipes) {
        final savedRecipe = await _recipeService.updateRecipe(recipe);
        savedRecipes.add(savedRecipe);
      }
      
      // Update local state
      state.whenData((currentRecipes) {
        final updatedList = [...currentRecipes];
        for (final savedRecipe in savedRecipes) {
          final index = updatedList.indexWhere((r) => r.id == savedRecipe.id);
          if (index != -1) {
            updatedList[index] = savedRecipe;
          }
        }
        state = AsyncValue.data(updatedList);
      });
    } catch (e, stackTrace) {
      state = AsyncValue.error(e, stackTrace);
    }
  }

  Future<void> searchRecipes(String query) async {
    try {
      state = const AsyncValue.loading();
      final recipes = await _recipeService.searchRecipes(query);
      state = AsyncValue.data(recipes);
    } catch (e, stackTrace) {
      state = AsyncValue.error(e, stackTrace);
    }
  }

  Future<void> filterByCategory(String category) async {
    try {
      state = const AsyncValue.loading();
      final recipes = await _recipeService.getRecipesByCategory(category);
      state = AsyncValue.data(recipes);
    } catch (e, stackTrace) {
      state = AsyncValue.error(e, stackTrace);
    }
  }

  Future<void> getFavorites() async {
    try {
      state = const AsyncValue.loading();
      final recipes = await _recipeService.getFavoriteRecipes();
      state = AsyncValue.data(recipes);
    } catch (e, stackTrace) {
      state = AsyncValue.error(e, stackTrace);
    }
  }
}

// Recipe provider
final recipeProvider = StateNotifierProvider<RecipeNotifier, AsyncValue<List<Recipe>>>((ref) {
  final recipeService = ref.watch(recipeServiceProvider);
  return RecipeNotifier(recipeService);
});

// Search query provider
final searchQueryProvider = StateProvider<String>((ref) => '');

// Selected category filter provider
final selectedCategoryProvider = StateProvider<String?>((ref) => null);

// Filtered recipes provider (combining search and category filters)
final filteredRecipesProvider = Provider<AsyncValue<List<Recipe>>>((ref) {
  final recipes = ref.watch(recipeProvider);
  final searchQuery = ref.watch(searchQueryProvider);
  final selectedCategory = ref.watch(selectedCategoryProvider);

  return recipes.when(
    data: (recipeList) {
      var filteredList = recipeList;

      // Apply search filter
      if (searchQuery.isNotEmpty) {
        filteredList = filteredList.where((recipe) {
          return recipe.title.toLowerCase().contains(searchQuery.toLowerCase()) ||
                 (recipe.description?.toLowerCase().contains(searchQuery.toLowerCase()) ?? false) ||
                 recipe.tags.any((tag) => tag.toLowerCase().contains(searchQuery.toLowerCase())) ||
                 recipe.categories.any((category) => category.toLowerCase().contains(searchQuery.toLowerCase())) ||
                 recipe.cuisine?.toLowerCase().contains(searchQuery.toLowerCase()) == true;
        }).toList();
      }

      // Apply category filter
      if (selectedCategory != null) {
        filteredList = filteredList.where((recipe) => 
          recipe.categories.contains(selectedCategory)).toList();
      }

      return AsyncValue.data(filteredList);
    },
    loading: () => const AsyncValue.loading(),
    error: (error, stackTrace) => AsyncValue.error(error, stackTrace),
  );
});

// Favorite recipes provider
final favoriteRecipesProvider = Provider<AsyncValue<List<Recipe>>>((ref) {
  final recipes = ref.watch(recipeProvider);
  
  return recipes.when(
    data: (recipeList) {
      final favoriteList = recipeList.where((recipe) => recipe.isFavorite).toList();
      return AsyncValue.data(favoriteList);
    },
    loading: () => const AsyncValue.loading(),
    error: (error, stackTrace) => AsyncValue.error(error, stackTrace),
  );
});

// Categories provider (all unique categories from all recipes)
final categoriesProvider = Provider<List<String>>((ref) {
  final recipes = ref.watch(recipeProvider);
  
  return recipes.when(
    data: (recipeList) {
      final allCategories = recipeList
          .expand((recipe) => recipe.categories)
          .toSet()
          .toList()
        ..sort();
      return allCategories;
    },
    loading: () => <String>[],
    error: (_, __) => <String>[],
  );
});

// Individual recipe provider
final recipeByIdProvider = Provider.family<Recipe?, String>((ref, recipeId) {
  final recipes = ref.watch(recipeProvider);
  
  return recipes.when(
    data: (recipeList) => recipeList.where((r) => r.id == recipeId).firstOrNull,
    loading: () => null,
    error: (_, __) => null,
  );
});

// Recently modified recipes provider
final recentlyModifiedRecipesProvider = Provider<AsyncValue<List<Recipe>>>((ref) {
  final recipes = ref.watch(recipeProvider);
  
  return recipes.when(
    data: (recipeList) {
      final sortedList = [...recipeList];
      sortedList.sort((a, b) {
        final aDate = a.updatedAt ?? a.createdAt ?? DateTime(1970);
        final bDate = b.updatedAt ?? b.createdAt ?? DateTime(1970);
        return bDate.compareTo(aDate);
      });
      return AsyncValue.data(sortedList.take(10).toList());
    },
    loading: () => const AsyncValue.loading(),
    error: (error, stackTrace) => AsyncValue.error(error, stackTrace),
  );
});

// User's personalized recipes (recipes with any user modifications)
final personalizedRecipesProvider = Provider<AsyncValue<List<Recipe>>>((ref) {
  final recipes = ref.watch(recipeProvider);
  
  return recipes.when(
    data: (recipeList) {
      final personalizedList = recipeList.where((recipe) => recipe.hasPersonalizations).toList();
      return AsyncValue.data(personalizedList);
    },
    loading: () => const AsyncValue.loading(),
    error: (error, stackTrace) => AsyncValue.error(error, stackTrace),
  );
});