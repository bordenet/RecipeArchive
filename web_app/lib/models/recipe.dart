import 'package:json_annotation/json_annotation.dart';

part 'recipe.g.dart';

@JsonSerializable()
class Recipe {
  final String id;
  final String title;
  final String? description;
  final String? imageUrl;
  final List<String> ingredients;
  final List<String> instructions;
  final int? prepTimeMinutes;
  final int? cookTimeMinutes;
  final int? servings;
  final String? cuisine;
  final List<String> tags;
  final String sourceUrl;
  final DateTime createdAt;
  final DateTime updatedAt;
  
  // Nutrition info (optional)
  final int? calories;
  final double? protein;
  final double? carbs;
  final double? fat;
  
  // User metadata
  final bool isFavorite;
  final int? userRating; // 1-5 stars
  final String? userNotes;

  const Recipe({
    required this.id,
    required this.title,
    this.description,
    this.imageUrl,
    required this.ingredients,
    required this.instructions,
    this.prepTimeMinutes,
    this.cookTimeMinutes,
    this.servings,
    this.cuisine,
    this.tags = const [],
    required this.sourceUrl,
    required this.createdAt,
    required this.updatedAt,
    this.calories,
    this.protein,
    this.carbs,
    this.fat,
    this.isFavorite = false,
    this.userRating,
    this.userNotes,
  });

  factory Recipe.fromJson(Map<String, dynamic> json) => _$RecipeFromJson(json);
  Map<String, dynamic> toJson() => _$RecipeToJson(this);

  // Convenience getters
  int get totalTimeMinutes => (prepTimeMinutes ?? 0) + (cookTimeMinutes ?? 0);
  
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
    String? title,
    String? description,
    String? imageUrl,
    List<String>? ingredients,
    List<String>? instructions,
    int? prepTimeMinutes,
    int? cookTimeMinutes,
    int? servings,
    String? cuisine,
    List<String>? tags,
    String? sourceUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
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
