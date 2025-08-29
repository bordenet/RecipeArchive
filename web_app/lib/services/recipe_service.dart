import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/recipe.dart';

class RecipeService {
  static const String baseUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';
  
  // For development, you can switch to local backend
  static const String localUrl = 'http://localhost:8080';
  
  // Toggle this for development vs production
  static const bool useLocalBackend = false;
  
  String get apiUrl => useLocalBackend ? localUrl : baseUrl;

  // Get all recipes
  Future<List<Recipe>> getRecipes({
    int? limit,
    String? cursor,
    String? search,
    List<String>? tags,
    String? cuisine,
  }) async {
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
        headers: _getHeaders(),
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
    final uri = Uri.parse('$apiUrl/v1/recipes/$id');
    
    try {
      final response = await http.get(
        uri,
        headers: _getHeaders(),
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
        headers: _getHeaders(),
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
        headers: _getHeaders(),
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
        headers: _getHeaders(),
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
    return allRecipes.where((recipe) => recipe.isFavorite).toList();
  }

  // Toggle favorite status
  Future<Recipe> toggleFavorite(Recipe recipe) async {
    final updatedRecipe = recipe.copyWith(isFavorite: !recipe.isFavorite);
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

  // Helper method to get common headers
  Map<String, String> _getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // TODO: Add authentication headers when implemented
      // 'Authorization': 'Bearer $token',
    };
  }

  // Get available cuisines (for filtering)
  Future<List<String>> getCuisines() async {
    final uri = Uri.parse('$apiUrl/v1/cuisines');
    
    try {
      final response = await http.get(
        uri,
        headers: _getHeaders(),
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
        headers: _getHeaders(),
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
