import 'package:json_annotation/json_annotation.dart';

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
    
    String scaledText = text;
    
    // Common patterns to match and scale
    final patterns = [
      // Fractions: 1/2, 3/4, 1/3, etc.
      RegExp(r'(\d+)\/(\d+)'),
      // Decimals: 1.5, 0.25, etc.
      RegExp(r'(\d+\.?\d*)'),
      // Whole numbers at start: 2 cups, 3 tbsp
      RegExp(r'^(\d+)\s'),
    ];
    
    for (final pattern in patterns) {
      scaledText = scaledText.replaceAllMapped(pattern, (match) {
        try {
          double amount;
          if (pattern.pattern.contains('\\/')) {
            // Handle fractions
            final numerator = double.parse(match.group(1)!);
            final denominator = double.parse(match.group(2)!);
            amount = numerator / denominator;
          } else {
            // Handle decimals and whole numbers
            amount = double.parse(match.group(1)!);
          }
          
          final scaledAmount = amount * ratio;
          
          // Format the scaled amount nicely
          if (scaledAmount == scaledAmount.round()) {
            return '${scaledAmount.round()}';
          } else if (scaledAmount < 1) {
            // Convert to fraction for small amounts
            return _formatAsFraction(scaledAmount);
          } else {
            return scaledAmount.toStringAsFixed(1).replaceAll('.0', '');
          }
        } catch (e) {
          return match.group(0)!; // Return original if parsing fails
        }
      });
      
      // Only apply the first matching pattern
      if (scaledText != text) break;
    }
    
    return RecipeIngredient(text: scaledText);
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

  String get displayServings => servings != null ? '$servings servings' : 'Unknown';
  
  // Get scaled ingredients for a different number of servings
  List<RecipeIngredient> getScaledIngredients(int newServings) {
    if (servings == null || newServings == servings) {
      return ingredients;
    }
    
    final ratio = newServings / servings!;
    return ingredients.map((ingredient) => ingredient.scaleForServings(ratio)).toList();
  }
}
