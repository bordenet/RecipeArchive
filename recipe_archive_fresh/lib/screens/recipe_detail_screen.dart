import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/recipe.dart';
import '../services/recipe_service.dart';
import '../utils/units_converter.dart';
import 'recipe_edit_screen.dart';

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
  late int currentServings;
  bool useMetricUnits = false;

  @override
  void initState() {
    super.initState();
    currentServings = widget.recipe.servings ?? 4;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // App Bar with Image
          SliverAppBar(
            expandedHeight: 300,
            pinned: true,
            backgroundColor: Colors.green,
            foregroundColor: Colors.white,
            actions: [
              IconButton(
                icon: const Icon(Icons.edit),
                onPressed: () => _navigateToEditScreen(context),
                tooltip: 'Edit Recipe',
                key: const Key('banner_edit_button'),
              ),
              IconButton(
                icon: const Icon(Icons.delete),
                onPressed: () => _showDeleteConfirmation(context),
                tooltip: 'Delete Recipe',
                key: const Key('banner_delete_button'),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                widget.recipe.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  shadows: [
                    Shadow(
                      offset: Offset(1, 1),
                      blurRadius: 2,
                      color: Colors.black54,
                    ),
                  ],
                ),
              ),
              background: widget.recipe.imageUrl != null
                  ? Stack(
                      children: [
                        Image.network(
                          widget.recipe.imageUrl!,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) {
                              return child;
                            }
                            return Center(
                              child: CircularProgressIndicator(
                                value: loadingProgress.expectedTotalBytes != null
                                    ? loadingProgress.cumulativeBytesLoaded / loadingProgress.expectedTotalBytes!
                                    : null,
                                color: Colors.white,
                              ),
                            );
                          },
                          errorBuilder: (context, error, stackTrace) {
                            // Detail image load error for ${widget.recipe.imageUrl}: $error
                            return Container(
                              color: Colors.grey[300],
                              child: const Icon(
                                Icons.restaurant_menu,
                                size: 64,
                                color: Colors.grey,
                              ),
                            );
                          },
                        ),
                        Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                Colors.black.withValues(alpha: 0.5),
                              ],
                            ),
                          ),
                        ),
                      ],
                    )
                  : Container(
                      color: Colors.grey[300],
                      child: const Icon(
                        Icons.restaurant_menu,
                        size: 64,
                        color: Colors.grey,
                      ),
                    ),
            ),
          ),
          
          // Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Recipe Meta Info
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      // Cooking Time
                      _buildInfoChip(
                        Icons.access_time,
                        widget.recipe.displayTime,
                      ),
                      
                      // Servings (clickable)
                      GestureDetector(
                        onTap: _showServingsDialog,
                        child: _buildInfoChip(
                          Icons.people,
                          '$currentServings servings',
                          color: Colors.green,
                        ),
                      ),
                      
                      // Units Toggle (clickable)
                      GestureDetector(
                        onTap: () {
                          setState(() {
                            useMetricUnits = !useMetricUnits;
                          });
                        },
                        child: _buildInfoChip(
                          useMetricUnits ? Icons.straighten : Icons.straighten,
                          useMetricUnits ? 'Metric' : 'Imperial',
                          color: Colors.blue,
                        ),
                      ),
                      
                      // Cuisine
                      if (widget.recipe.cuisine != null)
                        _buildInfoChip(
                          Icons.public,
                          widget.recipe.cuisine!,
                          color: Colors.green,
                        ),
                    ],
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Action Buttons
                  Row(
                    children: [
                      // Original Recipe Link
                      if (widget.recipe.sourceUrl != null)
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _launchUrl(widget.recipe.sourceUrl!),
                            icon: const Icon(Icons.launch),
                            label: Text('View Original at ${widget.recipe.sourceName ?? 'Source'}'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                        ),
                      
                      if (widget.recipe.sourceUrl != null) const SizedBox(width: 12),
                      
                      // Delete Button
                      ElevatedButton.icon(
                        onPressed: () => _showDeleteConfirmation(context),
                        icon: const Icon(Icons.delete),
                        label: const Text('Delete'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  
                  // Description
                  if (widget.recipe.description != null) ...[
                    Text(
                      'Description',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.recipe.description!,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    
                    // Original Recipe URL
                    if (widget.recipe.sourceUrl != null) ...[
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Icon(
                            Icons.link,
                            size: 16,
                            color: Colors.grey[600],
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Original Recipe: ',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[700],
                              fontSize: 14,
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => _launchUrl(widget.recipe.sourceUrl!),
                              child: Text(
                                widget.recipe.sourceUrl!,
                                style: TextStyle(
                                  color: Colors.blue[600],
                                  decoration: TextDecoration.underline,
                                  fontSize: 14,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    
                    const SizedBox(height: 24),
                  ],
                  
                  // Tags
                  if (widget.recipe.tags.isNotEmpty) ...[
                    Text(
                      'Tags',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: widget.recipe.tags.map((tag) => Chip(
                        label: Text('#$tag'),
                        backgroundColor: Colors.grey[200],
                        labelStyle: TextStyle(
                          color: Colors.grey[700],
                        ),
                      )).toList(),
                    ),
                    const SizedBox(height: 24),
                  ],
                  
                  // Ingredients
                  Text(
                    'Ingredients',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...widget.recipe.getScaledIngredients(currentServings).map((ingredient) {
                    final displayText = UnitsConverter.convertIngredient(ingredient.text, useMetricUnits);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(top: 8, right: 12),
                            decoration: const BoxDecoration(
                              color: Colors.green,
                              shape: BoxShape.circle,
                            ),
                          ),
                          Expanded(
                            child: Text(
                              displayText,
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                  
                  const SizedBox(height: 24),
                  
                  // Instructions
                  Text(
                    'Instructions',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...widget.recipe.instructions.map((instruction) {
                    final displayText = UnitsConverter.convertInstructions(instruction.text, useMetricUnits);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            margin: const EdgeInsets.only(right: 12),
                            decoration: BoxDecoration(
                              color: Colors.green,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Center(
                              child: Text(
                                instruction.stepNumber.toString(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              displayText,
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                  
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Launch URL in browser
  Future<void> _launchUrl(String url) async {
    try {
      final Uri uri = Uri.parse(url);
      // Attempting to launch URL: $url
      
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        // URL launched successfully
      } else {
        // Cannot launch URL: $url
        // Fallback: try with platform default mode
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      // Error launching URL: $e
    }
  }

  // Show delete confirmation dialog
  void _showDeleteConfirmation(BuildContext context) {
    showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Row(
            children: [
              Icon(Icons.warning, color: Colors.red[600]),
              const SizedBox(width: 8),
              const Text('Delete Recipe'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Are you sure you want to delete "${widget.recipe.title}"?',
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 8),
              const Text(
                'This action cannot be undone. The recipe and all associated data will be permanently removed from your account.',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop(true);
                _deleteRecipe(widget.recipe.id);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );
  }

  // Delete recipe with loading state
  Future<void> _deleteRecipe(String recipeId) async {
    try {
      // Show loading indicator
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: Card(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Colors.green),
                  SizedBox(height: 16),
                  Text('Deleting recipe...'),
                ],
              ),
            ),
          ),
        ),
      );

      // Call the delete API
      final recipeService = ref.read(recipeServiceProvider);
      await recipeService.deleteRecipe(recipeId);

      if (context.mounted) {
        // Close loading dialog
        Navigator.of(context).pop();
        
        // Close detail screen and return to home
        Navigator.of(context).pop();
        
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Recipe deleted successfully'),
            backgroundColor: Colors.green,
          ),
        );
        
        // Refresh the recipes list
        ref.invalidate(recipesProvider);
      }
    } catch (e) {
      if (context.mounted) {
        // Close loading dialog
        Navigator.of(context).pop();
        
        // Show error message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete recipe: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showServingsDialog() {
    showDialog<int>(
      context: context,
      builder: (BuildContext context) {
        int tempServings = currentServings;
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Adjust Servings'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('How many servings would you like?'),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      // Decrease button
                      IconButton(
                        onPressed: tempServings > 1 
                          ? () => setState(() => tempServings--)
                          : null,
                        icon: const Icon(Icons.remove_circle_outline),
                        iconSize: 32,
                        color: Colors.green,
                      ),
                      
                      // Current servings display
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(25),
                          border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          '$tempServings',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                      ),
                      
                      // Increase button
                      IconButton(
                        onPressed: tempServings < 100 
                          ? () => setState(() => tempServings++)
                          : null,
                        icon: const Icon(Icons.add_circle_outline),
                        iconSize: 32,
                        color: Colors.green,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'servings',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 16,
                    ),
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
                    Navigator.of(context).pop(tempServings);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Update'),
                ),
              ],
            );
          },
        );
      },
    ).then((newServings) {
      if (newServings != null && newServings != currentServings) {
        setState(() {
          currentServings = newServings;
        });
      }
    });
  }

  // Navigate to edit screen
  Future<void> _navigateToEditScreen(BuildContext context) async {
    final result = await Navigator.of(context).push<Recipe>(
      MaterialPageRoute(
        builder: (context) => RecipeEditScreen(recipe: widget.recipe),
      ),
    );

    if (result != null) {
      // Recipe was updated, refresh the UI
      setState(() {
        // The parent widget will be rebuilt with updated recipe data
      });
      
      // Refresh the recipes provider
      ref.invalidate(recipesProvider);
      
      // Show success message
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Recipe updated successfully!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  Widget _buildInfoChip(IconData icon, String text, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: (color ?? Colors.grey).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: (color ?? Colors.grey).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: color ?? Colors.grey[600],
          ),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              color: color ?? Colors.grey[700],
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
