// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recipe.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RecipeIngredient _$RecipeIngredientFromJson(Map<String, dynamic> json) =>
    RecipeIngredient(text: json['text'] as String);

Map<String, dynamic> _$RecipeIngredientToJson(RecipeIngredient instance) =>
    <String, dynamic>{'text': instance.text};

RecipeInstruction _$RecipeInstructionFromJson(Map<String, dynamic> json) =>
    RecipeInstruction(
      stepNumber: (json['stepNumber'] as num).toInt(),
      text: json['text'] as String,
    );

Map<String, dynamic> _$RecipeInstructionToJson(RecipeInstruction instance) =>
    <String, dynamic>{'stepNumber': instance.stepNumber, 'text': instance.text};

Recipe _$RecipeFromJson(Map<String, dynamic> json) => Recipe(
  id: json['id'] as String,
  userId: json['userId'] as String?,
  title: json['title'] as String,
  description: json['description'] as String?,
  imageUrl: json['mainPhotoUrl'] as String?,
  sourceUrl: json['source'] as String?,
  sourceName: json['sourceName'] as String?,
  difficulty: json['difficulty'] as String?,
  prepTime: (json['prepTime'] as num?)?.toInt(),
  ingredients:
      (json['ingredients'] as List<dynamic>?)
          ?.map((e) => RecipeIngredient.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  instructions:
      (json['instructions'] as List<dynamic>?)
          ?.map((e) => RecipeInstruction.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  cookingTime: (json['totalTimeMinutes'] as num?)?.toInt(),
  servings: (json['servings'] as num?)?.toInt(),
  cuisine: json['cuisine'] as String?,
  tags:
      (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  personalNotes: json['personalNotes'] as String?,
  personalRating: (json['personalRating'] as num?)?.toDouble(),
  cookingNotes: json['cookingNotes'] as String?,
  categories:
      (json['categories'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList() ??
      const [],
  isFavorite: json['isFavorite'] as bool? ?? false,
  personalYield: (json['personalYield'] as num?)?.toInt(),
  hasUserModifications: json['hasUserModifications'] as bool? ?? false,
  originalData: json['originalData'] as Map<String, dynamic>?,
  createdAt: json['dateCreated'] == null
      ? null
      : DateTime.parse(json['dateCreated'] as String),
  updatedAt: json['dateModified'] == null
      ? null
      : DateTime.parse(json['dateModified'] as String),
);

Map<String, dynamic> _$RecipeToJson(Recipe instance) => <String, dynamic>{
  'id': instance.id,
  'userId': instance.userId,
  'title': instance.title,
  'description': instance.description,
  'mainPhotoUrl': instance.imageUrl,
  'source': instance.sourceUrl,
  'sourceName': instance.sourceName,
  'difficulty': instance.difficulty,
  'prepTime': instance.prepTime,
  'ingredients': instance.ingredients,
  'instructions': instance.instructions,
  'totalTimeMinutes': instance.cookingTime,
  'servings': instance.servings,
  'cuisine': instance.cuisine,
  'tags': instance.tags,
  'personalNotes': instance.personalNotes,
  'personalRating': instance.personalRating,
  'cookingNotes': instance.cookingNotes,
  'categories': instance.categories,
  'isFavorite': instance.isFavorite,
  'personalYield': instance.personalYield,
  'hasUserModifications': instance.hasUserModifications,
  'originalData': instance.originalData,
  'dateCreated': instance.createdAt?.toIso8601String(),
  'dateModified': instance.updatedAt?.toIso8601String(),
};
