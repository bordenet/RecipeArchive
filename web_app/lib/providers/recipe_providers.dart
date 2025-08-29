import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/recipe_service.dart';

// Provider for the recipe service
final recipeServiceProvider = Provider<RecipeService>((ref) {
  return RecipeService();
});

// Providers for state management
final selectedFiltersProvider = StateProvider<Map<String, dynamic>>((ref) {
  return <String, dynamic>{};
});

final searchQueryProvider = StateProvider<String>((ref) {
  return '';
});

// Provider for fetching recipes with filters and search
final recipesProvider = FutureProvider<List<dynamic>>((ref) async {
  final recipeService = ref.read(recipeServiceProvider);
  final filters = ref.watch(selectedFiltersProvider);
  final searchQuery = ref.watch(searchQueryProvider);
  
  if (searchQuery.isNotEmpty) {
    return recipeService.searchRecipes(searchQuery);
  }
  
  return recipeService.getAllRecipes();
});

// Provider for fetching available cuisines
final cuisinesProvider = FutureProvider<List<String>>((ref) async {
  final recipeService = ref.read(recipeServiceProvider);
  return recipeService.getCuisines();
});

// Provider for fetching available tags
final tagsProvider = FutureProvider<List<String>>((ref) async {
  final recipeService = ref.read(recipeServiceProvider);
  return recipeService.getTags();
});
