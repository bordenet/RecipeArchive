import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';
import '../models/recipe.dart';
import 'recipe_service.dart';

class BackupService {
  final RecipeService _recipeService;
  
  BackupService(this._recipeService);
  
  /// Export all user recipes to a JSON backup file
  Future<BackupResult> exportRecipes() async {
    try {
      final recipes = await _recipeService.getRecipes();
      
      final backupData = {
        'version': '1.0',
        'exportDate': DateTime.now().toIso8601String(),
        'recipeCount': recipes.length,
        'recipes': recipes.map((recipe) => recipe.toJson()).toList(),
        'metadata': {
          'platform': defaultTargetPlatform.name,
          'appVersion': '1.0.0', // TODO: Get from package info
        }
      };
      
      final jsonString = const JsonEncoder.withIndent('  ').convert(backupData);
      
      if (kIsWeb) {
        return await _exportForWeb(jsonString);
      } else {
        return await _exportForMobile(jsonString);
      }
    } catch (e) {
      return BackupResult.error('Failed to export recipes: $e');
    }
  }
  
  /// Import recipes from a JSON backup file with smart deduplication
  Future<RestoreResult> importRecipes(String jsonContent, {bool overwriteExisting = false}) async {
    try {
      final backupData = jsonDecode(jsonContent) as Map<String, dynamic>;
      
      // Validate backup format
      final validation = _validateBackupData(backupData);
      if (!validation.isValid) {
        return RestoreResult.error('Invalid backup file: ${validation.error}');
      }
      
      final recipesJson = backupData['recipes'] as List<dynamic>;
      final recipes = recipesJson
          .map((json) => Recipe.fromJson(json as Map<String, dynamic>))
          .toList();
      
      // Get all existing recipes for deduplication
      final existingRecipes = await _recipeService.getRecipes();
      
      int imported = 0;
      int skipped = 0;
      int updated = 0;
      int deduplicated = 0;
      final List<String> errors = [];
      
      for (final recipe in recipes) {
        try {
          // Check for existing recipe by ID first
          final existingById = await _recipeService.getRecipe(recipe.id);
          
          // Check for duplicate by content (title + source URL)
          final duplicateByContent = _findDuplicateByContent(recipe, existingRecipes);
          
          if (existingById != null) {
            if (overwriteExisting) {
              await _recipeService.updateRecipe(recipe);
              updated++;
            } else {
              // Create new recipe with different ID to avoid conflicts
              final newRecipe = _createUniqueRecipe(recipe);
              await _recipeService.saveRecipe(newRecipe);
              imported++;
            }
          } else if (duplicateByContent != null && !overwriteExisting) {
            // Skip duplicate content
            skipped++;
            deduplicated++;
            errors.add('Skipped duplicate recipe "${recipe.title}" (matches existing "${duplicateByContent.title}")');
          } else if (duplicateByContent != null && overwriteExisting) {
            // Update the existing duplicate with new content
            final updatedRecipe = Recipe(
              id: duplicateByContent.id, // Use existing ID
              userId: recipe.userId,
              title: recipe.title,
              description: recipe.description,
              imageUrl: recipe.imageUrl,
              sourceUrl: recipe.sourceUrl,
              sourceName: recipe.sourceName,
              difficulty: recipe.difficulty,
              prepTime: recipe.prepTime,
              cookTime: recipe.cookTime,
              ingredients: recipe.ingredients,
              instructions: recipe.instructions,
              cookingTime: recipe.cookingTime,
              servings: recipe.servings,
              cuisine: recipe.cuisine,
              tags: recipe.tags,
              personalNotes: recipe.personalNotes,
              personalRating: recipe.personalRating,
              cookingNotes: recipe.cookingNotes,
              categories: recipe.categories,
              isFavorite: recipe.isFavorite,
              personalYield: recipe.personalYield,
              hasUserModifications: recipe.hasUserModifications,
              originalData: recipe.originalData,
              createdAt: duplicateByContent.createdAt, // Keep original creation date
              updatedAt: DateTime.now(),
            );
            await _recipeService.updateRecipe(updatedRecipe);
            updated++;
          } else {
            // New recipe - import it
            await _recipeService.saveRecipe(recipe);
            imported++;
          }
        } catch (e) {
          errors.add('Failed to import "${recipe.title}": $e');
          skipped++;
        }
      }
      
      return RestoreResult.success(
        imported: imported,
        updated: updated,
        skipped: skipped,
        errors: errors,
        deduplicated: deduplicated,
      );
    } catch (e) {
      return RestoreResult.error('Failed to import recipes: $e');
    }
  }
  
