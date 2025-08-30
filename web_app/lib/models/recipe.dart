import 'package:json_annotation/json_annotation.dart';

part 'recipe.g.dart';

@JsonSerializable()
class RecipeIngredient {
  final String text;
  
  const RecipeIngredient({required this.text});
  
  factory RecipeIngredient.fromJson(Map<String, dynamic> json) => _$RecipeIngredientFromJson(json);
  Map<String, dynamic> toJson() => _$RecipeIngredientToJson(this);
  
  // Add toString method for easier comparison and display
  @override
  String toString() => text;
  
  // Add toLowerCase method for search functionality
  String toLowerCase() => text.toLowerCase();
}

@JsonSerializable()
class RecipeInstruction {
  final int stepNumber;
  final String text;
  
  const RecipeInstruction({required this.stepNumber, required this.text});
  
  factory RecipeInstruction.fromJson(Map<String, dynamic> json) => _$RecipeInstructionFromJson(json);
  Map<String, dynamic> toJson() => _$RecipeInstructionToJson(this);
  
  // Add toString method for easier display
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
  final int? prepTimeMinutes;
  
  final int? cookTimeMinutes;
  final int? servings;
  final String? cuisine;
  final List<String>? tags;
  final String sourceUrl;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool? isDeleted;
  final int? version;
  
  // Nutrition info (optional)
  final int? calories;
  final double? protein;
  final double? carbs;
  final double? fat;
  
  // User metadata
  final bool? isFavorite;
  final int? userRating; // 1-5 stars
  final String? userNotes;

  const Recipe({
    required this.id,
    this.userId,
    required this.title,
    this.description,
    this.imageUrl,
    required this.ingredients,
    required this.instructions,
    this.prepTimeMinutes,
    this.cookTimeMinutes,
    this.servings,
    this.cuisine,
    this.tags,
    required this.sourceUrl,
    required this.createdAt,
    required this.updatedAt,
    this.isDeleted,
    this.version,
    this.calories,
    this.protein,
    this.carbs,
    this.fat,
    this.isFavorite,
    this.userRating,
    this.userNotes,
  });

  factory Recipe.fromJson(Map<String, dynamic> json) => _$RecipeFromJson(json);
  Map<String, dynamic> toJson() => _$RecipeToJson(this);

  // Convenience getters for ingredients and instructions as strings
  List<String> get ingredientTexts => ingredients.map((i) => i.text).toList();
  List<String> get instructionTexts => instructions.map((i) => i.text).toList();
  
  // Safe getters for nullable fields
  bool get isFavoriteOrFalse => isFavorite ?? false;
  List<String> get tagsOrEmpty => tags ?? [];
  
  // Convenience getters
  int get totalTimeMinutes => prepTimeMinutes ?? 0;
  
  String get formattedTime {
    if (totalTimeMinutes == 0) return 'Time not specified';
    if (totalTimeMinutes < 60) return '${totalTimeMinutes}m';
    
    final hours = totalTimeMinutes ~/ 60;
    final minutes = totalTimeMinutes % 60;
    
    if (minutes == 0) return '${hours}h';
    return '${hours}h ${minutes}m';
  }
  
  String get formattedServings {
    if (servings == null) return 'Servings not specified';
    return '$servings serving${servings! > 1 ? 's' : ''}';
  }

  // Copy with method for immutable updates
  Recipe copyWith({
    String? id,
    String? userId,
    String? title,
    String? description,
    String? imageUrl,
    List<RecipeIngredient>? ingredients,
    List<RecipeInstruction>? instructions,
    int? prepTimeMinutes,
    int? cookTimeMinutes,
    int? servings,
    String? cuisine,
    List<String>? tags,
    String? sourceUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isDeleted,
    int? version,
    int? calories,
    double? protein,
    double? carbs,
    double? fat,
    bool? isFavorite,
    int? userRating,
    String? userNotes,
  }) {
    return Recipe(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      title: title ?? this.title,
      description: description ?? this.description,
      imageUrl: imageUrl ?? this.imageUrl,
      ingredients: ingredients ?? this.ingredients,
      instructions: instructions ?? this.instructions,
      prepTimeMinutes: prepTimeMinutes ?? this.prepTimeMinutes,
      cookTimeMinutes: cookTimeMinutes ?? this.cookTimeMinutes,
      servings: servings ?? this.servings,
      cuisine: cuisine ?? this.cuisine,
      tags: tags ?? this.tags,
      sourceUrl: sourceUrl ?? this.sourceUrl,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isDeleted: isDeleted ?? this.isDeleted,
      version: version ?? this.version,
      calories: calories ?? this.calories,
      protein: protein ?? this.protein,
      carbs: carbs ?? this.carbs,
      fat: fat ?? this.fat,
      isFavorite: isFavorite ?? this.isFavorite,
      userRating: userRating ?? this.userRating,
      userNotes: userNotes ?? this.userNotes,
    );
  }
}
