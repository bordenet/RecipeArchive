import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/recipe.dart';
import 'auth_service.dart';
import 'mock_recipe_service.dart';

// Create a provider for the RecipeService
final recipeServiceProvider = Provider<RecipeService>((ref) {
  return RecipeService();
});

// Create a provider for the RecipeService
final recipeServiceProvider = Provider<RecipeService>((ref) {
  return RecipeService();
});

class RecipeService {
  static const String baseUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';
  
  // For development, you can switch to local backend
  static const String localUrl = 'http://localhost:8080';
  
  // Toggle this for development vs production
  static const bool useLocalBackend = false;
  
  // Toggle this to use mock data for development
  static const bool useMockData = true;
  
  String get apiUrl => useLocalBackend ? localUrl : baseUrl;
  
  // Authentication service - accept as parameter to share state
  final AuthService _authService;
  
  RecipeService({AuthService? authService}) : _authService = authService ?? AuthService();

  // Get all recipes
  Future<List<Recipe>> getRecipes({
    int? limit,
    String? cursor,
    String? search,
    List<String>? tags,
    String? cuisine,
  }) async {
    // Return mock data for development
    if (useMockData) {
      await Future.delayed(const Duration(milliseconds: 500)); // Simulate network delay
      List<Recipe> recipes = MockRecipeService.getMockRecipes();
      
      // Apply search filter if provided
      if (search != null && search.isNotEmpty) {
        recipes = recipes.where((recipe) {
          return recipe.title.toLowerCase().contains(search.toLowerCase()) ||
                 recipe.description?.toLowerCase().contains(search.toLowerCase()) == true ||
                 (recipe.tags?.any((tag) => tag.toLowerCase().contains(search.toLowerCase())) ?? false);
        }).toList();
      }
      
      // Apply cuisine filter if provided
      if (cuisine != null && cuisine.isNotEmpty) {
        recipes = recipes.where((recipe) => recipe.cuisine?.toLowerCase() == cuisine.toLowerCase()).toList();
      }
      
      // Apply tags filter if provided
      if (tags != null && tags.isNotEmpty) {
        recipes = recipes.where((recipe) {
          return tags.any((tag) => (recipe.tags?.contains(tag.toLowerCase()) ?? false));
        }).toList();
      }
      
      // Apply limit if provided
      if (limit != null && limit > 0) {
        recipes = recipes.take(limit).toList();
      }
      
      return recipes;
    }
    
    // Original API code for production
    final queryParams = <String, String>{};
    
    if (limit != null) queryParams['limit'] = limit.toString();
    if (cursor != null) queryParams['cursor'] = cursor;
    if (search != null && search.isNotEmpty) queryParams['search'] = search;
    if (tags != null && tags.isNotEmpty) queryParams['tags'] = tags.join(',');
    if (cuisine != null && cuisine.isNotEmpty) queryParams['cuisine'] = cuisine;
    
    final uri = Uri.parse('$apiUrl/v1/recipes').replace(queryParameters: queryParams);
    
    try {
      final response = await http.get(
        uri,
        headers: await _getHeaders(),
      );
      
      if (response.statusCode == 200) {
        final jsonData = json.decode(response.body);
        final List<dynamic> recipesJson = jsonData['recipes'] ?? [];
        
        return recipesJson
            .map((json) => Recipe.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('Failed to load recipes: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Get a single recipe by ID
  Future<Recipe> getRecipe(String id) async {
    // Return mock data for development
    if (useMockData) {
      await Future.delayed(const Duration(milliseconds: 300)); // Simulate network delay
      final recipes = MockRecipeService.getMockRecipes();
      final recipe = recipes.firstWhere((r) => r.id == id, orElse: () => throw Exception('Recipe not found'));
      return recipe;
    }
    
    // Original API code for production
    final uri = Uri.parse('$apiUrl/v1/recipes/$id');
    
    try {
      final response = await http.get(
        uri,
        headers: await _getHeaders(),
      );
      
      if (response.statusCode == 200) {
        final jsonData = json.decode(response.body);
        return Recipe.fromJson(jsonData);
      } else if (response.statusCode == 404) {
        throw Exception('Recipe not found');
      } else {
        throw Exception('Failed to load recipe: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Create a new recipe
  Future<Recipe> createRecipe(Recipe recipe) async {
    final uri = Uri.parse('$apiUrl/v1/recipes');
    
    try {
      final response = await http.post(
        uri,
        headers: await _getHeaders(),
        body: json.encode(recipe.toJson()),
      );
      
      if (response.statusCode == 201) {
        final jsonData = json.decode(response.body);
        return Recipe.fromJson(jsonData);
      } else {
        throw Exception('Failed to create recipe: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Update an existing recipe
  Future<Recipe> updateRecipe(Recipe recipe) async {
    final uri = Uri.parse('$apiUrl/v1/recipes/${recipe.id}');
    
    try {
      final response = await http.put(
        uri,
        headers: await _getHeaders(),
        body: json.encode(recipe.toJson()),
      );
      
      if (response.statusCode == 200) {
        final jsonData = json.decode(response.body);
        return Recipe.fromJson(jsonData);
      } else {
        throw Exception('Failed to update recipe: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Delete a recipe
  Future<void> deleteRecipe(String id) async {
    final uri = Uri.parse('$apiUrl/v1/recipes/$id');
    
    try {
      final response = await http.delete(
        uri,
        headers: await _getHeaders(),
      );
      
      if (response.statusCode != 204) {
        throw Exception('Failed to delete recipe: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Search recipes
  Future<List<Recipe>> searchRecipes(String query) async {
    return getRecipes(search: query);
  }

  // Get recipes by tag
  Future<List<Recipe>> getRecipesByTag(String tag) async {
    return getRecipes(tags: [tag]);
  }

  // Get favorite recipes
  Future<List<Recipe>> getFavoriteRecipes() async {
    final allRecipes = await getRecipes();
    return allRecipes.where((recipe) => recipe.isFavorite == true).toList();
  }

  // Toggle favorite status
  Future<Recipe> toggleFavorite(Recipe recipe) async {
    final currentFavorite = recipe.isFavorite ?? false;
    final updatedRecipe = recipe.copyWith(isFavorite: !currentFavorite);
    return await updateRecipe(updatedRecipe);
  }

  // Rate a recipe
  Future<Recipe> rateRecipe(Recipe recipe, int rating) async {
    if (rating < 1 || rating > 5) {
      throw ArgumentError('Rating must be between 1 and 5');
    }
    
    final updatedRecipe = recipe.copyWith(userRating: rating);
    return await updateRecipe(updatedRecipe);
  }

  // Add notes to a recipe
  Future<Recipe> addNotes(Recipe recipe, String notes) async {
    final updatedRecipe = recipe.copyWith(userNotes: notes);
    return await updateRecipe(updatedRecipe);
  }

  // Helper method to get authenticated headers
  Future<Map<String, String>> _getHeaders() async {
    final authHeaders = await _authService.getAuthHeaders();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...authHeaders,
    };
  }

  // Get available cuisines (for filtering)
  Future<List<String>> getCuisines() async {
    final uri = Uri.parse('$apiUrl/v1/cuisines');
    
    try {
      final response = await http.get(
        uri,
        headers: await _getHeaders(),
      );
      
      if (response.statusCode == 200) {
        final jsonData = json.decode(response.body);
        final List<dynamic> cuisines = jsonData['cuisines'] ?? [];
        return cuisines.cast<String>();
      } else {
        throw Exception('Failed to load cuisines: ${response.statusCode}');
      }
    } catch (e) {
      // Return default cuisines if API fails
      return [
        'Italian',
        'Mexican',
        'Asian',
        'American',
        'Mediterranean',
        'Indian',
        'French',
        'Thai',
        'Chinese',
        'Japanese',
      ];
    }
  }

  // Get available tags (for filtering)
  Future<List<String>> getTags() async {
    final uri = Uri.parse('$apiUrl/v1/tags');
    
    try {
      final response = await http.get(
        uri,
        headers: await _getHeaders(),
      );
      
      if (response.statusCode == 200) {
        final jsonData = json.decode(response.body);
        final List<dynamic> tags = jsonData['tags'] ?? [];
        return tags.cast<String>();
      } else {
        throw Exception('Failed to load tags: ${response.statusCode}');
      }
    } catch (e) {
      // Return default tags if API fails
      return [
        'vegetarian',
        'vegan',
        'gluten-free',
        'dairy-free',
        'quick',
        'easy',
        'healthy',
        'comfort-food',
        'dessert',
        'breakfast',
        'lunch',
        'dinner',
        'snack',
      ];
    }
  }
}
