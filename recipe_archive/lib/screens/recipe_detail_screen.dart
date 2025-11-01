import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../models/recipe.dart';
import '../services/recipe_service.dart' as service;
import '../utils/units_converter.dart';
import '../widgets/star_rating.dart';
import '../providers/recipe_provider.dart';
import '../services/recipe_sharing_service.dart';
import '../controllers/recipe_operations.dart';
import '../widgets/recipe_detail/recipe_header.dart';
import '../widgets/recipe_detail/recipe_info_chips.dart';
import '../widgets/recipe_detail/recipe_instructions.dart';
import '../widgets/recipe_detail/recipe_tags_section.dart';
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

class _RecipeDetailScreenState extends ConsumerState<RecipeDetailScreen>
    with WidgetsBindingObserver {
  late int currentServings;
  bool useMetricUnits = false;
  int selectedCookingMethodIndex = 0;

  // Services
  late final RecipeSharingService _sharingService;
  late final RecipeOperations _operations;

  @override
  void initState() {
    super.initState();
    currentServings = widget.recipe.servings ?? 4;

    // Initialize services
    final recipeService = ref.read(service.recipeServiceProvider);
    _sharingService = RecipeSharingService(recipeService);
    _operations = RecipeOperations(recipeService);

    // If recipe has cooking methods, default to first method, not general instructions
    if (widget.recipe.cookingMethodOptions.isNotEmpty) {
      selectedCookingMethodIndex = 0;
    } else {
      selectedCookingMethodIndex = -1;
    }

    // Enable wakelock to prevent screen from sleeping during cooking
    WakelockPlus.enable();

    // Register lifecycle observer to detect app resume
    WidgetsBinding.instance.addObserver(this);

    // Check for shared URLs from iOS Share Extension
    _checkForSharedUrl();

    // Set up handler for when app is already running
    _sharingService.setSharedUrlHandler((sharedData) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(sharedData.processingMessage),
            duration: const Duration(seconds: 2),
          ),
        );
        _processSharedRecipe(sharedData);
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    // Disable wakelock when leaving recipe screen
    WakelockPlus.disable();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    if (state == AppLifecycleState.resumed) {
      debugPrint('DEBUG: App resumed on recipe detail page, checking for shared recipes');
      _checkForSharedUrl();
    }
  }

  /// Check for shared URLs from iOS Share Extension
  Future<void> _checkForSharedUrl() async {
    final sharedData = await _sharingService.checkForSharedUrl();
    if (sharedData != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(sharedData.processingMessage),
          duration: const Duration(seconds: 2),
        ),
      );
      await _processSharedRecipe(sharedData);
    }
  }

  /// Process shared recipe data
  Future<void> _processSharedRecipe(SharedRecipeData data) async {
    try {
      final recipe = await _sharingService.processSharedRecipe(
        data.url,
        html: data.html,
        images: data.images,
      );

      if (mounted) {
        ref.invalidate(recipeProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Recipe saved! Processing...'),
            action: SnackBarAction(
              label: 'View',
              onPressed: () {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(
                    builder: (context) => RecipeDetailScreen(recipe: recipe),
                  ),
                );
              },
            ),
          ),
        );

        // Check for more queued recipes after a brief delay
        Future.delayed(const Duration(milliseconds: 500), _checkForSharedUrl);
      }
    } catch (e, stackTrace) {
      debugPrint('ERROR: Failed to save shared recipe: $e');
      debugPrint('ERROR: Stack trace: $stackTrace');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save recipe: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // App Bar with Image
          RecipeHeader(
            recipe: widget.recipe,
            onEdit: () => _navigateToEditScreen(context),
            onDelete: () => _showDeleteConfirmation(context),
            onViewSource: widget.recipe.sourceUrl != null ? () => _launchUrl(widget.recipe.sourceUrl!) : null,
          ),

          // Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Recipe Meta Info
                  RecipeInfoChips(
                    recipe: widget.recipe,
                    currentServings: currentServings,
                    onServingsTap: _showServingsDialog,
                  ),
                  
                  const SizedBox(height: 16),
                  
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
                      widget.recipe.cleanDescription,
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
                  
                  
                  // Rating Section
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your Rating',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Consumer(
                        builder: (context, ref, child) {
                          // Get the current recipe from the provider
                          final recipesAsyncValue = ref.watch(recipeProvider);
                          final currentRecipe = recipesAsyncValue.when(
                            data: (recipes) => recipes.firstWhere(
                              (r) => r.id == widget.recipe.id,
                              orElse: () => widget.recipe,
                            ),
                            loading: () => widget.recipe,
                            error: (_, __) => widget.recipe,
                          );
                          
                          return InteractiveStarRating(
                            initialRating: currentRecipe.personalRating ?? 0,
                            size: 32,
                            onRatingChanged: (rating) async {
                          // Update the recipe with new rating
                              final updatedRecipe = currentRecipe.copyWith(
                                personalRating: rating,
                              );
                              try {
                                await ref.read(recipeProvider.notifier).updateRecipe(updatedRecipe);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Rating saved: ${rating.toInt()} stars'),
                                      duration: const Duration(seconds: 2),
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Failed to save rating: $e')),
                                  );
                                }
                              }
                            },
                          );
                        },
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                  
                  // Ingredients
                  Text(
                    'Ingredients',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...widget.recipe.getScaledIngredients(currentServings).asMap().entries.map((entry) {
                    final index = entry.key;
                    final ingredient = entry.value;
                    final originalIngredient = widget.recipe.ingredients[index];
                    final displayText = UnitsConverter.convertIngredient(ingredient.text, useMetricUnits);
                    final originalServings = widget.recipe.servings ?? 4;
                    final servingSizeAltered = currentServings != originalServings;

                    // Check if ingredient is scalable (contains numbers), not if it was scaled in this instance
                    final isScalable = _isIngredientScalable(originalIngredient.text);
                    
                    // Check if this is a section header (starts with ##)
                    if (ingredient.text.startsWith('## ')) {
                      final headerText = ingredient.text.substring(3); // Remove "## " prefix
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12, top: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              headerText.toUpperCase(),
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: Colors.grey[700],
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              height: 1,
                              width: double.infinity,
                              color: Colors.grey[300],
                            ),
                          ],
                        ),
                      );
                    }
                    
                    // Regular ingredient with bullet point
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(top: 8, right: 12),
                            decoration: BoxDecoration(
                              color: isScalable ? Colors.green : Colors.grey[400],
                              shape: BoxShape.circle,
                            ),
                          ),
                          Expanded(
                            child: Text(
                              displayText,
                              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                fontStyle: (!isScalable && servingSizeAltered) ? FontStyle.italic : FontStyle.normal,
                                color: isScalable ? null : Colors.grey[600],
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),

                  const SizedBox(height: 24),

                  // Instructions
                  RecipeInstructions(
                    recipe: widget.recipe,
                    useMetricUnits: useMetricUnits,
                    initialMethodIndex: selectedCookingMethodIndex,
                  ),

                  const SizedBox(height: 24),

                  // Tags Section
                  RecipeTagsSection(
                    recipe: widget.recipe,
                    onAddTag: _handleAddTag,
                    onRemoveTag: _handleRemoveTag,
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Handle adding a tag
  Future<void> _handleAddTag(Recipe recipe, String tag) async {
    try {
      await _operations.addTag(recipe, tag);
      ref.invalidate(recipeProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Added tag "#$tag"'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add tag: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Handle removing a tag
  Future<void> _handleRemoveTag(Recipe recipe, String tag) async {
    try {
      await _operations.removeTag(recipe, tag);
      ref.invalidate(recipeProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Removed tag "#$tag"'),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove tag: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
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
      final recipeService = ref.read(service.recipeServiceProvider);
      await recipeService.deleteRecipe(recipeId);

      if (context.mounted) {
        // Close loading dialog
        // ignore: use_build_context_synchronously
        Navigator.of(context).pop();
        
        // Close detail screen and return to home
        // ignore: use_build_context_synchronously
        Navigator.of(context).pop();
        
        // Show success message
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Recipe deleted successfully'),
            backgroundColor: Colors.green,
          ),
        );
        
        // Refresh the recipes list
        ref.invalidate(recipeProvider);
      }
    } catch (e) {
      if (context.mounted) {
        // Close loading dialog
        // ignore: use_build_context_synchronously
        Navigator.of(context).pop();
        
        // Show error message
        // ignore: use_build_context_synchronously
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
    // Define serving multipliers based on original recipe servings
    final originalServings = widget.recipe.servings ?? 4;
    final multipliers = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 6, 8];
    
    // Calculate serving options with reasonable limits (1-24 servings)
    final servingOptions = multipliers
        .map((mult) => (originalServings * mult).round())
        .where((servings) => servings >= 1 && servings <= 24)
        .toSet() // Remove duplicates
        .toList()
        ..sort(); // Sort in ascending order
    
    showDialog<int>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Adjust Servings'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Choose serving size (original: $originalServings servings):'),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: servingOptions.map((servings) {
                  final multiplier = servings / originalServings;
                  final isSelected = servings == currentServings;
                  
                  return GestureDetector(
                    onTap: () => Navigator.of(context).pop(servings),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: isSelected ? Colors.green : Colors.grey[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? Colors.green : Colors.grey[300]!,
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$servings',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? Colors.white : Colors.green,
                            ),
                          ),
                          Text(
                            'servings',
                            style: TextStyle(
                              fontSize: 12,
                              color: isSelected ? Colors.white.withValues(alpha: 0.9) : Colors.grey[600],
                            ),
                          ),
                          if (multiplier != 1)
                            Text(
                              '${_formatMultiplier(multiplier)}x',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                                color: isSelected ? Colors.white.withValues(alpha: 0.8) : Colors.green,
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
          ],
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

  // Format multiplier display with vulgar fractions
  String _formatMultiplier(double multiplier) {
    if (multiplier == 0.125) return '⅛';
    if (multiplier == 0.25) return '¼';
    if (multiplier == 0.375) return '⅜';
    if (multiplier == 0.5) return '½';
    if (multiplier == 0.625) return '⅝';
    if (multiplier == 0.75) return '¾';
    if (multiplier == 0.875) return '⅞';
    if (multiplier == 1.25) return '1¼';
    if (multiplier == 1.5) return '1½';
    if (multiplier == 1.75) return '1¾';
    if (multiplier == 2.5) return '2½';
    if (multiplier == multiplier.toInt()) return multiplier.toInt().toString();
    return multiplier.toString();
  }

  // Navigate to edit screen
  Future<void> _navigateToEditScreen(BuildContext context) async {
    final result = await Navigator.of(context).push<Recipe>(
      MaterialPageRoute(
        builder: (context) => RecipeEditScreen(recipe: widget.recipe),
      ),
    );

    if (result != null) {
      // Recipe was updated, refresh the UI and update serving size
      setState(() {
        currentServings = result.servings ?? currentServings;
      });
      
      // Refresh the recipes provider
      ref.invalidate(recipeProvider);
      
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

  // Helper methods

  /// Helper method to check if an ingredient can be scaled (contains numbers)
  bool _isIngredientScalable(String ingredientText) {
    // Skip section headers
    if (ingredientText.startsWith('## ')) {
      return false;
    }

    // Use the same regex pattern as UnitsConverter to detect ingredients with measurable quantities
    // This ensures consistency between scaling and display logic
    final regex = RegExp(r'((?:\d+\s+)?[\d½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+(?:\.\d+)?(?:/\d+)?)\s*(?:\([^)]+\))?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)(?=\s|$|,|\()', unicode: true);
    return regex.hasMatch(ingredientText);
  }
}
