// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recipe.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RecipeIngredient _$RecipeIngredientFromJson(Map<String, dynamic> json) =>
    RecipeIngredient(
      text: json['text'] as String,
    );

Map<String, dynamic> _$RecipeIngredientToJson(RecipeIngredient instance) =>
    <String, dynamic>{
      'text': instance.text,
    };

RecipeInstruction _$RecipeInstructionFromJson(Map<String, dynamic> json) =>
    RecipeInstruction(
      stepNumber: (json['stepNumber'] as num).toInt(),
      text: json['text'] as String,
    );

Map<String, dynamic> _$RecipeInstructionToJson(RecipeInstruction instance) =>
    <String, dynamic>{
      'stepNumber': instance.stepNumber,
      'text': instance.text,
    };

Recipe _$RecipeFromJson(Map<String, dynamic> json) => Recipe(
      id: json['id'] as String,
      userId: json['userId'] as String?,
      title: json['title'] as String,
      description: json['description'] as String?,
      imageUrl: json['mainPhotoUrl'] as String?,
      ingredients: (json['ingredients'] as List<dynamic>)
          .map((e) => RecipeIngredient.fromJson(e as Map<String, dynamic>))
          .toList(),
      instructions: (json['instructions'] as List<dynamic>)
          .map((e) => RecipeInstruction.fromJson(e as Map<String, dynamic>))
          .toList(),
      prepTimeMinutes: (json['totalTimeMinutes'] as num?)?.toInt(),
      cookTimeMinutes: (json['cookTimeMinutes'] as num?)?.toInt(),
      servings: (json['servings'] as num?)?.toInt(),
      cuisine: json['cuisine'] as String?,
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList(),
      sourceUrl: json['sourceUrl'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      isDeleted: json['isDeleted'] as bool?,
      version: (json['version'] as num?)?.toInt(),
      calories: (json['calories'] as num?)?.toInt(),
      protein: (json['protein'] as num?)?.toDouble(),
      carbs: (json['carbs'] as num?)?.toDouble(),
      fat: (json['fat'] as num?)?.toDouble(),
      isFavorite: json['isFavorite'] as bool?,
      userRating: (json['userRating'] as num?)?.toInt(),
      userNotes: json['userNotes'] as String?,
    );

Map<String, dynamic> _$RecipeToJson(Recipe instance) => <String, dynamic>{
      'id': instance.id,
      'userId': instance.userId,
      'title': instance.title,
      'description': instance.description,
      'mainPhotoUrl': instance.imageUrl,
      'ingredients': instance.ingredients,
      'instructions': instance.instructions,
      'totalTimeMinutes': instance.prepTimeMinutes,
      'cookTimeMinutes': instance.cookTimeMinutes,
      'servings': instance.servings,
      'cuisine': instance.cuisine,
      'tags': instance.tags,
      'sourceUrl': instance.sourceUrl,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'isDeleted': instance.isDeleted,
      'version': instance.version,
      'calories': instance.calories,
      'protein': instance.protein,
      'carbs': instance.carbs,
      'fat': instance.fat,
      'isFavorite': instance.isFavorite,
      'userRating': instance.userRating,
      'userNotes': instance.userNotes,
    };
