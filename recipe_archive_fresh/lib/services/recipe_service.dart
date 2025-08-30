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
    throw Exception('User not authenticated');
  }
  
  final recipeService = ref.read(recipeServiceProvider);
  try {
    return await recipeService.getRecipes();
  } catch (e) {
    print('Recipe fetch error: $e');
    throw Exception('Failed to load recipes: ${e.toString()}');
  }
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
    
    // Check if we're in development mode (localhost)
    if (Uri.base.host == 'localhost' || Uri.base.host == '127.0.0.1') {
      print('Development mode detected - using mock data to bypass CORS');
      return _getMockRecipes();
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

  // Mock data for development
  List<Recipe> _getMockRecipes() {
    return [
      Recipe(
        id: '1',
        title: 'Classic Chocolate Chip Cookies',
        description: 'Soft and chewy chocolate chip cookies that are perfect for any occasion.',
        cookingTime: 25,
        prepTime: 15,
        servings: 24,
        difficulty: 'Easy',
        cuisine: 'American',
        ingredients: [
          RecipeIngredient(text: '2 1/4 cups all-purpose flour'),
          RecipeIngredient(text: '1 teaspoon baking soda'),
          RecipeIngredient(text: '1 teaspoon salt'),
          RecipeIngredient(text: '1 cup butter, softened'),
          RecipeIngredient(text: '3/4 cup granulated sugar'),
          RecipeIngredient(text: '3/4 cup brown sugar, packed'),
          RecipeIngredient(text: '2 large eggs'),
          RecipeIngredient(text: '2 teaspoons vanilla extract'),
          RecipeIngredient(text: '2 cups chocolate chips'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Preheat oven to 375°F (190°C).'),
          RecipeInstruction(stepNumber: 2, text: 'Mix flour, baking soda, and salt in a bowl.'),
          RecipeInstruction(stepNumber: 3, text: 'Cream butter and both sugars until fluffy.'),
          RecipeInstruction(stepNumber: 4, text: 'Beat in eggs and vanilla.'),
          RecipeInstruction(stepNumber: 5, text: 'Gradually add flour mixture.'),
          RecipeInstruction(stepNumber: 6, text: 'Stir in chocolate chips.'),
          RecipeInstruction(stepNumber: 7, text: 'Drop rounded tablespoons onto ungreased cookie sheets.'),
          RecipeInstruction(stepNumber: 8, text: 'Bake 9-11 minutes until golden brown.'),
          RecipeInstruction(stepNumber: 9, text: 'Cool on baking sheet 2 minutes; remove to wire rack.'),
        ],
        tags: ['dessert', 'cookies', 'chocolate'],
        imageUrl: 'https://via.placeholder.com/300x200?text=Chocolate+Chip+Cookies',
        sourceUrl: 'https://example.com/chocolate-chip-cookies',
        sourceName: 'Recipe Archive Demo',
      ),
      Recipe(
        id: '2',
        title: 'Homemade Pizza Margherita',
        description: 'Authentic Italian pizza with fresh tomatoes, mozzarella, and basil.',
        cookingTime: 12,
        prepTime: 120,
        servings: 4,
        difficulty: 'Medium',
        cuisine: 'Italian',
        ingredients: [
          RecipeIngredient(text: '1 lb pizza dough'),
          RecipeIngredient(text: '1/2 cup pizza sauce'),
          RecipeIngredient(text: '8 oz fresh mozzarella, sliced'),
          RecipeIngredient(text: '1/4 cup fresh basil leaves'),
          RecipeIngredient(text: '2 tablespoons olive oil'),
          RecipeIngredient(text: '1/2 teaspoon salt'),
          RecipeIngredient(text: '1/4 teaspoon black pepper'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Preheat oven to 500°F (260°C).'),
          RecipeInstruction(stepNumber: 2, text: 'Roll out pizza dough on floured surface.'),
          RecipeInstruction(stepNumber: 3, text: 'Transfer to pizza stone or baking sheet.'),
          RecipeInstruction(stepNumber: 4, text: 'Spread sauce evenly over dough.'),
          RecipeInstruction(stepNumber: 5, text: 'Add mozzarella slices.'),
          RecipeInstruction(stepNumber: 6, text: 'Drizzle with olive oil.'),
          RecipeInstruction(stepNumber: 7, text: 'Bake 10-12 minutes until crust is golden.'),
          RecipeInstruction(stepNumber: 8, text: 'Top with fresh basil leaves.'),
          RecipeInstruction(stepNumber: 9, text: 'Season with salt and pepper.'),
          RecipeInstruction(stepNumber: 10, text: 'Slice and serve immediately.'),
        ],
        tags: ['dinner', 'pizza', 'italian', 'vegetarian'],
        imageUrl: 'https://via.placeholder.com/300x200?text=Pizza+Margherita',
        sourceUrl: 'https://example.com/pizza-margherita',
        sourceName: 'Recipe Archive Demo',
      ),
      Recipe(
        id: '3',
        title: 'Thai Green Curry',
        description: 'Aromatic and spicy Thai curry with coconut milk, vegetables, and your choice of protein.',
        cookingTime: 25,
        prepTime: 20,
        servings: 4,
        difficulty: 'Medium',
        cuisine: 'Thai',
        ingredients: [
          RecipeIngredient(text: '2 tablespoons green curry paste'),
          RecipeIngredient(text: '1 can (14oz) coconut milk'),
          RecipeIngredient(text: '1 lb chicken breast, sliced'),
          RecipeIngredient(text: '1 eggplant, cubed'),
          RecipeIngredient(text: '1 red bell pepper, sliced'),
          RecipeIngredient(text: '1/4 cup Thai basil leaves'),
          RecipeIngredient(text: '2 tablespoons fish sauce'),
          RecipeIngredient(text: '1 tablespoon palm sugar'),
          RecipeIngredient(text: '2 kaffir lime leaves'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Heat oil in a wok over medium-high heat.'),
          RecipeInstruction(stepNumber: 2, text: 'Fry curry paste for 1-2 minutes until fragrant.'),
          RecipeInstruction(stepNumber: 3, text: 'Add thick coconut cream, stir until combined.'),
          RecipeInstruction(stepNumber: 4, text: 'Add chicken and cook until nearly done.'),
          RecipeInstruction(stepNumber: 5, text: 'Add remaining coconut milk and bring to simmer.'),
          RecipeInstruction(stepNumber: 6, text: 'Add vegetables and cook until tender.'),
          RecipeInstruction(stepNumber: 7, text: 'Season with fish sauce and palm sugar.'),
          RecipeInstruction(stepNumber: 8, text: 'Add lime leaves and basil.'),
          RecipeInstruction(stepNumber: 9, text: 'Serve over jasmine rice.'),
        ],
        tags: ['dinner', 'curry', 'thai', 'spicy'],
        imageUrl: 'https://via.placeholder.com/300x200?text=Thai+Green+Curry',
        sourceUrl: 'https://example.com/thai-green-curry',
        sourceName: 'Recipe Archive Demo',
      ),
    ];
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

  // Delete recipe
  Future<void> deleteRecipe(String id) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }
    
    // In development mode, just simulate deletion
    if (Uri.base.host == 'localhost' || Uri.base.host == '127.0.0.1') {
      print('Development mode: Simulating recipe deletion for ID: $id');
      await Future.delayed(const Duration(milliseconds: 500));
      return;
    }
    
    try {
      final response = await http.delete(
        Uri.parse('$apiUrl/v1/recipes/$id'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.accessToken}',
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 204) {
        return;
      } else {
        throw Exception('Failed to delete recipe: HTTP ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error while deleting recipe: $e');
    }
  }

}
