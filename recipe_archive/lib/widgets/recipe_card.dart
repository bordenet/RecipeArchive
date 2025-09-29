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
            // Recipe Image - responsive ratio based on screen width
            AspectRatio(
              aspectRatio: _getImageAspectRatio(context), // Dynamic ratio for different screen sizes
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
                        // Image load error for recipe "${recipe.title}": ${recipe.imageUrl}
                        // Error details: $error

                        return Container(
                          color: Colors.grey[100],
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.broken_image,
                                size: 32,
                                color: Colors.grey[400],
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Image unavailable',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.grey[500],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    )
                  : Container(
                      color: Colors.grey[100],
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.restaurant_menu,
                            size: 32,
                            color: Colors.grey[400],
                          ),
                          SizedBox(height: 4),
                          Text(
                            'No image',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey[500],
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
            
            // Recipe Content - compact padding with pinned bottom
            Expanded(
              child: Stack(
                children: [
                  // Star rating badge - top right
                  if (recipe.personalRating != null && recipe.personalRating! > 0)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade100,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.amber.shade300, width: 0.5),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.star,
                              size: 12,
                              color: Colors.amber.shade700,
                            ),
                            const SizedBox(width: 2),
                            Text(
                              recipe.personalRating!.round().toString(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.amber.shade700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  
                  // Main content - scrollable without visible scroll bars
                  Padding(
                    padding: EdgeInsets.all(_getContentPadding(context)),
                    child: ScrollConfiguration(
                      behavior: ScrollConfiguration.of(context).copyWith(
                        scrollbars: false, // Hide scroll bars
                      ),
                      child: SingleChildScrollView(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        // Title
                        Padding(
                          padding: EdgeInsets.only(
                            right: recipe.personalRating != null && recipe.personalRating! > 0 ? 60 : 0,
                          ),
                          child: Text(
                            recipe.cleanTitle,
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                            // Remove maxLines restriction to allow scrolling to full title
                          ),
                        ),
                        
                        SizedBox(height: _getVerticalSpacing(context)),
                        
                        // Tags display
                        if (recipe.tags.isNotEmpty)
                          Padding(
                            padding: EdgeInsets.only(bottom: _getVerticalSpacing(context)),
                            child: Wrap(
                              spacing: 4,
                              runSpacing: 2,
                              children: recipe.tags.map((tag) => Container( // Show all tags, not just first 3
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.green.shade200, width: 0.5),
                                ),
                                child: Text(
                                  tag,
                                  style: TextStyle(
                                    fontSize: 9,
                                    color: Colors.green.shade700,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              )).toList(),
                            ),
                          ),
                    
                        // Description - show full description when scrolling
                        if (recipe.description != null)
                          Text(
                            recipe.cleanDescription,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey[600],
                              fontSize: 11,
                            ),
                            // Remove maxLines restriction to allow full description scrolling
                          ),
                        
                        // Add consistent spacing whether description exists or not
                        if (recipe.description == null)
                          SizedBox(height: _getVerticalSpacing(context)),
                        
                        SizedBox(height: _getVerticalSpacing(context)),
                        
                        // Time & Servings row - properly spaced with flex to prevent overlap
                        if (recipe.displayTime != 'Unknown' || recipe.displayServings != 'Unknown servings')
                          Padding(
                            padding: EdgeInsets.only(bottom: _getVerticalSpacing(context) * 0.5),
                            child: Row(
                              children: [
                                // Time on the left - takes available space but allows servings
                                if (recipe.displayTime != 'Unknown')
                                  Expanded(
                                    flex: 2,
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.access_time,
                                          size: 14,
                                          color: Colors.grey[500],
                                        ),
                                        const SizedBox(width: 4),
                                        Flexible(
                                          child: Text(
                                            recipe.displayTime,
                                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                              fontSize: 11,
                                              color: Colors.grey[600],
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  )
                                else
                                  // Empty flexible spacer if no time to maintain layout
                                  const Flexible(flex: 1, child: SizedBox.shrink()),
                                
                                // Add minimum spacing between time and servings
                                const SizedBox(width: 12),

                                // Serving size on the right - flexible to avoid overflow
                                if (recipe.displayServings != 'Unknown servings')
                                  Flexible(
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Icon(
                                          Icons.people,
                                          size: 14,
                                          color: Colors.grey[500],
                                        ),
                                        const SizedBox(width: 4),
                                        Flexible(
                                          child: Text(
                                            recipe.displayServings,
                                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                              fontSize: 11,
                                              color: Colors.grey[600],
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                            textAlign: TextAlign.right,
                                          ),
                                        ),
                                      ],
                                    ),
                                  )
                                else
                                  // Empty flexible spacer if no servings to maintain layout
                                  const Flexible(child: SizedBox.shrink()),
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
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Get responsive image aspect ratio based on screen width
  double _getImageAspectRatio(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    
    if (screenWidth > 800) {
      return 2.2; // Wide ratio for desktop/tablet
    } else if (screenWidth > 600) {
      return 2.5; // Moderately wider for 2-column
    } else {
      return 2.8; // Wider for single column but not excessive
    }
  }

  // Get responsive content padding based on screen width
  double _getContentPadding(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    
    if (screenWidth > 800) {
      return 8.0; // Standard padding for desktop/tablet
    } else if (screenWidth > 600) {
      return 6.0; // Tighter padding for 2-column
    } else {
      return 4.0; // Very tight padding for single column
    }
  }

  // Get responsive vertical spacing based on screen width
  double _getVerticalSpacing(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    
    if (screenWidth > 800) {
      return 6.0; // Standard spacing for desktop/tablet
    } else if (screenWidth > 600) {
      return 4.0; // Tighter spacing for 2-column
    } else {
      return 2.0; // Very tight spacing for single column
    }
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
