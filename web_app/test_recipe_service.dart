import 'lib/services/recipe_service.dart';
import 'lib/services/auth_service.dart';

void main() async {
  print('🧪 Testing Recipe Service with Authentication');
  
  // First authenticate
  final authService = AuthService();
  
  try {
    print('\n🔐 Authenticating...');
    final authSuccess = await authService.authenticate('mattbordenet@hotmail.com', 'Recipe123');
    
    if (!authSuccess) {
      print('❌ Authentication failed');
      return;
    }
    
    print('✅ Authentication successful!');
    
    // Now test recipe service with the authenticated service
    final recipeService = RecipeService(authService: authService);
    
    print('\n📋 Fetching recipes from authenticated API...');
    final recipes = await recipeService.getRecipes();
    
    print('✅ Successfully retrieved ${recipes.length} recipes!');
    
    for (var i = 0; i < recipes.length && i < 5; i++) {
      final recipe = recipes[i];
      print('  ${i + 1}. ${recipe.title}');
      print('     Source: ${recipe.sourceUrl}');
      print('     Created: ${recipe.createdAt}');
      if (recipe.prepTimeMinutes != null) {
        print('     Time: ${recipe.prepTimeMinutes} min');
      }
      if (recipe.servings != null) {
        print('     Servings: ${recipe.servings}');
      }
      print('     Ingredients: ${recipe.ingredients.length}');
      print('     Instructions: ${recipe.instructions.length}');
      print('');
    }
    
    if (recipes.length > 5) {
      print('     ... and ${recipes.length - 5} more recipes');
    }
    
    print('\n🎯 Integration Success! Flutter can authenticate and fetch recipes');
    
  } catch (e) {
    print('❌ Error: $e');
  }
}
