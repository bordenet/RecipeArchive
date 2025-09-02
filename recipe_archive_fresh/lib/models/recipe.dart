import 'package:json_annotation/json_annotation.dart';
import '../utils/html_utils.dart';

part 'recipe.g.dart';

@JsonSerializable()
class RecipeIngredient {
  final String text;
  
  const RecipeIngredient({required this.text});
  
  factory RecipeIngredient.fromJson(Map<String, dynamic> json) => _$RecipeIngredientFromJson(json);
  Map<String, dynamic> toJson() => _$RecipeIngredientToJson(this);
  
  @override
  String toString() => text;
  
  // Scale ingredient amounts based on serving ratio
  RecipeIngredient scaleForServings(double ratio) {
    if (ratio == 1.0) return this;
    
    // Don't scale section headers (they start with ##)
    if (text.startsWith('## ')) {
      return this;
    }
    
    String scaledText = text;
    
    // Enhanced regex to handle mixed fractions (1 3/4), simple fractions (3/4), and decimals
    final regex = RegExp(r'(\d+(?:\s+\d+/\d+|\.\d+|/\d+)?)\s*([a-zA-Z][a-zA-Z\s]*(?:[a-zA-Z]|(?=\s*\()|(?=\s*,)|$))');
    
    scaledText = scaledText.replaceAllMapped(regex, (match) {
      try {
        final amountStr = match.group(1)?.trim();
        final unit = match.group(2)?.trim();
        
        if (amountStr != null && unit != null) {
          final amount = _parseScalingAmount(amountStr);
          if (amount != null) {
            final scaledAmount = amount * ratio;
            final formattedAmount = _formatScaledAmount(scaledAmount);
            return '$formattedAmount $unit';
          }
        }
        return match.group(0)!;
      } catch (e) {
        return match.group(0)!;
      }
    });
    
    return RecipeIngredient(text: scaledText);
  }
  
  // Parse amount string handling mixed fractions, simple fractions, and decimals
  double? _parseScalingAmount(String amountStr) {
    // Handle mixed fractions like "1 3/4"
    final mixedFractionMatch = RegExp(r'^(\d+)\s+(\d+)/(\d+)$').firstMatch(amountStr);
    if (mixedFractionMatch != null) {
      final whole = int.tryParse(mixedFractionMatch.group(1)!);
      final numerator = int.tryParse(mixedFractionMatch.group(2)!);
      final denominator = int.tryParse(mixedFractionMatch.group(3)!);
      if (whole != null && numerator != null && denominator != null && denominator != 0) {
        return whole + (numerator / denominator);
      }
    }
    
    // Handle simple fractions like "3/4"
    final fractionMatch = RegExp(r'^(\d+)/(\d+)$').firstMatch(amountStr);
    if (fractionMatch != null) {
      final numerator = int.tryParse(fractionMatch.group(1)!);
      final denominator = int.tryParse(fractionMatch.group(2)!);
      if (numerator != null && denominator != null && denominator != 0) {
        return numerator / denominator;
      }
    }
    
    // Handle decimal numbers and whole numbers
    return double.tryParse(amountStr);
  }
  
  // Format scaled amount nicely for cooking measurements
  String _formatScaledAmount(double amount) {
    if (amount == amount.roundToDouble()) {
      return amount.round().toString();
    } else if (amount < 1) {
      // Convert to fraction for small amounts
      return _formatAsFraction(amount);
    } else {
      // For amounts > 1, show reasonable precision
      final rounded = (amount * 4).round() / 4; // Round to nearest quarter
      if (rounded == rounded.roundToDouble()) {
        return rounded.round().toString();
      } else {
        return rounded.toString().replaceAll(RegExp(r'\.?0*$'), '');
      }
    }
  }
  
  // Helper method to convert decimals to common fractions
  String _formatAsFraction(double decimal) {
    final commonFractions = {
      0.125: '1/8',
      0.25: '1/4',
      0.33: '1/3',
      0.5: '1/2',
      0.66: '2/3',
      0.75: '3/4',
    };
    
    for (final entry in commonFractions.entries) {
      if ((decimal - entry.key).abs() < 0.05) {
        return entry.value;
      }
    }
    
    // Fallback to decimal
    return decimal.toStringAsFixed(2).replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
  }
}

@JsonSerializable()
class RecipeInstruction {
  final int stepNumber;
  final String text;
  
  const RecipeInstruction({required this.stepNumber, required this.text});
  
  factory RecipeInstruction.fromJson(Map<String, dynamic> json) => _$RecipeInstructionFromJson(json);
  Map<String, dynamic> toJson() => _$RecipeInstructionToJson(this);
  
  @override
  String toString() => text;
}

@JsonSerializable()
class Recipe {
  final String id;
  final String? userId;
  final String title;
  final String? description;
  
  @JsonKey(name: 'mainPhotoUrl')
  final String? imageUrl;
  
  @JsonKey(name: 'sourceUrl')
  final String? sourceUrl;
  final String? sourceName;
  final String? difficulty;
  final int? prepTime;
  
  final List<RecipeIngredient> ingredients;
  final List<RecipeInstruction> instructions;
  
  @JsonKey(name: 'totalTimeMinutes')
  final int? cookingTime;
  
  final int? servings;
  final String? cuisine;
  final List<String> tags;
  
  // User feedback and notes
  final String? personalNotes;
  final double? personalRating; // 1-5 stars
  final String? cookingNotes;
  final List<String> categories; // User-defined categories
  final bool isFavorite;
  final int? personalYield; // User's preferred serving size
  
  // Modification tracking
  final bool hasUserModifications;
  final Map<String, dynamic>? originalData; // Store original recipe data
  
  @JsonKey(name: 'dateCreated')
  final DateTime? createdAt;
  
