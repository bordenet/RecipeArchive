import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

import 'package:recipe_archive_fresh/screens/recipe_detail_screen.dart';
import 'package:recipe_archive_fresh/services/recipe_service.dart';
import 'package:recipe_archive_fresh/models/recipe.dart';
import 'package:recipe_archive_fresh/models/recipe_ingredient.dart';
import 'package:recipe_archive_fresh/models/recipe_instruction.dart';

// Generate mocks
@GenerateNiceMocks([MockSpec<RecipeService>()])
import 'recipe_detail_screen_test.mocks.dart';

void main() {
  group('RecipeDetailScreen Widget Tests', () {
    late Recipe testRecipe;

    setUp(() {
      testRecipe = Recipe(
        id: 'test-recipe-1',
        title: 'Test Recipe with URL',
        description: 'A detailed test recipe for widget testing',
        cookingTime: 30,
        prepTime: 15,
        servings: 4,
        difficulty: 'Easy',
        cuisine: 'Test Cuisine',
        ingredients: [
          RecipeIngredient(text: '1 cup test ingredient'),
          RecipeIngredient(text: '2 tbsp test spice'),
        ],
        instructions: [
          RecipeInstruction(stepNumber: 1, text: 'First test instruction'),
          RecipeInstruction(stepNumber: 2, text: 'Second test instruction'),
        ],
        tags: ['test', 'widget-testing'],
        imageUrl: 'https://example.com/test-recipe.jpg',
        sourceUrl: 'https://www.foodnetwork.com/recipes/test-recipe-12345',
        sourceName: 'Food Network',
      );
    });

    testWidgets('should display delete button in AppBar banner', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: testRecipe),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify delete button exists in the app bar
      expect(find.byKey(const Key('banner_delete_button')), findsOneWidget);
      expect(find.byIcon(Icons.delete), findsOneWidget);
      
      // Verify the tooltip
      final deleteButton = find.byKey(const Key('banner_delete_button'));
      await tester.longPress(deleteButton);
      await tester.pumpAndSettle();
      expect(find.text('Delete Recipe'), findsOneWidget);
    });

    testWidgets('should display original recipe URL in description section', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: testRecipe),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Scroll to find the description section
      await tester.scrollUntilVisible(
        find.text('Description'),
        500.0,
        scrollable: find.byType(Scrollable).first,
      );

      // Verify the description section exists
      expect(find.text('Description'), findsOneWidget);
      expect(find.text('A detailed test recipe for widget testing'), findsOneWidget);
      
      // Verify the original recipe URL is displayed
      expect(find.text('Original Recipe: '), findsOneWidget);
      expect(find.text('https://www.foodnetwork.com/recipes/test-recipe-12345'), findsOneWidget);
      
      // Verify the link icon is present
      expect(find.byIcon(Icons.link), findsOneWidget);
    });

    testWidgets('should display full original URL as clickable link', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: testRecipe),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Scroll to the URL section
      await tester.scrollUntilVisible(
        find.text('Original Recipe: '),
        500.0,
        scrollable: find.byType(Scrollable).first,
      );

      // Verify the URL is clickable (wrapped in GestureDetector)
      final urlText = find.text('https://www.foodnetwork.com/recipes/test-recipe-12345');
      expect(urlText, findsOneWidget);
      
      // Verify it has underline decoration (indicating it's a link)
      final textWidget = tester.widget<Text>(urlText);
      expect(textWidget.style?.decoration, TextDecoration.underline);
      expect(textWidget.style?.color, isNotNull); // Should have link color
    });

    testWidgets('should show delete confirmation dialog when banner delete pressed', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: testRecipe),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap the delete button in the banner
      await tester.tap(find.byKey(const Key('banner_delete_button')));
      await tester.pumpAndSettle();

      // Verify delete confirmation dialog appears
      expect(find.text('Delete Recipe'), findsOneWidget);
      expect(find.text('Are you sure you want to delete "Test Recipe with URL"?'), findsOneWidget);
      expect(find.text('This action cannot be undone. The recipe and all associated data will be permanently removed from your account.'), findsOneWidget);
      
      // Verify dialog buttons
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Delete'), findsAtLeastNWidgets(2)); // One in dialog, one in banner
    });

    testWidgets('should show delete confirmation dialog when content delete pressed', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: testRecipe),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Scroll to find the delete button in the content area
      await tester.scrollUntilVisible(
        find.text('Delete'),
        500.0,
        scrollable: find.byType(Scrollable).first,
      );

      // Find the delete button in the action buttons row (not the banner)
      final deleteButtons = find.byIcon(Icons.delete);
      expect(deleteButtons, findsAtLeastNWidgets(2)); // Banner + content delete buttons
      
      // Tap the content delete button (should be the second one found)
      await tester.tap(deleteButtons.last);
      await tester.pumpAndSettle();

      // Verify delete confirmation dialog appears
      expect(find.text('Delete Recipe'), findsOneWidget);
      expect(find.text('Are you sure you want to delete "Test Recipe with URL"?'), findsOneWidget);
    });

    testWidgets('should display View Original button when recipe has sourceUrl', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: testRecipe),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Scroll to find the View Original button
      await tester.scrollUntilVisible(
        find.text('View Original at Food Network'),
        500.0,
        scrollable: find.byType(Scrollable).first,
      );

      // Verify the View Original button exists
      expect(find.text('View Original at Food Network'), findsOneWidget);
      expect(find.byIcon(Icons.launch), findsOneWidget);
    });

    testWidgets('should not show URL section when recipe has no sourceUrl', (WidgetTester tester) async {
      final recipeWithoutUrl = Recipe(
        id: 'test-recipe-no-url',
        title: 'Recipe Without URL',
        description: 'A recipe without source URL',
        cookingTime: 20,
        prepTime: 10,
        servings: 2,
        ingredients: [RecipeIngredient(text: '1 cup ingredient')],
        instructions: [RecipeInstruction(stepNumber: 1, text: 'Mix ingredients')],
        tags: ['test'],
        sourceUrl: null, // No URL
        sourceName: null,
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: recipeWithoutUrl),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Scroll through the content
      await tester.scrollUntilVisible(
        find.text('Description'),
        500.0,
        scrollable: find.byType(Scrollable).first,
      );

      // Verify URL section is NOT displayed
      expect(find.text('Original Recipe: '), findsNothing);
      expect(find.byIcon(Icons.link), findsNothing);
      expect(find.text('View Original'), findsNothing);
    });

    testWidgets('should display recipe title in AppBar', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: testRecipe),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify recipe title is displayed in the AppBar
      expect(find.text('Test Recipe with URL'), findsOneWidget);
    });

    testWidgets('should display recipe metadata', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: RecipeDetailScreen(recipe: testRecipe),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify servings display (should be clickable)
      expect(find.textContaining('4'), findsAtLeastNWidgets(1)); // servings
      expect(find.textContaining('15 min'), findsOneWidget); // prep time
      expect(find.textContaining('30 min'), findsOneWidget); // cook time
    });
  });
}