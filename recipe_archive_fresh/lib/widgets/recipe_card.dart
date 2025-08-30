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
      elevation: 4,
      margin: const EdgeInsets.all(8),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Recipe Image
                Container(
                  height: 200,
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
                            print('Image load error for ${recipe.imageUrl}: $error');
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
                
                // Recipe Info
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title
                      Text(
                        recipe.title,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      
                      const SizedBox(height: 8),
                      
                      // Description
                      if (recipe.description != null)
                        Text(
                          recipe.description!,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey[600],
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      
                      const SizedBox(height: 12),
                      
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
                          
                          const Spacer(),
                          
                          // Cuisine
                          if (recipe.cuisine != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.green[100],
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                recipe.cuisine!,
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.green[800],
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                        ],
                      ),
                      
                      // Tags
                      if (recipe.tags.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: recipe.tags.take(3).map((tag) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.grey[200],
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '#$tag',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
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

  // Launch URL in browser
  Future<void> _launchUrl(String url) async {
    try {
      final Uri uri = Uri.parse(url);
      print('Attempting to launch URL: $url');
      
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        print('URL launched successfully');
      } else {
        print('Cannot launch URL: $url');
        // Fallback: try with platform default mode
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      print('Error launching URL: $e');
    }
  }

}