  @JsonKey(name: 'dateModified')
  final DateTime? updatedAt;

  const Recipe({
    required this.id,
    this.userId,
    required this.title,
    this.description,
    this.imageUrl,
    this.sourceUrl,
    this.sourceName,
    this.difficulty,
    this.prepTime,
    this.ingredients = const [],
    this.instructions = const [],
    this.cookingTime,
    this.servings,
    this.cuisine,
    this.tags = const [],
    this.personalNotes,
    this.personalRating,
    this.cookingNotes,
    this.categories = const [],
    this.isFavorite = false,
    this.personalYield,
    this.hasUserModifications = false,
    this.originalData,
    this.createdAt,
    this.updatedAt,
  });

  factory Recipe.fromJson(Map<String, dynamic> json) => _$RecipeFromJson(json);
  Map<String, dynamic> toJson() => _$RecipeToJson(this);

  // Helper methods
  String get displayTime {
    if (cookingTime == null) return 'Unknown';
    if (cookingTime! < 60) return '${cookingTime}m';
    final hours = cookingTime! ~/ 60;
    final minutes = cookingTime! % 60;
    return minutes > 0 ? '${hours}h ${minutes}m' : '${hours}h';
  }

  String get displayServings {
    if (servings == null || servings == 0) {
      return 'Unknown servings';
    }
    return servings == 1 ? '1 serving' : '$servings servings';
  }
  
  // HTML-decoded versions of text fields
  String get cleanTitle => cleanRecipeText(title);
  String get cleanDescription => cleanRecipeText(description);
  
  // Get scaled ingredients for a different number of servings
  List<RecipeIngredient> getScaledIngredients(int newServings) {
    if (servings == null || newServings == servings) {
      return ingredients;
    }
    
    final ratio = newServings / servings!;
    return ingredients.map((ingredient) => ingredient.scaleForServings(ratio)).toList();
  }
  
  // Helper method to create an edited copy of the recipe
  Recipe copyWith({
    String? title,
    String? description,
    String? imageUrl,
    String? difficulty,
    int? prepTime,
    List<RecipeIngredient>? ingredients,
    List<RecipeInstruction>? instructions,
    int? cookingTime,
    int? servings,
    String? cuisine,
    List<String>? tags,
    String? personalNotes,
    double? personalRating,
    String? cookingNotes,
    List<String>? categories,
    bool? isFavorite,
    int? personalYield,
    bool? hasUserModifications,
    DateTime? updatedAt,
  }) {
    return Recipe(
      id: id,
      userId: userId,
      title: title ?? this.title,
      description: description ?? this.description,
      imageUrl: imageUrl ?? this.imageUrl,
      sourceUrl: sourceUrl,
      sourceName: sourceName,
      difficulty: difficulty ?? this.difficulty,
      prepTime: prepTime ?? this.prepTime,
      ingredients: ingredients ?? this.ingredients,
      instructions: instructions ?? this.instructions,
      cookingTime: cookingTime ?? this.cookingTime,
      servings: servings ?? this.servings,
      cuisine: cuisine ?? this.cuisine,
      tags: tags ?? this.tags,
      personalNotes: personalNotes ?? this.personalNotes,
      personalRating: personalRating ?? this.personalRating,
      cookingNotes: cookingNotes ?? this.cookingNotes,
      categories: categories ?? this.categories,
      isFavorite: isFavorite ?? this.isFavorite,
      personalYield: personalYield ?? this.personalYield,
      hasUserModifications: hasUserModifications ?? true,
      originalData: originalData ?? toJson(),
      createdAt: createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
    );
  }
  
  // Get display-friendly website name from URL
  String get displaySourceName {
    // Use sourceName if available
    if (sourceName != null && sourceName!.isNotEmpty) {
      return sourceName!;
    }
    
    // Extract from sourceUrl if available
    if (sourceUrl != null && sourceUrl!.isNotEmpty) {
      try {
        final uri = Uri.parse(sourceUrl!);
        final host = uri.host.toLowerCase();
        
        // Map common domains to display names
        const domainMap = {
          'smittenkitchen.com': 'Smitten Kitchen',
          'food52.com': 'Food52',
          'foodnetwork.com': 'Food Network',
          'cooking.nytimes.com': 'NYT Cooking',
          'washingtonpost.com': 'Washington Post',
          'loveandlemons.com': 'Love and Lemons',
          'allrecipes.com': 'AllRecipes',
          'epicurious.com': 'Epicurious',
          'seriouseats.com': 'Serious Eats',
          'damndelicious.net': 'Damn Delicious',
          'foodandwine.com': 'Food & Wine',
          'alexandracooks.com': "Alexandra's Kitchen",
        };
        
        // Check for exact match
        if (domainMap.containsKey(host)) {
          return domainMap[host]!;
        }
        
        // Check for subdomain matches (e.g., www.example.com)
        for (final entry in domainMap.entries) {
          if (host.endsWith(entry.key)) {
            return entry.value;
          }
        }
        
        // Fallback: Clean up domain name
        String cleaned = host.replaceAll('www.', '');
        final parts = cleaned.split('.');
        if (parts.isNotEmpty) {
          final name = parts.first;
          // Capitalize first letter
          return name[0].toUpperCase() + name.substring(1);
        }
      } catch (e) {
        // URL parsing failed, continue to fallback
      }
    }
    
    return 'Unknown';
  }
  
  // Check if recipe has any user modifications
  bool get hasPersonalizations {
    return personalNotes != null || 
           personalRating != null || 
           cookingNotes != null || 
           categories.isNotEmpty || 
           isFavorite || 
           personalYield != null ||
           hasUserModifications;
  }
  
  // Get effective yield (user's preferred or original)
  int get effectiveYield => personalYield ?? servings ?? 1;
}
