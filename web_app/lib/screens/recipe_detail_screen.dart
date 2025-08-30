import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/recipe.dart';
import '../services/recipe_service.dart';

class RecipeDetailScreen extends ConsumerStatefulWidget {
  final Recipe recipe;

  const RecipeDetailScreen({
    super.key,
    required this.recipe,
  });

  @override
  ConsumerState<RecipeDetailScreen> createState() => _RecipeDetailScreenState();
}

class _RecipeDetailScreenState extends ConsumerState<RecipeDetailScreen> {
  late Recipe _recipe;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _recipe = widget.recipe;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildAppBar(),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildRecipeHeader(),
                  const SizedBox(height: 24),
                  _buildRecipeStats(),
                  const SizedBox(height: 24),
                  _buildIngredients(),
                  const SizedBox(height: 24),
                  _buildInstructions(),
                  const SizedBox(height: 24),
                  _buildNutritionInfo(),
                  const SizedBox(height: 24),
                  _buildTags(),
                  const SizedBox(height: 24),
                  _buildUserNotes(),
                  const SizedBox(height: 24),
                  _buildSourceLink(),
                  const SizedBox(height: 100), // Space for FAB
                ],
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          FloatingActionButton(
            heroTag: 'favorite',
            onPressed: _toggleFavorite,
            backgroundColor: _recipe.isFavoriteOrFalse 
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.surface,
            child: Icon(
              _recipe.isFavoriteOrFalse ? Icons.favorite : Icons.favorite_border,
              color: _recipe.isFavoriteOrFalse 
                ? Colors.white 
                : Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(height: 16),
          FloatingActionButton(
            heroTag: 'share',
            onPressed: _shareRecipe,
            child: const Icon(Icons.share),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      expandedHeight: 300,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          _recipe.title,
          style: const TextStyle(
            color: Colors.white,
            shadows: [
              Shadow(
                offset: Offset(0, 1),
                blurRadius: 3,
                color: Colors.black54,
              ),
            ],
          ),
        ),
        background: _recipe.imageUrl != null
          ? Stack(
              fit: StackFit.expand,
              children: [
                Image.network(
                  _recipe.imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return _buildDefaultImage();
                  },
                ),
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.black.withOpacity(0.7),
                      ],
                    ),
                  ),
                ),
              ],
            )
          : _buildDefaultImage(),
      ),
      actions: [
        PopupMenuButton<String>(
          onSelected: _handleMenuAction,
          itemBuilder: (context) => [
            const PopupMenuItem(
              value: 'edit',
              child: Row(
                children: [
                  Icon(Icons.edit),
                  SizedBox(width: 8),
                  Text('Edit Recipe'),
                ],
              ),
            ),
            const PopupMenuItem(
              value: 'delete',
              child: Row(
                children: [
                  Icon(Icons.delete, color: Colors.red),
                  SizedBox(width: 8),
                  Text('Delete Recipe', style: TextStyle(color: Colors.red)),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDefaultImage() {
    return Container(
      color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
      child: Icon(
        Icons.restaurant_menu,
        size: 80,
        color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
      ),
    );
  }

  Widget _buildRecipeHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_recipe.description != null) ...[
          Text(
            _recipe.description!,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
        ],
        
        // Rating
        Row(
          children: [
            ...List.generate(5, (index) {
              return GestureDetector(
                onTap: () => _rateRecipe(index + 1),
                child: Icon(
                  index < (_recipe.userRating ?? 0)
                    ? Icons.star
                    : Icons.star_border,
                  color: Colors.amber,
                  size: 28,
                ),
              );
            }),
            if (_recipe.userRating != null) ...[
              const SizedBox(width: 8),
              Text(
                '${_recipe.userRating}/5',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ],
        ),
      ],
    );
  }

  Widget _buildRecipeStats() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildStatItem(
              icon: Icons.schedule,
              label: 'Time',
              value: _recipe.formattedTime,
            ),
            _buildStatItem(
              icon: Icons.people,
              label: 'Servings',
              value: _recipe.formattedServings,
            ),
            if (_recipe.cuisine != null)
              _buildStatItem(
                icon: Icons.public,
                label: 'Cuisine',
                value: _recipe.cuisine!,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Column(
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 4),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildIngredients() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Ingredients',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: _recipe.ingredients.map((ingredient) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        margin: const EdgeInsets.only(top: 8, right: 12),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                      Expanded(
                        child: Text(
                          ingredient.text,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInstructions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Instructions',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: _recipe.instructions.asMap().entries.map((entry) {
                final index = entry.key;
                final instruction = entry.value;
                
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        margin: const EdgeInsets.only(right: 12),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            '${index + 1}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          instruction.text,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNutritionInfo() {
    if (_recipe.calories == null && 
        _recipe.protein == null && 
        _recipe.carbs == null && 
        _recipe.fat == null) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Nutrition Information',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                if (_recipe.calories != null)
                  _buildNutritionItem('Calories', '${_recipe.calories}'),
                if (_recipe.protein != null)
                  _buildNutritionItem('Protein', '${_recipe.protein}g'),
                if (_recipe.carbs != null)
                  _buildNutritionItem('Carbs', '${_recipe.carbs}g'),
                if (_recipe.fat != null)
                  _buildNutritionItem('Fat', '${_recipe.fat}g'),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNutritionItem(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _buildTags() {
    if (_recipe.tagsOrEmpty.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tags',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _recipe.tagsOrEmpty.map((tag) {
            return Chip(
              label: Text(tag),
              backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
              labelStyle: TextStyle(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.w500,
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildUserNotes() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'My Notes',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            IconButton(
              onPressed: _editNotes,
              icon: const Icon(Icons.edit),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: _recipe.userNotes?.isNotEmpty == true
              ? Text(
                  _recipe.userNotes!,
                  style: Theme.of(context).textTheme.bodyLarge,
                )
              : Text(
                  'Tap the edit button to add your notes...',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontStyle: FontStyle.italic,
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                  ),
                ),
          ),
        ),
      ],
    );
  }

  Widget _buildSourceLink() {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.link),
        title: const Text('View Original Recipe'),
        subtitle: Text(_recipe.sourceUrl),
        trailing: const Icon(Icons.open_in_new),
        onTap: _openSourceUrl,
      ),
    );
  }

  Future<void> _toggleFavorite() async {
    if (_isLoading) return;

    setState(() => _isLoading = true);

    try {
      final recipeService = ref.read(recipeServiceProvider);
      final updatedRecipe = await recipeService.toggleFavorite(_recipe);
      setState(() => _recipe = updatedRecipe);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error updating favorite: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _rateRecipe(int rating) async {
    if (_isLoading) return;

    setState(() => _isLoading = true);

    try {
      final recipeService = ref.read(recipeServiceProvider);
      final updatedRecipe = await recipeService.rateRecipe(_recipe, rating);
      setState(() => _recipe = updatedRecipe);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error rating recipe: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _editNotes() {
    showDialog(
      context: context,
      builder: (context) {
        final controller = TextEditingController(text: _recipe.userNotes ?? '');
        
        return AlertDialog(
          title: const Text('Edit Notes'),
          content: TextField(
            controller: controller,
            maxLines: 5,
            decoration: const InputDecoration(
              hintText: 'Add your notes about this recipe...',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.of(context).pop();
                await _saveNotes(controller.text);
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _saveNotes(String notes) async {
    if (_isLoading) return;

    setState(() => _isLoading = true);

    try {
      final recipeService = ref.read(recipeServiceProvider);
      final updatedRecipe = await recipeService.addNotes(_recipe, notes);
      setState(() => _recipe = updatedRecipe);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving notes: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _shareRecipe() {
    // TODO: Implement sharing functionality
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sharing feature coming soon!')),
    );
  }

  Future<void> _openSourceUrl() async {
    final uri = Uri.parse(_recipe.sourceUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open URL')),
      );
    }
  }

  void _handleMenuAction(String action) {
    switch (action) {
      case 'edit':
        // TODO: Navigate to edit screen
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Edit feature coming soon!')),
        );
        break;
      case 'delete':
        _confirmDelete();
        break;
    }
  }

  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Recipe'),
        content: Text('Are you sure you want to delete "${_recipe.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              _deleteRecipe();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteRecipe() async {
    if (_isLoading) return;

    setState(() => _isLoading = true);

    try {
      final recipeService = ref.read(recipeServiceProvider);
      await recipeService.deleteRecipe(_recipe.id);
      
      Navigator.of(context).pop(); // Go back to previous screen
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Recipe deleted successfully')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error deleting recipe: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }
}
