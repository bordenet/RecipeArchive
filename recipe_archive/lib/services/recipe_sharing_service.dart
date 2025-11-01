/// Service for handling recipe sharing via iOS Share Extension
library;

import 'package:flutter/material.dart';
import '../models/recipe.dart';
import '../services/recipe_service.dart';
import '../services/share_channel.dart';

/// Handles recipe sharing operations from iOS Share Extension
class RecipeSharingService {
  final RecipeService _recipeService;

  RecipeSharingService(this._recipeService);

  /// Checks for shared URLs from iOS Share Extension
  Future<SharedRecipeData?> checkForSharedUrl() async {
    final sharedData = await ShareChannel.checkForSharedUrl();
    if (sharedData == null) return null;

    final url = sharedData['url'] as String?;
    if (url == null) return null;

    final html = sharedData['html'] as String?;
    final images = sharedData['images'] as List?;

    debugPrint('DEBUG: Recipe sharing - URL = $url');
    debugPrint('DEBUG: Recipe sharing - Has HTML = ${html != null}');
    if (html != null) {
      debugPrint('DEBUG: Recipe sharing - HTML length = ${html.length}');
    }
    if (images != null) {
      debugPrint('DEBUG: Recipe sharing - ${images.length} images');
    }

    return SharedRecipeData(
      url: url,
      html: html,
      images: images,
    );
  }

  /// Processes and saves a shared recipe
  Future<Recipe> processSharedRecipe(
    String url, {
    String? html,
    List? images,
  }) async {
    debugPrint('DEBUG: Processing shared recipe from $url');

    final uri = Uri.parse(url);
    final domain = uri.host.replaceAll('www.', '');

    // Build recipe data with HTML if available
    final recipeData = {
      'id': '', // Will be set by backend
      'sourceUrl': url,
      'title': 'Recipe from $domain',
      'ingredients': [],
      'instructions': [],
      if (html != null && html.isNotEmpty) 'webArchiveHtml': html,
      if (images != null && images.isNotEmpty) 'webArchiveImages': images,
    };

    debugPrint('DEBUG: Recipe data includes HTML: ${html != null && html.isNotEmpty}');
    if (html != null && html.isNotEmpty) {
      debugPrint('DEBUG: HTML length being sent: ${html.length} chars');
    }
    if (images != null && images.isNotEmpty) {
      debugPrint('DEBUG: Sending ${images.length} images');
    }

    final recipe = await _recipeService.saveRecipeRaw(recipeData);
    debugPrint('DEBUG: Recipe saved successfully with ID: ${recipe.id}');

    return recipe;
  }

  /// Sets up the shared URL handler callback
  void setSharedUrlHandler(void Function(SharedRecipeData data) onSharedUrl) {
    ShareChannel.setSharedUrlHandler((sharedData) {
      final url = sharedData['url'] as String?;
      if (url == null) return;

      final html = sharedData['html'] as String?;
      final images = sharedData['images'] as List?;

      onSharedUrl(SharedRecipeData(
        url: url,
        html: html,
        images: images,
      ));
    });
  }
}

/// Data class for shared recipe information
class SharedRecipeData {
  final String url;
  final String? html;
  final List? images;

  const SharedRecipeData({
    required this.url,
    this.html,
    this.images,
  });

  /// Returns a user-friendly message based on the data available
  String get processingMessage {
    if (html != null && html!.isNotEmpty) {
      return 'Processing recipe with HTML...';
    }
    return 'Processing shared URL...';
  }
}
