import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../models/recipe.dart';
import 'auth_service.dart';

// Provider for the RecipeService
final recipeServiceProvider = Provider<RecipeService>((ref) {
  final authService = ref.read(authServiceProvider);
  return RecipeService(authService);
});

// Provider for recipes list
final recipesProvider = FutureProvider<List<Recipe>>((ref) async {
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) {
    return [];
  }
  
  final recipeService = ref.read(recipeServiceProvider);
  return recipeService.getRecipes();
});

class RecipeService {
  final AuthenticationService _authService;
  
  RecipeService(this._authService);
  
  String get apiUrl => dotenv.env['API_BASE_URL'] ?? 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';

  // Get all recipes from API
  Future<List<Recipe>> getRecipes({
    int? limit,
    String? search,
  }) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }
    
    final queryParams = <String, String>{};
    if (limit != null) queryParams['limit'] = limit.toString();
    if (search != null && search.isNotEmpty) queryParams['search'] = search;
    
    final uri = Uri.parse('$apiUrl/v1/recipes').replace(queryParameters: queryParams);
    
    try {
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.accessToken}',
        },
      );
      
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> recipesJson = data['recipes'] ?? [];
        return recipesJson.map((json) => Recipe.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load recipes: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Get single recipe
  Future<Recipe?> getRecipe(String id) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }
    
    try {
      final response = await http.get(
        Uri.parse('$apiUrl/v1/recipes/$id'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.accessToken}',
        },
      );
      
      if (response.statusCode == 200) {
        return Recipe.fromJson(json.decode(response.body));
      } else {
        return null;
      }
    } catch (e) {
      throw Exception('Failed to load recipe: $e');
    }
  }

}
