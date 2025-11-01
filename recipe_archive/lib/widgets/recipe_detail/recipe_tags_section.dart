/// Editable tags section for recipe detail screen
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/recipe.dart';
import '../../providers/recipe_provider.dart';

/// Displays and manages recipe tags with add/remove functionality
class RecipeTagsSection extends ConsumerWidget {
  final Recipe recipe;
  final Future<void> Function(Recipe recipe, String tag) onAddTag;
  final Future<void> Function(Recipe recipe, String tag) onRemoveTag;

  const RecipeTagsSection({
    super.key,
    required this.recipe,
    required this.onAddTag,
    required this.onRemoveTag,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Get the current recipe from the provider to get latest tags
    final recipesAsyncValue = ref.watch(recipeProvider);
    final currentRecipe = recipesAsyncValue.when(
      data: (recipes) => recipes.firstWhere(
        (r) => r.id == recipe.id,
        orElse: () => recipe,
      ),
      loading: () => recipe,
      error: (_, __) => recipe,
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
        if (currentRecipe.tags.isEmpty)
          _buildEmptyState()
        else
          _buildTagsList(context, currentRecipe),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
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
    );
  }

  Widget _buildTagsList(BuildContext context, Recipe currentRecipe) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: currentRecipe.tags
          .map((tag) => _buildEditableTag(context, tag, currentRecipe))
          .toList(),
    );
  }

  Widget _buildEditableTag(
      BuildContext context, String tag, Recipe currentRecipe) {
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
            onPressed: () => _showRemoveTagDialog(context, tag, currentRecipe),
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

  void _showAddTagDialog(BuildContext context, Recipe currentRecipe) {
    final controller = TextEditingController();

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
      if (newTag != null && !currentRecipe.tags.contains(newTag)) {
        onAddTag(currentRecipe, newTag);
      }
    });
  }

  void _showRemoveTagDialog(
      BuildContext context, String tag, Recipe currentRecipe) {
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
                onRemoveTag(currentRecipe, tag);
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
}
