import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../models/recipe.dart';
import '../services/recipe_service.dart' as service;
import '../utils/units_converter.dart';
import '../widgets/star_rating.dart';
import '../providers/recipe_provider.dart';
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
  int selectedCookingMethodIndex = 0;

  @override
  void initState() {
    super.initState();
    currentServings = widget.recipe.servings ?? 4;

    // If recipe has cooking methods, default to first method, not general instructions
    if (widget.recipe.cookingMethodOptions.isNotEmpty) {
      selectedCookingMethodIndex = 0; // Start with first cooking method
    } else {
      selectedCookingMethodIndex = -1; // Use general instructions for single-method recipes
    }

    // Enable wakelock to prevent screen from sleeping during cooking
    WakelockPlus.enable();
  }

  @override
  void dispose() {
    // Disable wakelock when leaving recipe screen
    WakelockPlus.disable();
    super.dispose();
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
              // Screen awake indicator
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 4),
                child: IconButton(
                  icon: const Icon(Icons.screen_lock_portrait_outlined),
                  onPressed: null, // Non-interactive indicator
                  tooltip: 'Screen stays awake while cooking',
                  iconSize: 20,
                ),
              ),
              if (widget.recipe.sourceUrl != null)
                IconButton(
                  icon: const Icon(Icons.open_in_new),
                  onPressed: () => _launchUrl(widget.recipe.sourceUrl!),
                  tooltip: 'View Original at Source',
                  key: const Key('banner_source_button'),
                ),
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
                widget.recipe.cleanTitle,
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
                            // Detail image load error for recipe "${widget.recipe.title}": ${widget.recipe.imageUrl}
                            // Error details: $error

                            return Container(
                              color: Colors.grey[300],
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(
                                    Icons.broken_image,
                                    size: 48,
                                    color: Colors.grey,
                                  ),
                                  SizedBox(height: 8),
                                  Text(
                                    'Image unavailable',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                ],
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
                      
                      // Source URL (clickable)
                      if (widget.recipe.sourceUrl != null)
                        GestureDetector(
                          onTap: () => _launchUrl(widget.recipe.sourceUrl!),
                          child: _buildInfoChip(
                            Icons.link,
                            widget.recipe.displaySourceName,
                            color: Colors.orange,
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
                  
                  // Instructions - Multiple Cooking Methods Support
                  _buildInstructionsSection(context),
                  
                  const SizedBox(height: 24),
                  
                  // Enhanced Tags Section (moved from earlier position)
                  _buildTagsSection(context),
                  
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

  Widget _buildInstructionsSection(BuildContext context) {
    final hasCookingMethods = widget.recipe.cookingMethodOptions.isNotEmpty;
    final hasMultipleCookingMethods = widget.recipe.cookingMethodOptions.length > 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with method selection
        Row(
          children: [
            Text(
              'Instructions',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            if (hasMultipleCookingMethods) ...[
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: DropdownButton<int>(
                  value: selectedCookingMethodIndex,
                  underline: const SizedBox(),
                  isDense: true,
                  items: [
                    ...widget.recipe.cookingMethodOptions.asMap().entries.map((entry) {
                      final index = entry.key;
                      final method = entry.value;
                      return DropdownMenuItem(
                        value: index,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _getCookingMethodIcon(method.name),
                              size: 16,
                              color: Colors.grey[600],
                            ),
                            const SizedBox(width: 8),
                            Text(method.name),
                          ],
                        ),
                      );
                    }),
                  ],
                  onChanged: (value) {
                    setState(() {
                      selectedCookingMethodIndex = value ?? 0;
                    });
                  },
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),

        // Method-specific info
        if (hasCookingMethods) ...[
          _buildCookingMethodInfo(widget.recipe.cookingMethodOptions[selectedCookingMethodIndex]),
          const SizedBox(height: 16),
        ],

        // Instructions list
        ..._getDisplayInstructions().map((instruction) {
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
                        fontSize: 14,
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
      ],
    );
  }

  Widget _buildCookingMethodInfo(CookingMethod method) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_getCookingMethodIcon(method.name), color: Colors.blue[700]),
              const SizedBox(width: 8),
              Text(
                method.name,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: Colors.blue[700],
                ),
              ),
              if (method.timeEstimate != null) ...[
                const Spacer(),
                Icon(Icons.schedule, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  method.timeEstimate!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ],
          ),
          if (method.equipment.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.build, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Equipment needed: ${method.equipment.join(', ')}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey[700],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  List<RecipeInstruction> _getDisplayInstructions() {
    final hasCookingMethods = widget.recipe.cookingMethodOptions.isNotEmpty;

    if (!hasCookingMethods) {
      // Standard recipe - show all instructions
      return widget.recipe.instructions;
    }

    // Multi-method recipe - show the selected cooking method's instructions
    if (selectedCookingMethodIndex >= 0 && selectedCookingMethodIndex < widget.recipe.cookingMethodOptions.length) {
      final methodInstructions = widget.recipe.cookingMethodOptions[selectedCookingMethodIndex].instructions;

      // Combine prep instructions (if any) with method-specific instructions
      final allInstructions = <RecipeInstruction>[];

      // Add prep instructions first (renumber them)
      for (int i = 0; i < widget.recipe.instructions.length; i++) {
        allInstructions.add(RecipeInstruction(
          stepNumber: i + 1,
          text: widget.recipe.instructions[i].text,
        ));
      }

      // Add method-specific instructions (continue numbering)
      final prepStepsCount = widget.recipe.instructions.length;
      for (int i = 0; i < methodInstructions.length; i++) {
        allInstructions.add(RecipeInstruction(
          stepNumber: prepStepsCount + i + 1,
          text: methodInstructions[i].text,
        ));
      }

      return allInstructions;
    }

    // Fallback
    return widget.recipe.instructions;
  }

  IconData _getCookingMethodIcon(String methodName) {
    switch (methodName.toLowerCase()) {
      case 'stovetop':
      case 'stove':
        return Icons.local_fire_department;
      case 'slow cooker':
      case 'crockpot':
        return Icons.soup_kitchen;
      case 'oven':
      case 'bake':
      case 'baked':
        return Icons.local_pizza;
      case 'grill':
      case 'grilled':
      case 'grilling':
        return Icons.outdoor_grill;
      case 'microwave':
        return Icons.microwave;
      case 'instant pot':
      case 'pressure cooker':
        return Icons.coffee_maker;
      case 'air fryer':
        return Icons.air;
      default:
        return Icons.restaurant;
    }
  }

  Widget _buildTagsSection(BuildContext context) {
    return Consumer(
      builder: (context, ref, child) {
        // Get the current recipe from the provider to get latest tags
        final recipesAsyncValue = ref.watch(recipeProvider);
        final currentRecipe = recipesAsyncValue.when(
          data: (recipes) => recipes.firstWhere(
            (r) => r.id == widget.recipe.id,
            orElse: () => widget.recipe,
          ),
          loading: () => widget.recipe,
          error: (_, __) => widget.recipe,
        );

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Tags',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                // Add Tag Button
                IconButton(
                  onPressed: () => _showAddTagDialog(context, currentRecipe),
                  icon: const Icon(Icons.add_circle_outline),
                  tooltip: 'Add Tag',
                  color: Colors.green,
                  key: const Key('add_tag_button'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (currentRecipe.tags.isEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.local_offer_outlined,
                      size: 32,
                      color: Colors.grey[400],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'No tags yet',
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Add tags to improve recipe discovery',
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: currentRecipe.tags.map((tag) => _buildEditableTag(
                  context,
                  tag,
                  currentRecipe,
                )).toList(),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _buildEditableTag(BuildContext context, String tag, Recipe recipe) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.green[50],
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.green[200]!),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 12, top: 8, bottom: 8),
            child: Text(
              '#$tag',
              style: TextStyle(
                color: Colors.green[700],
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          IconButton(
            onPressed: () => _showRemoveTagDialog(context, tag, recipe),
            icon: const Icon(Icons.close),
            iconSize: 18,
            color: Colors.green[600],
            padding: const EdgeInsets.only(left: 4, right: 8),
            constraints: const BoxConstraints(
              minWidth: 24,
              minHeight: 24,
            ),
            tooltip: 'Remove tag',
          ),
        ],
      ),
    );
  }

  void _showAddTagDialog(BuildContext context, Recipe recipe) {
    final TextEditingController controller = TextEditingController();
    
    showDialog<String>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Add New Tag'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: controller,
                decoration: const InputDecoration(
                  labelText: 'Tag name',
                  hintText: 'e.g., breakfast, quick, vegetarian',
                  border: OutlineInputBorder(),
                  prefixText: '#',
                ),
                textCapitalization: TextCapitalization.words,
                autofocus: true,
                onSubmitted: (value) {
                  if (value.trim().isNotEmpty) {
                    Navigator.of(context).pop(value.trim().toLowerCase());
                  }
                },
              ),
              const SizedBox(height: 8),
              Text(
                'Tags help you find recipes faster using search',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 12,
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
                final tag = controller.text.trim().toLowerCase();
                if (tag.isNotEmpty) {
                  Navigator.of(context).pop(tag);
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
              ),
              child: const Text('Add Tag'),
            ),
          ],
        );
      },
    ).then((newTag) {
      if (newTag != null && !recipe.tags.contains(newTag)) {
        _addTag(recipe, newTag);
      }
    });
  }

  void _showRemoveTagDialog(BuildContext context, String tag, Recipe recipe) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Remove Tag'),
          content: Text('Remove "#$tag" from this recipe?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                _removeTag(recipe, tag);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
              child: const Text('Remove'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _addTag(Recipe recipe, String newTag) async {
    try {
      final updatedTags = [...recipe.tags, newTag];
      final updatedRecipe = recipe.copyWith(tags: updatedTags);
      
      await ref.read(recipeProvider.notifier).updateRecipe(updatedRecipe);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Added tag "#$newTag"'),
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

  Future<void> _removeTag(Recipe recipe, String tagToRemove) async {
    try {
      final updatedTags = recipe.tags.where((tag) => tag != tagToRemove).toList();
      final updatedRecipe = recipe.copyWith(tags: updatedTags);
      
      await ref.read(recipeProvider.notifier).updateRecipe(updatedRecipe);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Removed tag "#$tagToRemove"'),
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

  // Helper method to check if an ingredient can be scaled (contains numbers)
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
