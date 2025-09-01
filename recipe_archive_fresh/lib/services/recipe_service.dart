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
    // Recipe fetch error: $e
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
    
    // Connect to production API regardless of localhost - authentication handles CORS
    
    final queryParams = <String, String>{};
    if (limit != null) queryParams['limit'] = limit.toString();
    if (search != null && search.isNotEmpty) queryParams['search'] = search;
    
    final uri = Uri.parse('$apiUrl/v1/recipes').replace(queryParameters: queryParams);
    
    try {
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
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

  // Enhanced mock data with 12 recipes for development
  // Commented out to reduce lint warnings - unused method
  /* List<Recipe> _getEnhancedMockRecipes() {
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
        imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400',
        sourceUrl: 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/',
        sourceName: 'Allrecipes',
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
        imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400',
        sourceUrl: 'https://www.foodnetwork.com/recipes/bobby-flay/pizza-margherita-recipe-1135720',
        sourceName: 'Food Network',
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
        imageUrl: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400',
        sourceUrl: 'https://www.seriouseats.com/thai-style-green-curry-with-chicken-recipe',
        sourceName: 'Serious Eats',
      ),
      Recipe(
        id: '4',
        title: 'Creamy Mushroom Risotto',
        description: 'Rich and creamy Italian risotto with mixed mushrooms and parmesan.',
        cookingTime: 35,
        prepTime: 15,
        servings: 4,
        difficulty: 'Medium',
        cuisine: 'Italian',
        ingredients: [
          RecipeIngredient(text: '1 1/2 cups arborio rice'),
          RecipeIngredient(text: '4 cups chicken or vegetable stock'),
          RecipeIngredient(text: '1 lb mixed mushrooms, sliced'),
          RecipeIngredient(text: '1 onion, finely chopped'),
          RecipeIngredient(text: '3 cloves garlic, minced'),
          RecipeIngredient(text: '1/2 cup white wine'),
          RecipeIngredient(text: '1/2 cup grated parmesan'),
          RecipeIngredient(text: '2 tablespoons butter'),
          RecipeIngredient(text: '2 tablespoons olive oil'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Heat stock in a saucepan and keep warm.'),
          RecipeInstruction(stepNumber: 2, text: 'Sauté mushrooms until golden, set aside.'),
          RecipeInstruction(stepNumber: 3, text: 'Cook onion and garlic in olive oil until soft.'),
          RecipeInstruction(stepNumber: 4, text: 'Add rice and stir for 2 minutes.'),
          RecipeInstruction(stepNumber: 5, text: 'Add wine and stir until absorbed.'),
          RecipeInstruction(stepNumber: 6, text: 'Add stock one ladle at a time, stirring constantly.'),
          RecipeInstruction(stepNumber: 7, text: 'Stir in mushrooms, butter, and parmesan.'),
          RecipeInstruction(stepNumber: 8, text: 'Season and serve immediately.'),
        ],
        tags: ['dinner', 'risotto', 'italian', 'vegetarian'],
        imageUrl: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400',
        sourceUrl: 'https://www.epicurious.com/recipes/food/views/mushroom-risotto-51160540',
        sourceName: 'Epicurious',
      ),
      Recipe(
        id: '5',
        title: 'BBQ Pulled Pork Sandwiches',
        description: 'Slow-cooked pulled pork with tangy BBQ sauce on brioche buns.',
        cookingTime: 480,
        prepTime: 20,
        servings: 8,
        difficulty: 'Easy',
        cuisine: 'American',
        ingredients: [
          RecipeIngredient(text: '3 lbs pork shoulder'),
          RecipeIngredient(text: '2 tablespoons brown sugar'),
          RecipeIngredient(text: '2 tablespoons paprika'),
          RecipeIngredient(text: '1 tablespoon chili powder'),
          RecipeIngredient(text: '1 cup BBQ sauce'),
          RecipeIngredient(text: '8 brioche buns'),
          RecipeIngredient(text: '2 cups coleslaw mix'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Mix dry spices and rub on pork shoulder.'),
          RecipeInstruction(stepNumber: 2, text: 'Slow cook on low for 8 hours.'),
          RecipeInstruction(stepNumber: 3, text: 'Shred meat with two forks.'),
          RecipeInstruction(stepNumber: 4, text: 'Mix with BBQ sauce.'),
          RecipeInstruction(stepNumber: 5, text: 'Serve on buns with coleslaw.'),
        ],
        tags: ['dinner', 'bbq', 'pork', 'sandwiches'],
        imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=400',
        sourceUrl: 'https://www.food.com/recipe/slow-cooker-pulled-pork-sandwiches-17615',
        sourceName: 'Food.com',
      ),
      Recipe(
        id: '6',
        title: 'Fresh Caprese Salad',
        description: 'Simple Italian salad with tomatoes, mozzarella, and fresh basil.',
        cookingTime: 0,
        prepTime: 15,
        servings: 4,
        difficulty: 'Easy',
        cuisine: 'Italian',
        ingredients: [
          RecipeIngredient(text: '4 large tomatoes, sliced'),
          RecipeIngredient(text: '1 lb fresh mozzarella, sliced'),
          RecipeIngredient(text: '1/4 cup fresh basil leaves'),
          RecipeIngredient(text: '3 tablespoons extra virgin olive oil'),
          RecipeIngredient(text: '2 tablespoons balsamic vinegar'),
          RecipeIngredient(text: '1/2 teaspoon salt'),
          RecipeIngredient(text: '1/4 teaspoon black pepper'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Arrange tomato and mozzarella slices alternately.'),
          RecipeInstruction(stepNumber: 2, text: 'Scatter fresh basil leaves over top.'),
          RecipeInstruction(stepNumber: 3, text: 'Drizzle with olive oil and balsamic vinegar.'),
          RecipeInstruction(stepNumber: 4, text: 'Season with salt and pepper.'),
          RecipeInstruction(stepNumber: 5, text: 'Let stand 10 minutes before serving.'),
        ],
        tags: ['salad', 'italian', 'vegetarian', 'fresh'],
        imageUrl: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=400',
        sourceUrl: 'https://www.loveandlemons.com/caprese-salad-recipe/',
        sourceName: 'Love and Lemons',
      ),
      Recipe(
        id: '7',
        title: 'Beef Tacos with Corn Salsa',
        description: 'Seasoned ground beef tacos topped with fresh corn salsa and avocado.',
        cookingTime: 25,
        prepTime: 20,
        servings: 6,
        difficulty: 'Easy',
        cuisine: 'Mexican',
        ingredients: [
          RecipeIngredient(text: '1 lb ground beef'),
          RecipeIngredient(text: '12 corn tortillas'),
          RecipeIngredient(text: '2 cups corn kernels'),
          RecipeIngredient(text: '1 red bell pepper, diced'),
          RecipeIngredient(text: '1/4 cup red onion, diced'),
          RecipeIngredient(text: '2 avocados, sliced'),
          RecipeIngredient(text: '1 lime, juiced'),
          RecipeIngredient(text: '2 tablespoons taco seasoning'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Brown ground beef with taco seasoning.'),
          RecipeInstruction(stepNumber: 2, text: 'Mix corn, bell pepper, and onion for salsa.'),
          RecipeInstruction(stepNumber: 3, text: 'Add lime juice to corn salsa.'),
          RecipeInstruction(stepNumber: 4, text: 'Warm tortillas in dry pan.'),
          RecipeInstruction(stepNumber: 5, text: 'Assemble tacos with beef, salsa, and avocado.'),
        ],
        tags: ['dinner', 'tacos', 'mexican', 'beef'],
        imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400',
        sourceUrl: 'https://www.tasteofhome.com/recipes/beef-tacos/',
        sourceName: 'Taste of Home',
      ),
      Recipe(
        id: '8',
        title: 'Lemon Garlic Salmon',
        description: 'Pan-seared salmon with a bright lemon garlic butter sauce.',
        cookingTime: 15,
        prepTime: 10,
        servings: 4,
        difficulty: 'Medium',
        cuisine: 'Mediterranean',
        ingredients: [
          RecipeIngredient(text: '4 salmon fillets'),
          RecipeIngredient(text: '4 cloves garlic, minced'),
          RecipeIngredient(text: '1 lemon, juiced and zested'),
          RecipeIngredient(text: '3 tablespoons butter'),
          RecipeIngredient(text: '2 tablespoons olive oil'),
          RecipeIngredient(text: '2 tablespoons fresh parsley'),
          RecipeIngredient(text: '1/2 teaspoon salt'),
          RecipeIngredient(text: '1/4 teaspoon pepper'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Season salmon with salt and pepper.'),
          RecipeInstruction(stepNumber: 2, text: 'Heat olive oil in large skillet.'),
          RecipeInstruction(stepNumber: 3, text: 'Cook salmon skin-side down for 4-5 minutes.'),
          RecipeInstruction(stepNumber: 4, text: 'Flip and cook 3-4 minutes more.'),
          RecipeInstruction(stepNumber: 5, text: 'Remove salmon, add garlic to pan.'),
          RecipeInstruction(stepNumber: 6, text: 'Add butter, lemon juice, and zest.'),
          RecipeInstruction(stepNumber: 7, text: 'Pour sauce over salmon and garnish with parsley.'),
        ],
        tags: ['dinner', 'salmon', 'mediterranean', 'healthy'],
        imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
        sourceUrl: 'https://www.foodandwine.com/recipes/lemon-garlic-salmon',
        sourceName: 'Food & Wine',
      ),
      Recipe(
        id: '9',
        title: 'Vegetarian Chili',
        description: 'Hearty three-bean chili loaded with vegetables and warming spices.',
        cookingTime: 45,
        prepTime: 15,
        servings: 6,
        difficulty: 'Easy',
        cuisine: 'American',
        ingredients: [
          RecipeIngredient(text: '1 can black beans, drained'),
          RecipeIngredient(text: '1 can kidney beans, drained'),
          RecipeIngredient(text: '1 can pinto beans, drained'),
          RecipeIngredient(text: '1 can diced tomatoes'),
          RecipeIngredient(text: '1 bell pepper, diced'),
          RecipeIngredient(text: '1 onion, diced'),
          RecipeIngredient(text: '2 tablespoons chili powder'),
          RecipeIngredient(text: '1 teaspoon cumin'),
          RecipeIngredient(text: '2 cups vegetable broth'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Sauté onion and bell pepper until soft.'),
          RecipeInstruction(stepNumber: 2, text: 'Add spices and cook for 1 minute.'),
          RecipeInstruction(stepNumber: 3, text: 'Add tomatoes, beans, and broth.'),
          RecipeInstruction(stepNumber: 4, text: 'Simmer for 30-40 minutes.'),
          RecipeInstruction(stepNumber: 5, text: 'Taste and adjust seasoning.'),
          RecipeInstruction(stepNumber: 6, text: 'Serve with cornbread or rice.'),
        ],
        tags: ['dinner', 'chili', 'vegetarian', 'comfort-food'],
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
        sourceUrl: 'https://www.smittenkitchen.com/2010/01/hearty-lentil-and-tomato-stew/',
        sourceName: 'Smitten Kitchen',
      ),
      Recipe(
        id: '10',
        title: 'Greek Chicken Bowls',
        description: 'Mediterranean chicken bowls with rice, vegetables, and tzatziki sauce.',
        cookingTime: 30,
        prepTime: 20,
        servings: 4,
        difficulty: 'Medium',
        cuisine: 'Greek',
        ingredients: [
          RecipeIngredient(text: '1 lb chicken breast, cubed'),
          RecipeIngredient(text: '2 cups cooked rice'),
          RecipeIngredient(text: '1 cucumber, diced'),
          RecipeIngredient(text: '1 cup cherry tomatoes, halved'),
          RecipeIngredient(text: '1/2 red onion, sliced'),
          RecipeIngredient(text: '1/2 cup feta cheese, crumbled'),
          RecipeIngredient(text: '1/4 cup olive oil'),
          RecipeIngredient(text: '2 tablespoons lemon juice'),
          RecipeIngredient(text: '1 teaspoon oregano'),
          RecipeIngredient(text: '1/2 cup tzatziki sauce'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Marinate chicken in olive oil, lemon, and oregano.'),
          RecipeInstruction(stepNumber: 2, text: 'Cook chicken until golden and cooked through.'),
          RecipeInstruction(stepNumber: 3, text: 'Prepare vegetables and arrange in bowls.'),
          RecipeInstruction(stepNumber: 4, text: 'Add rice to each bowl as base.'),
          RecipeInstruction(stepNumber: 5, text: 'Top with chicken and vegetables.'),
          RecipeInstruction(stepNumber: 6, text: 'Garnish with feta and tzatziki sauce.'),
        ],
        tags: ['dinner', 'greek', 'healthy', 'bowls'],
        imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400',
        sourceUrl: 'https://www.alexandracooks.com/recipes/greek-chicken-bowls/',
        sourceName: 'Alexandra Cooks',
      ),
      Recipe(
        id: '11',
        title: 'Apple Cinnamon Pancakes',
        description: 'Fluffy pancakes studded with caramelized apples and warm cinnamon.',
        cookingTime: 20,
        prepTime: 15,
        servings: 4,
        difficulty: 'Easy',
        cuisine: 'American',
        ingredients: [
          RecipeIngredient(text: '2 cups all-purpose flour'),
          RecipeIngredient(text: '2 tablespoons sugar'),
          RecipeIngredient(text: '2 teaspoons baking powder'),
          RecipeIngredient(text: '1 teaspoon cinnamon'),
          RecipeIngredient(text: '1/2 teaspoon salt'),
          RecipeIngredient(text: '2 eggs'),
          RecipeIngredient(text: '1 3/4 cups milk'),
          RecipeIngredient(text: '1/4 cup melted butter'),
          RecipeIngredient(text: '2 apples, peeled and diced'),
          RecipeIngredient(text: 'Maple syrup for serving'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Mix dry ingredients in large bowl.'),
          RecipeInstruction(stepNumber: 2, text: 'Whisk together wet ingredients.'),
          RecipeInstruction(stepNumber: 3, text: 'Combine wet and dry ingredients until just mixed.'),
          RecipeInstruction(stepNumber: 4, text: 'Fold in diced apples.'),
          RecipeInstruction(stepNumber: 5, text: 'Cook pancakes on griddle until golden.'),
          RecipeInstruction(stepNumber: 6, text: 'Serve hot with maple syrup.'),
        ],
        tags: ['breakfast', 'pancakes', 'apples', 'cinnamon'],
        imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
        sourceUrl: 'https://www.allrecipes.com/recipe/21014/good-old-fashioned-pancakes/',
        sourceName: 'Allrecipes',
      ),
      Recipe(
        id: '12',
        title: 'Chocolate Lava Cake',
        description: 'Decadent individual chocolate cakes with molten centers.',
        cookingTime: 12,
        prepTime: 15,
        servings: 4,
        difficulty: 'Medium',
        cuisine: 'French',
        ingredients: [
          RecipeIngredient(text: '4 oz dark chocolate, chopped'),
          RecipeIngredient(text: '4 tablespoons butter'),
          RecipeIngredient(text: '2 large eggs'),
          RecipeIngredient(text: '2 tablespoons granulated sugar'),
          RecipeIngredient(text: '2 tablespoons all-purpose flour'),
          RecipeIngredient(text: '1/4 teaspoon salt'),
          RecipeIngredient(text: 'Butter and cocoa powder for ramekins'),
          RecipeIngredient(text: 'Vanilla ice cream for serving'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'Preheat oven to 425°F. Butter and dust ramekins.'),
          RecipeInstruction(stepNumber: 2, text: 'Melt chocolate and butter in double boiler.'),
          RecipeInstruction(stepNumber: 3, text: 'Whisk in eggs and sugar until thick.'),
          RecipeInstruction(stepNumber: 4, text: 'Fold in flour and salt.'),
          RecipeInstruction(stepNumber: 5, text: 'Divide batter among ramekins.'),
          RecipeInstruction(stepNumber: 6, text: 'Bake 10-12 minutes until edges are set.'),
          RecipeInstruction(stepNumber: 7, text: 'Invert onto plates and serve with ice cream.'),
        ],
        tags: ['dessert', 'chocolate', 'cake', 'individual'],
        imageUrl: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400',
        sourceUrl: 'https://www.foodnetwork.com/recipes/emeril-lagasse/chocolate-lava-cakes-recipe-1916183',
        sourceName: 'Food Network',
      ),
    ];
  } */

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
          'Authorization': 'Bearer ${user.idToken}',
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

  // Save new recipe
  Future<Recipe> saveRecipe(Recipe recipe) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final response = await http.post(
        Uri.parse('$apiUrl/v1/recipes'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
        },
        body: json.encode(recipe.toJson()),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        return Recipe.fromJson(json.decode(response.body));
      } else {
        throw Exception('Failed to save recipe: HTTP ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error while saving recipe: $e');
    }
  }

  // Update existing recipe
  Future<Recipe> updateRecipe(Recipe recipe) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final response = await http.put(
        Uri.parse('$apiUrl/v1/recipes/${recipe.id}'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
        },
        body: json.encode(recipe.toJson()),
      );

      if (response.statusCode == 200) {
        return Recipe.fromJson(json.decode(response.body));
      } else {
        throw Exception('Failed to update recipe: HTTP ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error while updating recipe: $e');
    }
  }

  // Search recipes
  Future<List<Recipe>> searchRecipes(String query) async {
    return await getRecipes(search: query);
  }

  // Get recipes by category
  Future<List<Recipe>> getRecipesByCategory(String category) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final uri = Uri.parse('$apiUrl/v1/recipes').replace(
        queryParameters: {'category': category}
      );
      
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
        },
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> recipesJson = data['recipes'] ?? [];
        return recipesJson.map((json) => Recipe.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load recipes by category: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Get favorite recipes
  Future<List<Recipe>> getFavoriteRecipes() async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final uri = Uri.parse('$apiUrl/v1/recipes').replace(
        queryParameters: {'favorites': 'true'}
      );
      
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
        },
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> recipesJson = data['recipes'] ?? [];
        return recipesJson.map((json) => Recipe.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load favorite recipes: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Bulk update recipes (for offline sync scenarios)
  Future<List<Recipe>> bulkUpdateRecipes(List<Recipe> recipes) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    try {
      final response = await http.patch(
        Uri.parse('$apiUrl/v1/recipes/bulk'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
        },
        body: json.encode({
          'recipes': recipes.map((r) => r.toJson()).toList(),
        }),
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> recipesJson = data['recipes'] ?? [];
        return recipesJson.map((json) => Recipe.fromJson(json)).toList();
      } else {
        throw Exception('Failed to bulk update recipes: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error during bulk update: $e');
    }
  }

  // Delete recipe
  Future<void> deleteRecipe(String id) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }
    
    // Connect to production API for deletion
    
    try {
      final response = await http.delete(
        Uri.parse('$apiUrl/v1/recipes/$id'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
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
