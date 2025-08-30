import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/recipe.dart';
import '../services/recipe_service.dart';
import '../widgets/recipe_card.dart';
import '../widgets/search_bar.dart';
import '../widgets/filter_chips.dart';
import 'recipe_detail_screen.dart';

// Provider for recipe service
final recipeServiceProvider = Provider<RecipeService>((ref) => RecipeService());

// Provider for recipes list
final recipesProvider = FutureProvider<List<Recipe>>((ref) async {
  final recipeService = ref.read(recipeServiceProvider);
  return await recipeService.getRecipes();
});

// Provider for search query
final searchQueryProvider = StateProvider<String>((ref) => '');

// Provider for selected filters
final selectedFiltersProvider = StateProvider<Map<String, dynamic>>((ref) => {});

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final ScrollController _scrollController = ScrollController();
  
  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final recipesAsync = ref.watch(recipesProvider);
    final searchQuery = ref.watch(searchQueryProvider);
    final selectedFilters = ref.watch(selectedFiltersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Recipe Archive'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              // TODO: Navigate to add recipe screen
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Add recipe feature coming soon!')),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.favorite),
            onPressed: () {
              // TODO: Navigate to favorites screen
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Favorites feature coming soon!')),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Search and filters section
          Container(
            padding: const EdgeInsets.all(16),
            color: Theme.of(context).colorScheme.surface,
            child: Column(
              children: [
                // Search bar
                RecipeSearchBar(
                  onSearchChanged: (query) {
                    ref.read(searchQueryProvider.notifier).state = query;
                  },
                ),
                const SizedBox(height: 12),
                
                // Filter chips
                RecipeFilterChips(
                  selectedFilters: selectedFilters,
                  onFiltersChanged: (filters) {
                    ref.read(selectedFiltersProvider.notifier).state = filters;
                  },
                ),
              ],
            ),
          ),
          
          // Recipes list
          Expanded(
            child: recipesAsync.when(
              data: (recipes) {
                // Apply search and filters
                final filteredRecipes = _filterRecipes(recipes, searchQuery, selectedFilters);
                
                if (filteredRecipes.isEmpty) {
                  return _buildEmptyState();
                }
                
                return _buildRecipesList(filteredRecipes);
              },
              loading: () => const Center(
                child: CircularProgressIndicator(),
              ),
              error: (error, stackTrace) => _buildErrorState(error),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Quick add recipe via URL
          _showAddRecipeDialog();
        },
        child: const Icon(Icons.link),
      ),
    );
  }

  Widget _buildRecipesList(List<Recipe> recipes) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(recipesProvider);
      },
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: recipes.length,
        itemBuilder: (context, index) {
          final recipe = recipes[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: RecipeCard(
              recipe: recipe,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => RecipeDetailScreen(recipe: recipe),
                  ),
                );
              },
              onFavorite: () async {
                try {
                  final recipeService = ref.read(recipeServiceProvider);
                  await recipeService.toggleFavorite(recipe);
                  ref.invalidate(recipesProvider);
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error updating favorite: $e')),
                  );
                }
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.restaurant_menu,
            size: 64,
            color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'No recipes found',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            'Try adjusting your search or filters',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () {
              ref.read(searchQueryProvider.notifier).state = '';
              ref.read(selectedFiltersProvider.notifier).state = {};
            },
            icon: const Icon(Icons.clear),
            label: const Text('Clear Filters'),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(Object error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline,
            size: 64,
            color: Theme.of(context).colorScheme.error,
          ),
          const SizedBox(height: 16),
          Text(
            'Error loading recipes',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            error.toString(),
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () {
              ref.invalidate(recipesProvider);
            },
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  void _showAddRecipeDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Recipe'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              decoration: InputDecoration(
                labelText: 'Recipe URL',
                hintText: 'Paste a URL from a recipe website',
              ),
            ),
            SizedBox(height: 16),
            Text(
              'Or use the browser extension to save recipes while browsing!',
              style: TextStyle(fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('URL parsing feature coming soon!')),
              );
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  List<Recipe> _filterRecipes(
    List<Recipe> recipes, 
    String searchQuery, 
    Map<String, dynamic> filters,
  ) {
    var filtered = recipes;

    // Apply search query
    if (searchQuery.isNotEmpty) {
      final query = searchQuery.toLowerCase();
      filtered = filtered.where((recipe) {
        return recipe.title.toLowerCase().contains(query) ||
               recipe.description?.toLowerCase().contains(query) == true ||
               recipe.ingredients.any((ingredient) => 
                 ingredient.toLowerCase().contains(query)) ||
               recipe.tagsOrEmpty.any((tag) => 
                 tag.toLowerCase().contains(query)) ||
               recipe.cuisine?.toLowerCase().contains(query) == true;
      }).toList();
    }

    // Apply cuisine filter
    final selectedCuisine = filters['cuisine'] as String?;
    if (selectedCuisine != null && selectedCuisine.isNotEmpty) {
      filtered = filtered.where((recipe) => 
        recipe.cuisine?.toLowerCase() == selectedCuisine.toLowerCase()).toList();
    }

    // Apply tag filters
    final selectedTags = filters['tags'] as List<String>?;
    if (selectedTags != null && selectedTags.isNotEmpty) {
      filtered = filtered.where((recipe) {
        return selectedTags.every((tag) =>
          recipe.tagsOrEmpty.any((recipeTag) => 
            recipeTag.toLowerCase() == tag.toLowerCase()));
      }).toList();
    }

    // Apply favorites filter
    final showFavoritesOnly = filters['favoritesOnly'] as bool?;
    if (showFavoritesOnly == true) {
      filtered = filtered.where((recipe) => recipe.isFavoriteOrFalse).toList();
    }

    // Apply time filter
    final maxTime = filters['maxTime'] as int?;
    if (maxTime != null) {
      filtered = filtered.where((recipe) => 
        recipe.totalTimeMinutes <= maxTime).toList();
    }

    return filtered;
  }
}
