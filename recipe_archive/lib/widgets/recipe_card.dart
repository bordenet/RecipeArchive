import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/recipe.dart';

class RecipeCard extends StatelessWidget {
  final Recipe recipe;
  final VoidCallback? onTap;

  const RecipeCard({
    super.key,
    required this.recipe,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2, // Reduced elevation for cleaner look
      margin: const EdgeInsets.all(4), // Reduced margin
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Recipe Image (reduced height by 20%)
                SizedBox(
                  height: 160,
                  width: double.infinity,
                  child: recipe.imageUrl != null
                      ? Image.network(
                          recipe.imageUrl!,
                          fit: BoxFit.cover,
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) {
                              return child;
                            }
                            return Center(
                              child: CircularProgressIndicator(
                                value: loadingProgress.expectedTotalBytes != null
                                    ? loadingProgress.cumulativeBytesLoaded / loadingProgress.expectedTotalBytes!
                                    : null,
                                color: Colors.green,
                              ),
                            );
                          },
                          errorBuilder: (context, error, stackTrace) {
                            // print('Image load error for ${recipe.imageUrl}: $error');
                            return Container(
                              color: Colors.grey[300],
                              child: const Icon(
                                Icons.restaurant_menu,
                                size: 64,
                                color: Colors.grey,
                              ),
                            );
                          },
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
                
                // Recipe Info (compacted)
                Padding(
                  padding: const EdgeInsets.all(12), // Reduced padding
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title (with HTML entity decoding)
                      Text(
                        recipe.cleanTitle,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      
                      const SizedBox(height: 6), // Reduced spacing
                      
                      // Description (more compact, with HTML entity decoding)
                      if (recipe.description != null)
                        Text(
                          recipe.cleanDescription,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey[600],
                          ),
                          maxLines: 1, // Reduced to 1 line
                          overflow: TextOverflow.ellipsis,
                        ),
                      
                      const SizedBox(height: 8), // Reduced spacing
                      
                      // Recipe Meta Info
                      Row(
                        children: [
                          // Cooking Time
                          Icon(
                            Icons.access_time,
                            size: 16,
                            color: Colors.grey[600],
                          ),
                          const SizedBox(width: 4),
                          Text(
                            recipe.displayTime,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          
                          const SizedBox(width: 16),
                          
                          // Servings
                          Icon(
                            Icons.people,
                            size: 16,
                            color: Colors.grey[600],
                          ),
                          const SizedBox(width: 4),
                          Text(
                            recipe.displayServings,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 8),
                      
                      // Source website (clickable) - moved to new line and left-aligned
                      Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                            onTap: () => _launchSourceUrl(recipe.sourceUrl),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.blue[50],
                                borderRadius: BorderRadius.circular(8),
                                border: recipe.sourceUrl != null 
                                  ? Border.all(color: Colors.blue[200]!, width: 0.5)
                                  : null,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    recipe.displaySourceName,
                                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                      color: Colors.blue[700],
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  if (recipe.sourceUrl != null) ...[
                                    const SizedBox(width: 2),
                                    Icon(
                                      Icons.launch,
                                      size: 10,
                                      color: Colors.blue[600],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                        ),
                      ),
                      
                      // Tags (more compact)
                      if (recipe.tags.isNotEmpty) ...[
                        const SizedBox(height: 6), // Reduced spacing
                        Wrap(
                          spacing: 3, // Reduced spacing
                          runSpacing: 3, // Reduced spacing
                          children: recipe.tags.take(2).map((tag) => Container( // Only show 2 tags
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4, // Reduced padding
                              vertical: 1, // Reduced padding
                            ),
                            decoration: BoxDecoration(
                              color: Colors.grey[200],
                              borderRadius: BorderRadius.circular(6), // Smaller radius
                            ),
                            child: Text(
                              '#$tag',
                              style: Theme.of(context).textTheme.labelSmall?.copyWith( // Smaller text
                                color: Colors.grey[700],
                              ),
                            ),
                          )).toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            
          ],
        ),
      ),
    );
  }

  // Launch source URL in browser
  Future<void> _launchSourceUrl(String? url) async {
    if (url == null || url.isEmpty) return;
    
    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      // Silently fail if URL can't be launched
    }
  }
}
