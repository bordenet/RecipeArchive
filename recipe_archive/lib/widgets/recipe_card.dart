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
                // Recipe Image with responsive height
                SizedBox(
                  height: 140, // Slightly reduced to leave more room for text
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
                
                // Recipe Info (better content management)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title with better wrapping
                        Text(
                          recipe.cleanTitle,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            fontSize: 15, // Slightly smaller for better fit
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        
                        const SizedBox(height: 6),
                        
                        // Description (adaptive)
                        if (recipe.description != null)
                          Text(
                            recipe.cleanDescription,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey[600],
                              fontSize: 12, // Smaller text
                            ),
                            maxLines: 2, // Allow 2 lines for better readability
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
                      
                      // Tags (more compact) - show before source
                      if (recipe.tags.isNotEmpty) ...[
                        Wrap(
                          spacing: 3, // Reduced spacing
                          runSpacing: 3, // Reduced spacing
                          children: recipe.tags.take(2).map((tag) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.grey[200],
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '#$tag',
                              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: Colors.grey[700],
                                fontSize: 10,
                              ),
                            ),
                          )).toList(),
                        ),
                        const SizedBox(height: 6),
                      ],
                      
                      // Source website (always visible at bottom)
                      const Spacer(), // Push to bottom
                      GestureDetector(
                        onTap: () => _launchSourceUrl(recipe.sourceUrl),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.blue[50],
                            borderRadius: BorderRadius.circular(6),
                            border: recipe.sourceUrl != null 
                              ? Border.all(color: Colors.blue[200]!, width: 0.5)
                              : null,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Flexible(
                                child: Text(
                                  recipe.displaySourceName,
                                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: Colors.blue[700],
                                    fontWeight: FontWeight.w500,
                                    fontSize: 11,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (recipe.sourceUrl != null) ...[
                                const SizedBox(width: 3),
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
                    ],
                  ),
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
