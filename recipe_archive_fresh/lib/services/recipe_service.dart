import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/recipe.dart';

// Provider for the RecipeService
final recipeServiceProvider = Provider<RecipeService>((ref) {
  return RecipeService();
});

// Provider for recipes list
final recipesProvider = FutureProvider<List<Recipe>>((ref) async {
  final recipeService = ref.read(recipeServiceProvider);
  return recipeService.getRecipes();
});

class RecipeService {
  static const String baseUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';
  static const String localUrl = 'http://localhost:8080';
  
  // Use mock data initially, switch to API later
  static const bool useMockData = true;
  
  String get apiUrl => useMockData ? localUrl : baseUrl;

  // Get all recipes (with mock data for now)
  Future<List<Recipe>> getRecipes({
    int? limit,
    String? search,
  }) async {
    if (useMockData) {
      // Return mock data for immediate functionality
      await Future.delayed(const Duration(milliseconds: 500)); // Simulate network delay
      return _getMockRecipes();
    }
    
    // Real API call (for later)
    final queryParams = <String, String>{};
    if (limit != null) queryParams['limit'] = limit.toString();
    if (search != null && search.isNotEmpty) queryParams['search'] = search;
    
    final uri = Uri.parse('$apiUrl/v1/recipes').replace(queryParameters: queryParams);
    
    try {
      final response = await http.get(
        uri,
        headers: {'Content-Type': 'application/json'},
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
    if (useMockData) {
      await Future.delayed(const Duration(milliseconds: 300));
      return _getMockRecipes().firstWhere((recipe) => recipe.id == id);
    }
    
    try {
      final response = await http.get(
        Uri.parse('$apiUrl/v1/recipes/$id'),
        headers: {'Content-Type': 'application/json'},
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

  // Mock data for immediate functionality
  List<Recipe> _getMockRecipes() {
    return [
      Recipe(
        id: '1',
        title: 'Classic Margherita Pizza',
        description: 'A simple yet delicious pizza with fresh tomatoes, mozzarella, and basil.',
        imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800',
        ingredients: const [
          RecipeIngredient(text: '1 pizza dough'),
          RecipeIngredient(text: '1/2 cup pizza sauce'),
          RecipeIngredient(text: '8 oz fresh mozzarella, sliced'),
          RecipeIngredient(text: 'Fresh basil leaves'),
          RecipeIngredient(text: '2 tbsp olive oil'),
          RecipeIngredient(text: 'Salt and pepper to taste'),
        ],
        instructions: const [
          RecipeInstruction(stepNumber: 1, text: 'Preheat oven to 475°F (245°C).'),
          RecipeInstruction(stepNumber: 2, text: 'Roll out pizza dough on a floured surface.'),
          RecipeInstruction(stepNumber: 3, text: 'Spread pizza sauce evenly over dough.'),
          RecipeInstruction(stepNumber: 4, text: 'Add mozzarella slices and drizzle with olive oil.'),
          RecipeInstruction(stepNumber: 5, text: 'Bake for 10-12 minutes until crust is golden.'),
          RecipeInstruction(stepNumber: 6, text: 'Top with fresh basil and serve immediately.'),
        ],
        cookingTime: 25,
        servings: 4,
        cuisine: 'Italian',
        tags: ['pizza', 'vegetarian', 'italian'],
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
      Recipe(
        id: '2',
        title: 'Chicken Stir Fry',
        description: 'Quick and healthy stir fry with chicken and vegetables.',
        imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800',
        ingredients: const [
          RecipeIngredient(text: '1 lb chicken breast, sliced'),
          RecipeIngredient(text: '2 cups mixed vegetables'),
          RecipeIngredient(text: '3 tbsp soy sauce'),
          RecipeIngredient(text: '2 tbsp vegetable oil'),
          RecipeIngredient(text: '2 cloves garlic, minced'),
          RecipeIngredient(text: '1 tsp ginger, grated'),
        ],
        instructions: const [
          RecipeInstruction(stepNumber: 1, text: 'Heat oil in a large wok or skillet.'),
          RecipeInstruction(stepNumber: 2, text: 'Add chicken and cook until no longer pink.'),
          RecipeInstruction(stepNumber: 3, text: 'Add garlic and ginger, stir for 30 seconds.'),
          RecipeInstruction(stepNumber: 4, text: 'Add vegetables and stir fry for 3-4 minutes.'),
          RecipeInstruction(stepNumber: 5, text: 'Add soy sauce and toss to combine.'),
          RecipeInstruction(stepNumber: 6, text: 'Serve over rice or noodles.'),
        ],
        cookingTime: 15,
        servings: 4,
        cuisine: 'Asian',
        tags: ['chicken', 'healthy', 'quick'],
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
      Recipe(
        id: '3',
        title: 'Chocolate Chip Cookies',
        description: 'Classic homemade chocolate chip cookies that are crispy on the outside and chewy on the inside.',
        imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800',
        ingredients: const [
          RecipeIngredient(text: '2 1/4 cups all-purpose flour'),
          RecipeIngredient(text: '1 tsp baking soda'),
          RecipeIngredient(text: '1 cup butter, softened'),
          RecipeIngredient(text: '3/4 cup granulated sugar'),
          RecipeIngredient(text: '3/4 cup brown sugar'),
          RecipeIngredient(text: '2 large eggs'),
          RecipeIngredient(text: '2 tsp vanilla extract'),
          RecipeIngredient(text: '2 cups chocolate chips'),
        ],
        instructions: const [
          RecipeInstruction(stepNumber: 1, text: 'Preheat oven to 375°F (190°C).'),
          RecipeInstruction(stepNumber: 2, text: 'Mix flour and baking soda in a bowl.'),
          RecipeInstruction(stepNumber: 3, text: 'Cream butter and both sugars until fluffy.'),
          RecipeInstruction(stepNumber: 4, text: 'Beat in eggs and vanilla.'),
          RecipeInstruction(stepNumber: 5, text: 'Gradually blend in flour mixture.'),
          RecipeInstruction(stepNumber: 6, text: 'Stir in chocolate chips.'),
          RecipeInstruction(stepNumber: 7, text: 'Drop rounded tablespoons onto ungreased sheets.'),
          RecipeInstruction(stepNumber: 8, text: 'Bake 9-11 minutes until golden brown.'),
        ],
        cookingTime: 45,
        servings: 24,
        cuisine: 'American',
        tags: ['dessert', 'cookies', 'chocolate'],
        createdAt: DateTime.now().subtract(const Duration(days: 3)),
      ),
    ];
  }
}
