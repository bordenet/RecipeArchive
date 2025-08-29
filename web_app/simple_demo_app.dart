import 'package:flutter/material.dart';
import 'lib/services/recipe_service.dart';
import 'lib/services/auth_service.dart';
import 'lib/models/recipe.dart';

void main() {
  runApp(const SimpleRecipeApp());
}

class SimpleRecipeApp extends StatelessWidget {
  const SimpleRecipeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recipe Archive',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
        useMaterial3: true,
      ),
      home: const RecipeListScreen(),
    );
  }
}

class RecipeListScreen extends StatefulWidget {
  const RecipeListScreen({super.key});

  @override
  State<RecipeListScreen> createState() => _RecipeListScreenState();
}

class _RecipeListScreenState extends State<RecipeListScreen> {
  List<Recipe>? recipes;
  bool isLoading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _loadRecipes();
  }

  Future<void> _loadRecipes() async {
    try {
      setState(() {
        isLoading = true;
        error = null;
      });

      // Authenticate first
      final authService = AuthService();
      final success = await authService.authenticate('mattbordenet@hotmail.com', 'Recipe123');
      
      if (!success) {
        throw Exception('Authentication failed');
      }

      // Load recipes
      final recipeService = RecipeService(authService: authService);
      final loadedRecipes = await recipeService.getRecipes();

      setState(() {
        recipes = loadedRecipes;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        error = e.toString();
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recipe Archive'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: _buildBody(),
      floatingActionButton: FloatingActionButton(
        onPressed: _loadRecipes,
        child: const Icon(Icons.refresh),
      ),
    );
  }

  Widget _buildBody() {
    if (isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading recipes...'),
          ],
        ),
      );
    }

    if (error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Error: $error',
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadRecipes,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (recipes == null || recipes!.isEmpty) {
      return const Center(
        child: Text('No recipes found'),
      );
    }

    return ListView.builder(
      itemCount: recipes!.length,
      itemBuilder: (context, index) {
        final recipe = recipes![index];
        return Card(
          margin: const EdgeInsets.all(8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.primary,
              child: Text('${index + 1}'),
            ),
            title: Text(recipe.title),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Source: ${Uri.parse(recipe.sourceUrl).host}'),
                Text('Ingredients: ${recipe.ingredients.length} • Instructions: ${recipe.instructions.length}'),
                if (recipe.servings != null) Text('Servings: ${recipe.servings}'),
                if (recipe.prepTimeMinutes != null) Text('Time: ${recipe.prepTimeMinutes} min'),
              ],
            ),
            isThreeLine: true,
            onTap: () {
              _showRecipeDetails(recipe);
            },
          ),
        );
      },
    );
  }

  void _showRecipeDetails(Recipe recipe) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(recipe.title),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Source: ${recipe.sourceUrl}'),
              const SizedBox(height: 16),
              Text(
                'Ingredients (${recipe.ingredients.length}):',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              ...recipe.ingredients.map((ingredient) => 
                Padding(
                  padding: const EdgeInsets.only(left: 16, top: 4),
                  child: Text('• ${ingredient.text}'),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Instructions:',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              ...recipe.instructions.map((instruction) => 
                Padding(
                  padding: const EdgeInsets.only(left: 16, top: 8),
                  child: Text('${instruction.stepNumber}. ${instruction.text}'),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
