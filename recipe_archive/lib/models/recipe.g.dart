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

CookingMethod _$CookingMethodFromJson(Map<String, dynamic> json) =>
    CookingMethod(
      name: json['name'] as String,
      instructions: (json['instructions'] as List<dynamic>)
          .map((e) => RecipeInstruction.fromJson(e as Map<String, dynamic>))
          .toList(),
      timeEstimate: json['timeEstimate'] as String?,
      equipment: (json['equipment'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
    );

Map<String, dynamic> _$CookingMethodToJson(CookingMethod instance) =>
    <String, dynamic>{
      'name': instance.name,
      'instructions': instance.instructions,
      'timeEstimate': instance.timeEstimate,
      'equipment': instance.equipment,
    };

Recipe _$RecipeFromJson(Map<String, dynamic> json) => Recipe(
      id: json['id'] as String,
      userId: json['userId'] as String?,
      title: json['title'] as String,
      description: json['description'] as String?,
      imageUrl: json['mainPhotoUrl'] as String?,
      sourceUrl: json['sourceUrl'] as String?,
      sourceName: json['sourceName'] as String?,
      difficulty: json['difficulty'] as String?,
      prepTime: Recipe._parseTime(json['prepTimeMinutes']),
      cookTime: Recipe._parseTime(json['cookTimeMinutes']),
      ingredients: (json['ingredients'] as List<dynamic>?)
              ?.map((e) => RecipeIngredient.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      instructions: (json['instructions'] as List<dynamic>?)
              ?.map(
                  (e) => RecipeInstruction.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      cookingMethodOptions: (json['cookingMethods'] as List<dynamic>?)
              ?.map((e) => CookingMethod.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      cookingTime: Recipe._parseTime(json['totalTimeMinutes']),
      servings: Recipe._parseServings(json['servings']),
      cuisine: json['cuisine'] as String?,
      tags:
          (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
              const [],
      semanticTags: (json['semanticTags'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      primaryIngredients: (json['primaryIngredients'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      cookingMethodsTags: (json['cookingMethodsTags'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      dietaryTags: (json['dietaryTags'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      flavorProfile: (json['flavorProfile'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      equipment: (json['equipment'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      timeCategory: json['timeCategory'] as String?,
      complexity: json['complexity'] as String?,
      mealType: (json['mealType'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      personalNotes: json['personalNotes'] as String?,
      personalRating: (json['personalRating'] as num?)?.toDouble(),
      cookingNotes: json['cookingNotes'] as String?,
      categories: (json['categories'] as List<dynamic>?)
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
      'sourceUrl': instance.sourceUrl,
      'sourceName': instance.sourceName,
      'difficulty': instance.difficulty,
      'prepTimeMinutes': instance.prepTime,
      'cookTimeMinutes': instance.cookTime,
      'ingredients': instance.ingredients,
      'instructions': instance.instructions,
      'cookingMethods': instance.cookingMethodOptions,
      'totalTimeMinutes': instance.cookingTime,
      'servings': instance.servings,
      'cuisine': instance.cuisine,
      'tags': instance.tags,
      'semanticTags': instance.semanticTags,
      'primaryIngredients': instance.primaryIngredients,
      'cookingMethodsTags': instance.cookingMethodsTags,
      'dietaryTags': instance.dietaryTags,
      'flavorProfile': instance.flavorProfile,
      'equipment': instance.equipment,
      'timeCategory': instance.timeCategory,
      'complexity': instance.complexity,
      'mealType': instance.mealType,
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
