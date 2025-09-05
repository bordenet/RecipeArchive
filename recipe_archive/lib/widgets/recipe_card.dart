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
      elevation: 1,
      margin: const EdgeInsets.all(6),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Recipe Image - compact but properly sized
            AspectRatio(
              aspectRatio: 4 / 3, // More horizontal, less square
              child: recipe.imageUrl != null
                  ? Image.network(
                      recipe.imageUrl!,
                      fit: BoxFit.cover,
                      loadingBuilder: (context, child, loadingProgress) {
                        if (loadingProgress == null) return child;
                        return Container(
                          color: Colors.grey[100],
                          child: Center(
                            child: SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.green),
                              ),
                            ),
                          ),
                        );
                      },
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          color: Colors.grey[100],
                          child: Icon(
                            Icons.restaurant_menu,
                            size: 48,
                            color: Colors.grey[400],
                          ),
                        );
                      },
                    )
                  : Container(
                      color: Colors.grey[100],
                      child: Icon(
                        Icons.restaurant_menu,
                        size: 48,
                        color: Colors.grey[400],
                      ),
                    ),
            ),
            
            // Recipe Content - compact padding with pinned bottom
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    Text(
                      recipe.cleanTitle,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    
                    const SizedBox(height: 4),
                    
                    // Description - take up available space
                    if (recipe.description != null)
                      Expanded(
                        child: Text(
                          recipe.cleanDescription,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey[600],
                            fontSize: 11,
                          ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    
                    // If no description, add flexible space
                    if (recipe.description == null)
                      const Spacer(),
                    
                    const SizedBox(height: 8),
                    
                    // Time & Servings row - pinned above source
                    if (recipe.displayTime != 'Unknown' || recipe.displayServings != 'Unknown servings')
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          children: [
                            if (recipe.displayTime != 'Unknown') ...[
                              Icon(
                                Icons.access_time,
                                size: 14,
                                color: Colors.grey[500],
                              ),
                              const SizedBox(width: 4),
                              Text(
                                recipe.displayTime,
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  fontSize: 11,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                            
                            if (recipe.displayTime != 'Unknown' && recipe.displayServings != 'Unknown servings')
                              const SizedBox(width: 12),
                            
                            if (recipe.displayServings != 'Unknown servings') ...[
                              Icon(
                                Icons.people,
                                size: 14,
                                color: Colors.grey[500],
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  recipe.displayServings,
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    fontSize: 11,
                                    color: Colors.grey[600],
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    
                    // Source website - always pinned to bottom
                    GestureDetector(
                      onTap: () => _launchSourceUrl(recipe.sourceUrl),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
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
                            Expanded(
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
                              const SizedBox(width: 4),
                              Icon(
                                Icons.launch,
                                size: 12,
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
