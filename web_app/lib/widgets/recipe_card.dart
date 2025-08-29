import 'package:flutter/material.dart';
import '../models/recipe.dart';

class RecipeCard extends StatelessWidget {
  final Recipe recipe;
  final VoidCallback onTap;
  final VoidCallback? onFavorite;

  const RecipeCard({
    super.key,
    required this.recipe,
    required this.onTap,
    this.onFavorite,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Recipe image
            _buildRecipeImage(context),
            
            // Recipe content
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title and favorite button
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          recipe.title,
                          style: Theme.of(context).textTheme.titleLarge,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (onFavorite != null)
                        IconButton(
                          onPressed: onFavorite,
                          icon: Icon(
                            recipe.isFavorite ? Icons.favorite : Icons.favorite_border,
                            color: recipe.isFavorite 
                              ? Colors.red 
                              : Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                          ),
                        ),
                    ],
                  ),
                  
                  // Description
                  if (recipe.description != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      recipe.description!,
                      style: Theme.of(context).textTheme.bodyMedium,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  
                  const SizedBox(height: 12),
                  
                  // Recipe stats
                  _buildRecipeStats(context),
                  
                  // Tags
                  if (recipe.tags.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _buildTags(context),
                  ],
                  
                  // Rating
                  if (recipe.userRating != null) ...[
                    const SizedBox(height: 8),
                    _buildRating(context),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecipeImage(BuildContext context) {
    return SizedBox(
      height: 200,
      width: double.infinity,
      child: recipe.imageUrl != null
        ? Image.network(
            recipe.imageUrl!,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return _buildDefaultImage(context);
            },
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              return Center(
                child: CircularProgressIndicator(
                  value: loadingProgress.expectedTotalBytes != null
                    ? loadingProgress.cumulativeBytesLoaded / 
                      loadingProgress.expectedTotalBytes!
                    : null,
                ),
              );
            },
          )
        : _buildDefaultImage(context),
    );
  }

  Widget _buildDefaultImage(BuildContext context) {
    return Container(
      color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
      child: Icon(
        Icons.restaurant_menu,
        size: 60,
        color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
      ),
    );
  }

  Widget _buildRecipeStats(BuildContext context) {
    final stats = <Widget>[];

    // Time
    if (recipe.totalTimeMinutes > 0) {
      stats.add(_buildStatItem(
        context,
        Icons.schedule,
        recipe.formattedTime,
      ));
    }

    // Servings
    if (recipe.servings != null) {
      stats.add(_buildStatItem(
        context,
        Icons.people,
        recipe.formattedServings,
      ));
    }

    // Cuisine
    if (recipe.cuisine != null) {
      stats.add(_buildStatItem(
        context,
        Icons.public,
        recipe.cuisine!,
      ));
    }

    if (stats.isEmpty) return const SizedBox.shrink();

    return Row(
      children: stats
        .expand((widget) => [widget, const SizedBox(width: 16)])
        .take(stats.length * 2 - 1)
        .toList(),
    );
  }

  Widget _buildStatItem(BuildContext context, IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 16,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(width: 4),
        Text(
          text,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
          ),
        ),
      ],
    );
  }

  Widget _buildTags(BuildContext context) {
    final displayTags = recipe.tags.take(3).toList();
    final hasMoreTags = recipe.tags.length > 3;

    return Row(
      children: [
        ...displayTags.map((tag) => Padding(
          padding: const EdgeInsets.only(right: 6),
          child: Chip(
            label: Text(tag),
            backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
            labelStyle: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.primary,
            ),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            visualDensity: VisualDensity.compact,
          ),
        )),
        if (hasMoreTags)
          Text(
            '+${recipe.tags.length - 3}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
            ),
          ),
      ],
    );
  }

  Widget _buildRating(BuildContext context) {
    return Row(
      children: [
        ...List.generate(5, (index) {
          return Icon(
            index < recipe.userRating!
              ? Icons.star
              : Icons.star_border,
            size: 16,
            color: Colors.amber,
          );
        }),
        const SizedBox(width: 4),
        Text(
          '${recipe.userRating}/5',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
          ),
        ),
      ],
    );
  }
}