  /// Find duplicate recipe by content matching (title and source URL)
  Recipe? _findDuplicateByContent(Recipe targetRecipe, List<Recipe> existingRecipes) {
    for (final existing in existingRecipes) {
      // Match by title and source URL (case-insensitive)
      final titleMatch = existing.title.toLowerCase().trim() == targetRecipe.title.toLowerCase().trim();
      final urlMatch = (existing.sourceUrl?.toLowerCase() == targetRecipe.sourceUrl?.toLowerCase()) && 
                      (existing.sourceUrl != null && targetRecipe.sourceUrl != null);
      
      if (titleMatch && urlMatch) {
        return existing;
      }
      
      // Also match by title alone if it's very specific (more than 20 chars and contains specific cooking terms)
      if (titleMatch && targetRecipe.title.length > 20 && _isSpecificRecipeTitle(targetRecipe.title)) {
        return existing;
      }
    }
    return null;
  }
  
  /// Check if a recipe title is specific enough to use for deduplication
  bool _isSpecificRecipeTitle(String title) {
    final cookingTerms = [
      'recipe', 'baked', 'roasted', 'grilled', 'fried', 'sautéed', 
      'braised', 'steamed', 'poached', 'marinated', 'glazed',
      'chicken', 'beef', 'pork', 'fish', 'salmon', 'pasta', 'rice',
      'soup', 'salad', 'cake', 'cookies', 'bread', 'muffins'
    ];
    
    final lowercaseTitle = title.toLowerCase();
    return cookingTerms.any((term) => lowercaseTitle.contains(term));
  }
  
  /// Validate backup data structure
  BackupValidation _validateBackupData(Map<String, dynamic> data) {
    if (!data.containsKey('version')) {
      return BackupValidation.invalid('Missing version field');
    }
    
    if (!data.containsKey('recipes')) {
      return BackupValidation.invalid('Missing recipes field');
    }
    
    final recipes = data['recipes'];
    if (recipes is! List) {
      return BackupValidation.invalid('Recipes field must be an array');
    }
    
    if (recipes.isEmpty) {
      return BackupValidation.invalid('No recipes found in backup');
    }
    
    // Validate each recipe has required fields
    for (int i = 0; i < recipes.length; i++) {
      final recipe = recipes[i];
      if (recipe is! Map<String, dynamic>) {
        return BackupValidation.invalid('Recipe $i is not a valid object');
      }
      
      if (!recipe.containsKey('id') || !recipe.containsKey('title')) {
        return BackupValidation.invalid('Recipe $i missing required fields (id, title)');
      }
    }
    
    return BackupValidation.valid();
  }
  
