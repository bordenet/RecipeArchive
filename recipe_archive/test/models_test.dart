import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:recipe_archive/models/recipe.dart';

void main() {
  group('Recipe Model Tests', () {
    test('Recipe should serialize to and from JSON', () {
      final recipe = Recipe(
        id: 'test-1',
        title: 'Test Recipe',
        description: 'A test recipe',
        ingredients: [
          const RecipeIngredient(text: '1 cup flour'),
          const RecipeIngredient(text: '2 eggs'),
        ],
        instructions: [
          const RecipeInstruction(stepNumber: 1, text: 'Mix ingredients'),
          const RecipeInstruction(stepNumber: 2, text: 'Bake for 30 minutes'),
        ],
        prepTime: 15,
        cookingTime: 30,
        servings: 4,
        difficulty: 'Easy',
        cuisine: 'American',
        tags: ['dessert', 'baking'],
        imageUrl: 'https://example.com/image.jpg',
        sourceUrl: 'https://example.com/recipe',
        sourceName: 'Test Source',
      );

      // Test JSON serialization
      final json = recipe.toJson();
      expect(json['id'], 'test-1');
      expect(json['title'], 'Test Recipe');
      expect(json['servings'], 4);

      // Convert JSON through string to simulate real serialization/deserialization
      final jsonString = jsonEncode(json);
      final parsedJson = jsonDecode(jsonString) as Map<String, dynamic>;
      
      // Test JSON deserialization
      final recreatedRecipe = Recipe.fromJson(parsedJson);
      expect(recreatedRecipe.id, recipe.id);
      expect(recreatedRecipe.title, recipe.title);
      expect(recreatedRecipe.servings, recipe.servings);
      expect(recreatedRecipe.ingredients.length, 2);
      expect(recreatedRecipe.instructions.length, 2);
    });

    test('Recipe should handle null values correctly', () {
      final recipe = Recipe(
        id: 'test-2',
        title: 'Minimal Recipe',
        description: null,
        ingredients: [],
        instructions: [],
        prepTime: null,
        cookingTime: null,
        servings: 1,
        difficulty: null,
        cuisine: null,
        tags: [],
        imageUrl: null,
        sourceUrl: null,
        sourceName: null,
      );

      final json = recipe.toJson();
      final jsonString = jsonEncode(json);
      final parsedJson = jsonDecode(jsonString) as Map<String, dynamic>;
      final recreatedRecipe = Recipe.fromJson(parsedJson);
      
      expect(recreatedRecipe.id, 'test-2');
      expect(recreatedRecipe.title, 'Minimal Recipe');
      expect(recreatedRecipe.description, isNull);
      expect(recreatedRecipe.imageUrl, isNull);
    });

    test('RecipeIngredient should handle text properly', () {
      const ingredient = RecipeIngredient(text: '2 cups sugar');
      
      expect(ingredient.text, '2 cups sugar');
      expect(ingredient.toString(), '2 cups sugar');

      final json = ingredient.toJson();
      final recreated = RecipeIngredient.fromJson(json);
      expect(recreated.text, ingredient.text);
    });

    test('RecipeInstruction should handle step number and text', () {
      const instruction = RecipeInstruction(
        stepNumber: 3, 
        text: 'Preheat oven to 350°F'
      );

      expect(instruction.stepNumber, 3);
      expect(instruction.text, 'Preheat oven to 350°F');
      expect(instruction.toString(), 'Preheat oven to 350°F');

      final json = instruction.toJson();
      final recreated = RecipeInstruction.fromJson(json);
      expect(recreated.stepNumber, instruction.stepNumber);
      expect(recreated.text, instruction.text);
    });
  });
}