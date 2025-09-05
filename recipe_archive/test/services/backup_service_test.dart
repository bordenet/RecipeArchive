import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import '../../lib/services/backup_service.dart';
import '../../lib/services/recipe_service.dart';
import '../../lib/models/recipe.dart';

// Generate mock classes
@GenerateMocks([RecipeService])
import 'backup_service_test.mocks.dart';

void main() {
  group('BackupService Tests', () {
    late BackupService backupService;
    late MockRecipeService mockRecipeService;

    setUp(() {
      mockRecipeService = MockRecipeService();
      backupService = BackupService(mockRecipeService);
    });

    group('Export Recipes', () {
      test('should create backup with correct format when recipes exist', () async {
        // Arrange
        final testRecipes = [
          const Recipe(
            id: 'recipe1',
            userId: 'user123',
            title: 'Test Recipe 1',
            description: 'A delicious test recipe',
            ingredients: [
              RecipeIngredient(text: '2 cups flour'),
              RecipeIngredient(text: '1 cup sugar'),
            ],
            instructions: [
              RecipeInstruction(stepNumber: 1, text: 'Mix ingredients'),
              RecipeInstruction(stepNumber: 2, text: 'Bake for 30 minutes'),
            ],
            tags: ['test', 'dessert'],
            categories: ['Desserts'],
            isFavorite: true,
          ),
          const Recipe(
            id: 'recipe2',
            userId: 'user123',
            title: 'Test Recipe 2',
            description: 'Another test recipe',
            ingredients: [
              RecipeIngredient(text: '3 eggs'),
              RecipeIngredient(text: '1 tbsp vanilla'),
            ],
            instructions: [
              RecipeInstruction(stepNumber: 1, text: 'Beat eggs'),
              RecipeInstruction(stepNumber: 2, text: 'Add vanilla'),
            ],
            tags: ['test', 'breakfast'],
            categories: ['Breakfast'],
            isFavorite: false,
          ),
        ];

        when(mockRecipeService.getAllRecipes()).thenAnswer((_) async => testRecipes);

        // Act
        final result = await backupService.exportRecipes();

        // Assert
        expect(result.success, true);
        expect(result.content, isNotNull);
        expect(result.content!.contains('version'), true);
        expect(result.content!.contains('exportDate'), true);
        expect(result.content!.contains('recipeCount'), true);
        expect(result.content!.contains('Test Recipe 1'), true);
        expect(result.content!.contains('Test Recipe 2'), true);
        
        verify(mockRecipeService.getAllRecipes()).called(1);
      });

      test('should handle empty recipe list', () async {
        // Arrange
        when(mockRecipeService.getAllRecipes()).thenAnswer((_) async => []);

        // Act
        final result = await backupService.exportRecipes();

        // Assert
        expect(result.success, true);
        expect(result.content, isNotNull);
        expect(result.content!.contains('"recipeCount": 0'), true);
        
        verify(mockRecipeService.getAllRecipes()).called(1);
      });

      test('should handle recipe service error', () async {
        // Arrange
        when(mockRecipeService.getAllRecipes()).thenThrow(Exception('Database error'));

        // Act
        final result = await backupService.exportRecipes();

        // Assert
        expect(result.success, false);
        expect(result.message.contains('Failed to export recipes'), true);
        
        verify(mockRecipeService.getAllRecipes()).called(1);
      });
    });

    group('Import Recipes', () {
      test('should import valid backup data successfully', () async {
        // Arrange
        final validBackupJson = '''
        {
          "version": "1.0",
          "exportDate": "2024-01-01T00:00:00.000Z",
          "recipeCount": 1,
          "recipes": [
            {
              "id": "recipe1",
              "userId": "user123",
              "title": "Imported Recipe",
              "description": "A recipe from backup",
              "ingredients": [
                {"text": "2 cups flour"}
              ],
              "instructions": [
                {"stepNumber": 1, "text": "Mix ingredients"}
              ],
              "tags": ["imported"],
              "categories": ["Test"],
              "isFavorite": false,
              "hasUserModifications": false,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z"
            }
          ]
        }
        ''';

        when(mockRecipeService.getRecipeById('recipe1')).thenAnswer((_) async => null);
        when(mockRecipeService.saveRecipe(any)).thenAnswer((_) async => {});

        // Act
        final result = await backupService.importRecipes(validBackupJson);

        // Assert
        expect(result.success, true);
        expect(result.imported, 1);
        expect(result.updated, 0);
        expect(result.skipped, 0);
        expect(result.errors.isEmpty, true);
        
        verify(mockRecipeService.getRecipeById('recipe1')).called(1);
        verify(mockRecipeService.saveRecipe(any)).called(1);
      });

      test('should handle existing recipes without overwrite', () async {
        // Arrange
        final validBackupJson = '''
        {
          "version": "1.0",
          "exportDate": "2024-01-01T00:00:00.000Z",
          "recipeCount": 1,
          "recipes": [
            {
              "id": "recipe1",
              "userId": "user123",
              "title": "Existing Recipe",
              "description": "A recipe that already exists",
              "ingredients": [
                {"text": "2 cups flour"}
              ],
              "instructions": [
                {"stepNumber": 1, "text": "Mix ingredients"}
              ],
              "tags": ["existing"],
              "categories": ["Test"],
              "isFavorite": false,
              "hasUserModifications": false,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z"
            }
          ]
        }
        ''';

        final existingRecipe = Recipe(
          id: 'recipe1',
          userId: 'user123',
          title: 'Existing Recipe',
          ingredients: const [RecipeIngredient(text: '2 cups flour')],
          instructions: const [RecipeInstruction(stepNumber: 1, text: 'Mix ingredients')],
          tags: const ['existing'],
          categories: const ['Test'],
          isFavorite: false,
        );

        when(mockRecipeService.getRecipeById('recipe1')).thenAnswer((_) async => existingRecipe);
        when(mockRecipeService.saveRecipe(any)).thenAnswer((_) async => {});

        // Act
        final result = await backupService.importRecipes(validBackupJson, overwriteExisting: false);

        // Assert
        expect(result.success, true);
        expect(result.imported, 1); // Should create new recipe with unique ID
        expect(result.updated, 0);
        expect(result.skipped, 0);
        
        verify(mockRecipeService.getRecipeById('recipe1')).called(1);
        verify(mockRecipeService.saveRecipe(any)).called(1);
      });

      test('should handle existing recipes with overwrite', () async {
        // Arrange
        final validBackupJson = '''
        {
          "version": "1.0",
          "exportDate": "2024-01-01T00:00:00.000Z",
          "recipeCount": 1,
          "recipes": [
            {
              "id": "recipe1",
              "userId": "user123",
              "title": "Updated Recipe",
              "description": "An updated recipe",
              "ingredients": [
                {"text": "3 cups flour"}
              ],
              "instructions": [
                {"stepNumber": 1, "text": "Mix updated ingredients"}
              ],
              "tags": ["updated"],
              "categories": ["Test"],
              "isFavorite": true,
              "hasUserModifications": true,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z"
            }
          ]
        }
        ''';

        final existingRecipe = Recipe(
          id: 'recipe1',
          userId: 'user123',
          title: 'Old Recipe',
          ingredients: const [RecipeIngredient(text: '2 cups flour')],
          instructions: const [RecipeInstruction(stepNumber: 1, text: 'Mix ingredients')],
          tags: const ['old'],
          categories: const ['Test'],
          isFavorite: false,
        );

        when(mockRecipeService.getRecipeById('recipe1')).thenAnswer((_) async => existingRecipe);
        when(mockRecipeService.updateRecipe(any)).thenAnswer((_) async => {});

        // Act
        final result = await backupService.importRecipes(validBackupJson, overwriteExisting: true);

        // Assert
        expect(result.success, true);
        expect(result.imported, 0);
        expect(result.updated, 1);
        expect(result.skipped, 0);
        
        verify(mockRecipeService.getRecipeById('recipe1')).called(1);
        verify(mockRecipeService.updateRecipe(any)).called(1);
      });

      test('should validate backup data format', () async {
        // Test missing version
        final invalidBackupJson1 = '''
        {
          "exportDate": "2024-01-01T00:00:00.000Z",
          "recipes": []
        }
        ''';

        final result1 = await backupService.importRecipes(invalidBackupJson1);
        expect(result1.success, false);
        expect(result1.message.contains('Missing version field'), true);

        // Test missing recipes
        final invalidBackupJson2 = '''
        {
          "version": "1.0",
          "exportDate": "2024-01-01T00:00:00.000Z"
        }
        ''';

        final result2 = await backupService.importRecipes(invalidBackupJson2);
        expect(result2.success, false);
        expect(result2.message.contains('Missing recipes field'), true);

        // Test empty recipes
        final invalidBackupJson3 = '''
        {
          "version": "1.0",
          "exportDate": "2024-01-01T00:00:00.000Z",
          "recipes": []
        }
        ''';

        final result3 = await backupService.importRecipes(invalidBackupJson3);
        expect(result3.success, false);
        expect(result3.message.contains('No recipes found in backup'), true);
      });

      test('should handle malformed JSON', () async {
        // Arrange
        const invalidJson = '{ invalid json }';

        // Act
        final result = await backupService.importRecipes(invalidJson);

        // Assert
        expect(result.success, false);
        expect(result.message.contains('Failed to import recipes'), true);
      });

      test('should handle partial import failures', () async {
        // Arrange
        final mixedBackupJson = '''
        {
          "version": "1.0",
          "exportDate": "2024-01-01T00:00:00.000Z",
          "recipeCount": 2,
          "recipes": [
            {
              "id": "recipe1",
              "userId": "user123",
              "title": "Good Recipe",
              "ingredients": [{"text": "2 cups flour"}],
              "instructions": [{"stepNumber": 1, "text": "Mix ingredients"}],
              "tags": ["good"],
              "categories": ["Test"],
              "isFavorite": false,
              "hasUserModifications": false,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z"
            },
            {
              "id": "recipe2",
              "userId": "user123",
              "title": "Bad Recipe",
              "ingredients": [{"text": "broken ingredient"}],
              "instructions": [{"stepNumber": 1, "text": "Mix ingredients"}],
              "tags": ["bad"],
              "categories": ["Test"],
              "isFavorite": false,
              "hasUserModifications": false,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z"
            }
          ]
        }
        ''';

        when(mockRecipeService.getRecipeById('recipe1')).thenAnswer((_) async => null);
        when(mockRecipeService.getRecipeById('recipe2')).thenAnswer((_) async => null);
        when(mockRecipeService.saveRecipe(any)).thenAnswer((invocation) async {
          final recipe = invocation.positionalArguments[0] as Recipe;
          if (recipe.title == 'Bad Recipe') {
            throw Exception('Database constraint violation');
          }
        });

        // Act
        final result = await backupService.importRecipes(mixedBackupJson);

        // Assert
        expect(result.success, true); // Overall success even with partial failures
        expect(result.imported, 1); // One successful import
        expect(result.skipped, 1); // One failed import
        expect(result.errors.length, 1); // One error recorded
        expect(result.errors.first.contains('Bad Recipe'), true);
      });
    });
  });
}