  /// Create a new recipe with unique ID to avoid conflicts
  Recipe _createUniqueRecipe(Recipe original) {
    final newId = 'imported_${DateTime.now().millisecondsSinceEpoch}_${original.id}';
    return Recipe(
      id: newId,
      userId: original.userId,
      title: '${original.title} (Imported)',
      description: original.description,
      imageUrl: original.imageUrl,
      sourceUrl: original.sourceUrl,
      sourceName: original.sourceName,
      difficulty: original.difficulty,
      prepTime: original.prepTime,
      cookTime: original.cookTime,
      ingredients: original.ingredients,
      instructions: original.instructions,
      cookingTime: original.cookingTime,
      servings: original.servings,
      cuisine: original.cuisine,
      tags: original.tags,
      personalNotes: original.personalNotes,
      personalRating: original.personalRating,
      cookingNotes: original.cookingNotes,
      categories: original.categories,
      isFavorite: original.isFavorite,
      personalYield: original.personalYield,
      hasUserModifications: true, // Mark as modified since it's imported
      originalData: original.originalData,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }
  
  /// Export backup for web platform
  Future<BackupResult> _exportForWeb(String jsonContent) async {
    try {
      // For web, we'll use the download functionality
      // This would need to be implemented with dart:html
      final fileName = 'recipe_backup_${DateTime.now().toIso8601String().split('T')[0]}.json';
      
      // TODO: Implement web download
      // For now, return the content for copying
      return BackupResult.success(
        message: 'Backup created successfully',
        filePath: fileName,
        content: jsonContent,
      );
    } catch (e) {
      return BackupResult.error('Failed to create web backup: $e');
    }
  }
  
  /// Export backup for mobile platforms
  Future<BackupResult> _exportForMobile(String jsonContent) async {
    try {
      // Request storage permission
      if (await Permission.storage.request().isDenied) {
        return BackupResult.error('Storage permission required for backup');
      }
      
      // Get documents directory
      final directory = await getApplicationDocumentsDirectory();
      final fileName = 'recipe_backup_${DateTime.now().toIso8601String().split('T')[0]}.json';
      final file = File('${directory.path}/$fileName');
      
      // Write backup file
      await file.writeAsString(jsonContent);
      
      // Share the file
      await Share.shareXFiles(
        [XFile(file.path)],
        text: 'Recipe Archive Backup - ${DateTime.now().toIso8601String().split('T')[0]}',
      );
      
      return BackupResult.success(
        message: 'Backup created and ready to share',
        filePath: file.path,
      );
    } catch (e) {
      return BackupResult.error('Failed to create mobile backup: $e');
    }
  }
}

/// Result of backup operation
class BackupResult {
  final bool success;
  final String message;
  final String? filePath;
  final String? content;
  
  const BackupResult._({
    required this.success,
    required this.message,
    this.filePath,
    this.content,
  });
  
  factory BackupResult.success({
    required String message,
    String? filePath,
    String? content,
  }) => BackupResult._(
    success: true,
    message: message,
    filePath: filePath,
    content: content,
  );
  
  factory BackupResult.error(String message) => BackupResult._(
    success: false,
    message: message,
  );
}

/// Result of restore operation
class RestoreResult {
  final bool success;
  final String message;
  final int imported;
  final int updated;
  final int skipped;
  final int deduplicated;
  final List<String> errors;
  
  const RestoreResult._({
    required this.success,
    required this.message,
    this.imported = 0,
    this.updated = 0,
    this.skipped = 0,
    this.deduplicated = 0,
    this.errors = const [],
  });
  
  factory RestoreResult.success({
    required int imported,
    required int updated,
    required int skipped,
    required List<String> errors,
    int deduplicated = 0,
  }) => RestoreResult._(
    success: true,
    message: 'Import completed: $imported new, $updated updated, $skipped skipped${deduplicated > 0 ? ', $deduplicated deduplicated' : ''}',
    imported: imported,
    updated: updated,
    skipped: skipped,
    deduplicated: deduplicated,
    errors: errors,
  );
  
  factory RestoreResult.error(String message) => RestoreResult._(
    success: false,
    message: message,
  );
}

/// Backup data validation result
class BackupValidation {
  final bool isValid;
  final String? error;
  
  const BackupValidation._(this.isValid, this.error);
  
  factory BackupValidation.valid() => const BackupValidation._(true, null);
  factory BackupValidation.invalid(String error) => BackupValidation._(false, error);
}