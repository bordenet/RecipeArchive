import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/recipe.dart';
import '../providers/recipe_provider.dart';
import '../widgets/star_rating.dart';

class RecipeEditScreen extends ConsumerStatefulWidget {
  final Recipe recipe;
  
  const RecipeEditScreen({super.key, required this.recipe});
  
  @override
  ConsumerState<RecipeEditScreen> createState() => _RecipeEditScreenState();
}

class _RecipeEditScreenState extends ConsumerState<RecipeEditScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  
  // Form controllers
  late TextEditingController _titleController;
  late TextEditingController _descriptionController;
  late TextEditingController _difficultyController;
  late TextEditingController _prepTimeController;
  late TextEditingController _cookingTimeController;
  late TextEditingController _servingsController;
  late TextEditingController _cuisineController;
  late TextEditingController _personalNotesController;
  late TextEditingController _cookingNotesController;
  late TextEditingController _personalYieldController;
  
  // Lists for ingredients and instructions
  List<TextEditingController> _ingredientControllers = [];
  List<TextEditingController> _instructionControllers = [];
  
  // Tags and categories
  List<String> _tags = [];
  List<String> _categories = [];
  String _newTag = '';
  String _newCategory = '';
  
  // Rating and favorite
  double _personalRating = 0.0;
  bool _isFavorite = false;
  
  // Form state
  bool _hasUnsavedChanges = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _initializeControllers();
    _loadRecipeData();
  }

  void _initializeControllers() {
    _titleController = TextEditingController();
    _descriptionController = TextEditingController();
    _difficultyController = TextEditingController();
    _prepTimeController = TextEditingController();
    _cookingTimeController = TextEditingController();
    _servingsController = TextEditingController();
    _cuisineController = TextEditingController();
    _personalNotesController = TextEditingController();
    _cookingNotesController = TextEditingController();
    _personalYieldController = TextEditingController();
    
    // Add listeners to track changes
    final controllers = [
      _titleController, _descriptionController, _difficultyController,
      _prepTimeController, _cookingTimeController, _servingsController,
      _cuisineController, _personalNotesController, _cookingNotesController,
      _personalYieldController
    ];
    
    for (final controller in controllers) {
      controller.addListener(() {
        if (!_hasUnsavedChanges) {
          setState(() => _hasUnsavedChanges = true);
        }
      });
    }
  }

  void _loadRecipeData() {
    _titleController.text = widget.recipe.title;
    _descriptionController.text = widget.recipe.description ?? '';
    _difficultyController.text = widget.recipe.difficulty ?? '';
    _prepTimeController.text = widget.recipe.prepTime?.toString() ?? '';
    _cookingTimeController.text = widget.recipe.cookingTime?.toString() ?? '';
    _servingsController.text = widget.recipe.servings?.toString() ?? '';
    _cuisineController.text = widget.recipe.cuisine ?? '';
    _personalNotesController.text = widget.recipe.personalNotes ?? '';
    _cookingNotesController.text = widget.recipe.cookingNotes ?? '';
    _personalYieldController.text = widget.recipe.personalYield?.toString() ?? '';
    
    _tags = List.from(widget.recipe.tags);
    _categories = List.from(widget.recipe.categories);
    _personalRating = widget.recipe.personalRating ?? 0.0;
    _isFavorite = widget.recipe.isFavorite;
    
    // Initialize ingredient controllers
    _ingredientControllers = widget.recipe.ingredients
        .map((ingredient) => TextEditingController(text: ingredient.text))
        .toList();
        
    // Initialize instruction controllers
    _instructionControllers = widget.recipe.instructions
        .map((instruction) => TextEditingController(text: instruction.text))
        .toList();
        
    // Add listeners to ingredient and instruction controllers
    for (final controller in [..._ingredientControllers, ..._instructionControllers]) {
      controller.addListener(() {
        if (!_hasUnsavedChanges) {
          setState(() => _hasUnsavedChanges = true);
        }
      });
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleController.dispose();
    _descriptionController.dispose();
    _difficultyController.dispose();
    _prepTimeController.dispose();
    _cookingTimeController.dispose();
    _servingsController.dispose();
    _cuisineController.dispose();
    _personalNotesController.dispose();
    _cookingNotesController.dispose();
    _personalYieldController.dispose();
    
    for (final controller in _ingredientControllers) {
      controller.dispose();
    }
    for (final controller in _instructionControllers) {
      controller.dispose();
    }
    
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop && _hasUnsavedChanges) {
          final shouldPop = await _showUnsavedChangesDialog();
          if (shouldPop && context.mounted) {
            Navigator.of(context).pop();
          }
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('Edit Recipe'),
          bottom: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabs: const [
              Tab(text: 'Basic Info'),
              Tab(text: 'Ingredients'),
              Tab(text: 'Instructions'),
              Tab(text: 'Personal'),
            ],
          ),
          actions: [
            if (_hasUnsavedChanges)
              TextButton(
                onPressed: _isLoading ? null : _saveRecipe,
                child: _isLoading 
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save'),
              ),
          ],
        ),
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildBasicInfoTab(),
            _buildIngredientsTab(),
            _buildInstructionsTab(),
            _buildPersonalTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildBasicInfoTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _titleController,
            decoration: const InputDecoration(
              labelText: 'Recipe Title',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _descriptionController,
            decoration: const InputDecoration(
              labelText: 'Description',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _prepTimeController,
                  decoration: const InputDecoration(
                    labelText: 'Prep Time (minutes)',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  controller: _cookingTimeController,
                  decoration: const InputDecoration(
                    labelText: 'Cook Time (minutes)',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _servingsController,
                  decoration: const InputDecoration(
                    labelText: 'Servings',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  controller: _difficultyController,
                  decoration: const InputDecoration(
                    labelText: 'Difficulty',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _cuisineController,
            decoration: const InputDecoration(
              labelText: 'Cuisine',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          _buildTagsSection(),
        ],
      ),
    );
  }

  Widget _buildTagsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Tags', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ..._tags.map((tag) => Chip(
              label: Text(tag),
              onDeleted: () {
                setState(() {
                  _tags.remove(tag);
                  _hasUnsavedChanges = true;
                });
              },
            )),
            ActionChip(
              label: const Text('+ Add Tag'),
              onPressed: _showAddTagDialog,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildIngredientsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Ingredients',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 16),
          ..._ingredientControllers.asMap().entries.map((entry) {
            final index = entry.key;
            final controller = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Text('${index + 1}. ', 
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold)),
                  Expanded(
                    child: TextFormField(
                      controller: controller,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      maxLines: 2,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => _removeIngredient(index),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _addIngredient,
            icon: const Icon(Icons.add),
            label: const Text('Add Ingredient'),
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Instructions',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 16),
          ..._instructionControllers.asMap().entries.map((entry) {
            final index = entry.key;
            final controller = entry.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: controller,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 3,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => _removeInstruction(index),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _addInstruction,
            icon: const Icon(Icons.add),
            label: const Text('Add Instruction'),
          ),
        ],
      ),
    );
  }

  Widget _buildPersonalTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Favorite Recipe',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Switch(
                value: _isFavorite,
                onChanged: (value) {
                  setState(() {
                    _isFavorite = value;
                    _hasUnsavedChanges = true;
                  });
                },
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('Personal Rating', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          StarRating(
            rating: _personalRating,
            onRatingChanged: (rating) {
              setState(() {
                _personalRating = rating;
                _hasUnsavedChanges = true;
              });
            },
            size: 40,
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _personalYieldController,
            decoration: const InputDecoration(
              labelText: 'Personal Preferred Yield',
              helperText: 'Your preferred number of servings',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _personalNotesController,
            decoration: const InputDecoration(
              labelText: 'Personal Notes',
              helperText: 'Your thoughts about this recipe',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _cookingNotesController,
            decoration: const InputDecoration(
              labelText: 'Cooking Notes',
              helperText: 'Tips and modifications you\'ve made',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 24),
          _buildCategoriesSection(),
        ],
      ),
    );
  }

  Widget _buildCategoriesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Personal Categories', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ..._categories.map((category) => Chip(
              label: Text(category),
              onDeleted: () {
                setState(() {
                  _categories.remove(category);
                  _hasUnsavedChanges = true;
                });
              },
            )),
            ActionChip(
              label: const Text('+ Add Category'),
              onPressed: _showAddCategoryDialog,
            ),
          ],
        ),
      ],
    );
  }

  void _addIngredient() {
    setState(() {
      final controller = TextEditingController();
      controller.addListener(() {
        if (!_hasUnsavedChanges) {
          setState(() => _hasUnsavedChanges = true);
        }
      });
      _ingredientControllers.add(controller);
      _hasUnsavedChanges = true;
    });
  }

  void _removeIngredient(int index) {
    setState(() {
      _ingredientControllers[index].dispose();
      _ingredientControllers.removeAt(index);
      _hasUnsavedChanges = true;
    });
  }

  void _addInstruction() {
    setState(() {
      final controller = TextEditingController();
      controller.addListener(() {
        if (!_hasUnsavedChanges) {
          setState(() => _hasUnsavedChanges = true);
        }
      });
      _instructionControllers.add(controller);
      _hasUnsavedChanges = true;
    });
  }

  void _removeInstruction(int index) {
    setState(() {
      _instructionControllers[index].dispose();
      _instructionControllers.removeAt(index);
      _hasUnsavedChanges = true;
    });
  }

  Future<void> _showAddTagDialog() async {
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Tag'),
        content: TextFormField(
          onChanged: (value) => _newTag = value,
          decoration: const InputDecoration(
            labelText: 'Tag name',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, _newTag),
            child: const Text('Add'),
          ),
        ],
      ),
    );

    if (result != null && result.trim().isNotEmpty) {
      setState(() {
        _tags.add(result.trim());
        _hasUnsavedChanges = true;
      });
    }
  }

  Future<void> _showAddCategoryDialog() async {
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Category'),
        content: TextFormField(
          onChanged: (value) => _newCategory = value,
          decoration: const InputDecoration(
            labelText: 'Category name',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, _newCategory),
            child: const Text('Add'),
          ),
        ],
      ),
    );

    if (result != null && result.trim().isNotEmpty) {
      setState(() {
        _categories.add(result.trim());
        _hasUnsavedChanges = true;
      });
    }
  }

  Future<bool> _showUnsavedChangesDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Unsaved Changes'),
        content: const Text('You have unsaved changes. Are you sure you want to leave?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Stay'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _saveRecipe() async {
    setState(() => _isLoading = true);

    try {
      // Create updated recipe
      final updatedRecipe = widget.recipe.copyWith(
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim().isNotEmpty ? _descriptionController.text.trim() : null,
        difficulty: _difficultyController.text.trim().isNotEmpty ? _difficultyController.text.trim() : null,
        prepTime: int.tryParse(_prepTimeController.text.trim()),
        cookingTime: int.tryParse(_cookingTimeController.text.trim()),
        servings: int.tryParse(_servingsController.text.trim()),
        cuisine: _cuisineController.text.trim().isNotEmpty ? _cuisineController.text.trim() : null,
        tags: _tags,
        personalNotes: _personalNotesController.text.trim().isNotEmpty ? _personalNotesController.text.trim() : null,
        personalRating: _personalRating > 0 ? _personalRating : null,
        cookingNotes: _cookingNotesController.text.trim().isNotEmpty ? _cookingNotesController.text.trim() : null,
        categories: _categories,
        isFavorite: _isFavorite,
        personalYield: int.tryParse(_personalYieldController.text.trim()),
        ingredients: _ingredientControllers
            .where((controller) => controller.text.trim().isNotEmpty)
            .map((controller) => RecipeIngredient(text: controller.text.trim()))
            .toList(),
        instructions: _instructionControllers
            .asMap()
            .entries
            .where((entry) => entry.value.text.trim().isNotEmpty)
            .map((entry) => RecipeInstruction(
              stepNumber: entry.key + 1,
              text: entry.value.text.trim(),
            ))
            .toList(),
      );

      // Save via provider
      await ref.read(recipeProvider.notifier).updateRecipe(updatedRecipe);

      setState(() {
        _hasUnsavedChanges = false;
        _isLoading = false;
      });

      if (context.mounted) {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Recipe saved successfully!')),
        );
        // ignore: use_build_context_synchronously
        Navigator.pop(context, updatedRecipe);
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (context.mounted) {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving recipe: $e')),
        );
      }
    }
  }
}