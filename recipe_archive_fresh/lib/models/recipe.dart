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
}
