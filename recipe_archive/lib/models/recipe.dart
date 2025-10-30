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
    
    // Improved regex that handles multiple cases:
    // 1. Numbers at beginning: "6 hard-boiled eggs" -> captures "6" and "hard-boiled eggs"
    // 2. Mixed fractions at beginning: "1 1/2 cups flour" -> captures "1 1/2" and "cups flour"
    // 3. Numbers embedded with clear word boundaries: "flesh of 1 ripe avocado" -> captures "flesh of ", "1", and " ripe avocado"
    final regex = RegExp(r'^(\d+(?:\s+\d+/\d+)?|\d+\.\d+|\d+/\d+)\s+(.+)|^(.+\s)(\d+(?:\.\d+|/\d+)?)(?=\s)(.+)$', multiLine: false);
    
    scaledText = scaledText.replaceAllMapped(regex, (match) {
      try {
        // Case 1: Number at beginning (groups 1 and 2)
        if (match.group(1) != null && match.group(2) != null) {
          final amountStr = match.group(1)!.trim();
          final restOfIngredient = match.group(2)!.trim();
          
          final amount = _parseScalingAmount(amountStr);
          if (amount != null) {
            final scaledAmount = amount * ratio;
            final formattedAmount = _formatScaledAmount(scaledAmount);
            return '$formattedAmount $restOfIngredient';
          }
        }
        // Case 2: Number embedded with word boundaries (groups 3, 4, and 5)
        else if (match.group(3) != null && match.group(4) != null && match.group(5) != null) {
          final prefix = match.group(3)!; // Already includes trailing space
          final amountStr = match.group(4)!.trim();
          final suffix = match.group(5)!; // Already includes leading space
          
          final amount = _parseScalingAmount(amountStr);
          if (amount != null) {
            final scaledAmount = amount * ratio;
            final formattedAmount = _formatScaledAmount(scaledAmount);
            return '$prefix$formattedAmount$suffix';
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
class CookingMethod {
  final String name;
  final List<RecipeInstruction> instructions;
  final String? timeEstimate;
  final List<String> equipment;

  const CookingMethod({
    required this.name,
    required this.instructions,
    this.timeEstimate,
    this.equipment = const [],
  });

  factory CookingMethod.fromJson(Map<String, dynamic> json) => _$CookingMethodFromJson(json);
  Map<String, dynamic> toJson() => _$CookingMethodToJson(this);
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
  
  @JsonKey(name: 'prepTimeMinutes', fromJson: _parseTime)
  final int? prepTime;
  
  @JsonKey(name: 'cookTimeMinutes', fromJson: _parseTime)
  final int? cookTime;
  
  final List<RecipeIngredient> ingredients;
  final List<RecipeInstruction> instructions;

  // Multiple cooking methods (e.g., stovetop vs slow cooker options)
  @JsonKey(name: 'cookingMethods')
  final List<CookingMethod> cookingMethodOptions;

  @JsonKey(name: 'totalTimeMinutes', fromJson: _parseTime)
  final int? cookingTime;
  
  @JsonKey(fromJson: _parseServings)
  final int? servings;
  final String? cuisine;
  final List<String> tags;
  
  // Search metadata fields
  final List<String> semanticTags;
  final List<String> primaryIngredients;
  final List<String> cookingMethodsTags; // Cooking method tags for search
  final List<String> dietaryTags;
  final List<String> flavorProfile;
  final List<String> equipment;
  final String? timeCategory;
  final String? complexity;
  final List<String> mealType;
  
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
    this.cookTime,
    this.ingredients = const [],
    this.instructions = const [],
    this.cookingMethodOptions = const [],
    this.cookingTime,
    this.servings,
    this.cuisine,
    this.tags = const [],
    this.semanticTags = const [],
    this.primaryIngredients = const [],
    this.cookingMethodsTags = const [],
    this.dietaryTags = const [],
    this.flavorProfile = const [],
    this.equipment = const [],
    this.timeCategory,
    this.complexity,
    this.mealType = const [],
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

  factory Recipe.fromJson(Map<String, dynamic> json) {
    // Add robust handling for potentially null required fields
    if (json['id'] == null) {
      throw Exception('Recipe JSON from API is missing required "id" field.');
    }
    if (json['title'] == null) {
      json['title'] = 'Untitled Recipe'; // Prevent crash if title is null
    }

    // Handle nested searchMetadata structure from background normalizer
    Map<String, dynamic> processedJson = Map<String, dynamic>.from(json);
    
    // Extract search metadata from nested object if present
    if (json['searchMetadata'] is Map<String, dynamic>) {
      final searchMetadata = json['searchMetadata'] as Map<String, dynamic>;
      
      // Move nested fields to top level for Flutter model compatibility
      processedJson['semanticTags'] = searchMetadata['semanticTags'] ?? <String>[];
      processedJson['primaryIngredients'] = searchMetadata['primaryIngredients'] ?? <String>[];
      processedJson['cookingMethodsTags'] = searchMetadata['cookingMethods'] ?? <String>[];
      processedJson['dietaryTags'] = searchMetadata['dietaryTags'] ?? <String>[];
      processedJson['flavorProfile'] = searchMetadata['flavorProfile'] ?? <String>[];
      processedJson['equipment'] = searchMetadata['equipment'] ?? <String>[];
      processedJson['timeCategory'] = searchMetadata['timeCategory'];
      processedJson['complexity'] = searchMetadata['complexity'];
      // Handle mealType conversion from string to List<String> for Flutter compatibility
      var mealTypeValue = searchMetadata['mealType'];
      if (mealTypeValue is String) {
        processedJson['mealType'] = [mealTypeValue];
      } else if (mealTypeValue is List) {
        processedJson['mealType'] = List<String>.from(mealTypeValue);
      } else {
        processedJson['mealType'] = <String>[];
      }
      
      // Remove the nested object
      processedJson.remove('searchMetadata');
    }
    
    // Handle field name inconsistencies between Go backend and Flutter
    if (json['prepTime'] != null && json['prepTimeMinutes'] == null) {
      processedJson['prepTimeMinutes'] = json['prepTime'];
    }
    if (json['cookTime'] != null && json['cookTimeMinutes'] == null) {
      processedJson['cookTimeMinutes'] = json['cookTime'];
    }

    // Handle image field backward compatibility and validation
    // Priority: mainPhotoUrl > imageUrl > image (for legacy recipes)
    String? imageValue;
    if (json['mainPhotoUrl'] != null && json['mainPhotoUrl'].toString().trim().isNotEmpty) {
      imageValue = json['mainPhotoUrl'].toString().trim();
    } else if (json['imageUrl'] != null && json['imageUrl'].toString().trim().isNotEmpty) {
      imageValue = json['imageUrl'].toString().trim();
    } else if (json['image'] != null && json['image'].toString().trim().isNotEmpty) {
      imageValue = json['image'].toString().trim();
    }

    // Only set image if it's a valid S3 URL (security check)
    if (imageValue != null) {
      try {
        final uri = Uri.parse(imageValue);
        final isValidS3 = uri.scheme == 'https' &&
                         (uri.host.endsWith('.s3.amazonaws.com') ||
                          uri.host.endsWith('.s3.us-west-2.amazonaws.com') ||
                          (uri.host == 's3.amazonaws.com' && uri.path.isNotEmpty));

        if (isValidS3) {
          processedJson['mainPhotoUrl'] = imageValue;
        } else {
          // Invalid image URL filtered: $imageValue
          processedJson['mainPhotoUrl'] = null;
        }
      } catch (e) {
        // Failed to parse image URL: $imageValue, error: $e
        processedJson['mainPhotoUrl'] = null;
      }
    }
    
    return _$RecipeFromJson(processedJson);
  }

  // Helper function to parse servings from various formats
  static int? _parseServings(dynamic servingsValue) {
    if (servingsValue is int) {
      return servingsValue;
    } else if (servingsValue is String && servingsValue.isNotEmpty) {
      // Extract number from strings like "4 servings", "Serves 6", etc.
      final match = RegExp(r'(\d+)').firstMatch(servingsValue);
      if (match != null) {
        return int.tryParse(match.group(1)!);
      }
    }
    return null;
  }
  
  // Helper function to parse time from various formats (string or int)
  static int? _parseTime(dynamic timeValue) {
    if (timeValue is int) {
      return timeValue;
    } else if (timeValue is String && timeValue.isNotEmpty) {
      // Handle ISO 8601 duration format like "PT25M"
      final iso8601Match = RegExp(r'^PT(\d+)M$').firstMatch(timeValue);
      if (iso8601Match != null) {
        return int.tryParse(iso8601Match.group(1)!);
      }
      // Handle ISO 8601 format with hours like "PT1H30M"
      final iso8601WithHours = RegExp(r'^PT(?:(\d+)H)?(?:(\d+)M)?$').firstMatch(timeValue);
      if (iso8601WithHours != null) {
        final hours = int.tryParse(iso8601WithHours.group(1) ?? '0') ?? 0;
        final minutes = int.tryParse(iso8601WithHours.group(2) ?? '0') ?? 0;
        return hours * 60 + minutes;
      }
      // Parse string numbers like "45" or "30"
      return int.tryParse(timeValue);
    }
    return null;
  }
  Map<String, dynamic> toJson() => _$RecipeToJson(this);

  // Helper methods
  String get displayTime {
    // Check if this is a drink recipe to use "mix" instead of "cook"
    final isDrink = mealType.contains('drink');
    final cookLabel = isDrink ? 'mix' : 'cook';
    
    // Try to use individual prep/cook times if available
    if (prepTime != null && cookTime != null) {
      final prepDisplay = _formatTime(prepTime!);
      final cookDisplay = _formatTime(cookTime!);
      return '$prepDisplay prep, $cookDisplay $cookLabel';
    }
    
    // Fall back to total cooking time
    if (cookingTime != null) {
      return _formatTime(cookingTime!);
    }
    
    // Last resort - check individual times
    if (prepTime != null) {
      return '${_formatTime(prepTime!)} prep';
    }
    if (cookTime != null) {
      return '${_formatTime(cookTime!)} $cookLabel';
    }
    
    return 'Unknown';
  }
  
  String _formatTime(int minutes) {
    if (minutes < 60) return '${minutes}m';
    final hours = minutes ~/ 60;
    final remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? '${hours}h ${remainingMinutes}m' : '${hours}h';
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
    // If original servings is null or 0, assume 4 servings as default
    final originalServings = servings ?? 4;
    if (newServings == originalServings) {
      return ingredients;
    }
    
    final ratio = newServings / originalServings;
    return ingredients.map((ingredient) => ingredient.scaleForServings(ratio)).toList();
  }
  
  // Helper method to create an edited copy of the recipe
  Recipe copyWith({
    String? title,
    String? description,
    String? imageUrl,
    String? difficulty,
    int? prepTime,
    int? cookTime,
    List<RecipeIngredient>? ingredients,
    List<RecipeInstruction>? instructions,
    List<CookingMethod>? cookingMethodOptions,
    int? cookingTime,
    int? servings,
    String? cuisine,
    List<String>? tags,
    List<String>? semanticTags,
    List<String>? primaryIngredients,
    List<String>? cookingMethodsTags,
    List<String>? dietaryTags,
    List<String>? flavorProfile,
    List<String>? equipment,
    String? timeCategory,
    String? complexity,
    List<String>? mealType,
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
      cookTime: cookTime ?? this.cookTime,
      ingredients: ingredients ?? this.ingredients,
      instructions: instructions ?? this.instructions,
      cookingMethodOptions: cookingMethodOptions ?? this.cookingMethodOptions,
      cookingTime: cookingTime ?? this.cookingTime,
      servings: servings ?? this.servings,
      cuisine: cuisine ?? this.cuisine,
      tags: tags ?? this.tags,
      semanticTags: semanticTags ?? this.semanticTags,
      primaryIngredients: primaryIngredients ?? this.primaryIngredients,
      cookingMethodsTags: cookingMethodsTags ?? this.cookingMethodsTags,
      dietaryTags: dietaryTags ?? this.dietaryTags,
      flavorProfile: flavorProfile ?? this.flavorProfile,
      equipment: equipment ?? this.equipment,
      timeCategory: timeCategory ?? this.timeCategory,
      complexity: complexity ?? this.complexity,
      mealType: mealType ?? this.mealType,
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
