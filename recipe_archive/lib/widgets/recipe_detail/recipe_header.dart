/// Recipe detail screen header with image and action buttons
library;

import 'package:flutter/material.dart';
import '../../models/recipe.dart';

/// Header component for recipe detail screen with expandable image
class RecipeHeader extends StatelessWidget {
  final Recipe recipe;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback? onViewSource;

  const RecipeHeader({
    super.key,
    required this.recipe,
    required this.onEdit,
    required this.onDelete,
    this.onViewSource,
  });

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
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
        if (recipe.sourceUrl != null && onViewSource != null)
          IconButton(
            icon: const Icon(Icons.open_in_new),
            onPressed: onViewSource,
            tooltip: 'View Original at Source',
            key: const Key('banner_source_button'),
          ),
        IconButton(
          icon: const Icon(Icons.edit),
          onPressed: onEdit,
          tooltip: 'Edit Recipe',
          key: const Key('banner_edit_button'),
        ),
        IconButton(
          icon: const Icon(Icons.delete),
          onPressed: onDelete,
          tooltip: 'Delete Recipe',
          key: const Key('banner_delete_button'),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          recipe.cleanTitle,
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
        background: _buildBackground(),
      ),
    );
  }

  Widget _buildBackground() {
    if (recipe.imageUrl == null) {
      return Container(
        color: Colors.grey[300],
        child: const Icon(
          Icons.restaurant_menu,
          size: 64,
          color: Colors.grey,
        ),
      );
    }

    return Stack(
      children: [
        Image.network(
          recipe.imageUrl!,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;

            return Center(
              child: CircularProgressIndicator(
                value: loadingProgress.expectedTotalBytes != null
                    ? loadingProgress.cumulativeBytesLoaded /
                        loadingProgress.expectedTotalBytes!
                    : null,
                color: Colors.white,
              ),
            );
          },
          errorBuilder: (context, error, stackTrace) {
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
                  const SizedBox(height: 8),
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
    );
  }
}
