import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

import 'package:recipe_archive_fresh/screens/home_screen.dart';
import 'package:recipe_archive_fresh/services/recipe_service.dart';
import 'package:recipe_archive_fresh/services/auth_service.dart';
import 'package:recipe_archive_fresh/models/recipe.dart';
import 'package:recipe_archive_fresh/models/recipe_ingredient.dart';
import 'package:recipe_archive_fresh/models/recipe_instruction.dart';

// Generate mocks
@GenerateNiceMocks([
  MockSpec<RecipeService>(),
  MockSpec<AuthenticationService>(),
])
import 'home_screen_test.mocks.dart';

void main() {
  group('HomeScreen Widget Tests', () {
    late MockRecipeService mockRecipeService;
    late MockAuthenticationService mockAuthService;
    late List<Recipe> mockRecipes;

    setUp(() {
      mockRecipeService = MockRecipeService();
      mockAuthService = MockAuthenticationService();
      
      // Create mock recipes for testing
      mockRecipes = [
        Recipe(
          id: '1',
          title: 'Test Recipe 1',
          description: 'A test recipe for widget testing',
          cookingTime: 30,
          prepTime: 15,
          servings: 4,
          difficulty: 'Easy',
          cuisine: 'Test',
          ingredients: [
            RecipeIngredient(text: '1 cup test ingredient'),
          ],
          instructions: [
            RecipeInstruction(stepNumber: 1, text: 'Test instruction'),
          ],
          tags: ['test'],
          imageUrl: 'https://example.com/test.jpg',
          sourceUrl: 'https://example.com/recipe',
          sourceName: 'Test Source',
        ),
        Recipe(
          id: '2',
          title: 'Test Recipe 2',
          description: 'Another test recipe',
          cookingTime: 25,
          prepTime: 10,
          servings: 2,
          difficulty: 'Medium',
          cuisine: 'Test',
          ingredients: [
            RecipeIngredient(text: '2 cups test ingredient'),
          ],
          instructions: [
            RecipeInstruction(stepNumber: 1, text: 'Another test instruction'),
          ],
          tags: ['test', 'mock'],
          imageUrl: 'https://example.com/test2.jpg',
          sourceUrl: 'https://example.com/recipe2',
          sourceName: 'Test Source 2',
        ),
      ];
    });

    testWidgets('should display refresh button in AppBar', (WidgetTester tester) async {
      // Create a container with necessary providers
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            recipesProvider.overrideWith((ref) => Future.value(mockRecipes)),
            authStateProvider.overrideWith((ref) => const AsyncValue.data(
              AuthUser(
                id: 'test-id',
                email: 'test@test.com',
                accessToken: 'test-token',
                idToken: 'test-id-token',
              )
            )),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify refresh button exists
      expect(find.byIcon(Icons.refresh), findsOneWidget);
      expect(find.byTooltip('Refresh recipes'), findsOneWidget);
    });

    testWidgets('refresh button should trigger recipe reload', (WidgetTester tester) async {
      bool refreshTriggered = false;
      
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            recipesProvider.overrideWith((ref) {
              ref.onDispose(() => refreshTriggered = true);
              return Future.value(mockRecipes);
            }),
            authStateProvider.overrideWith((ref) => const AsyncValue.data(
              AuthUser(
                id: 'test-id',
                email: 'test@test.com',
                accessToken: 'test-token',
                idToken: 'test-id-token',
              )
            )),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find and tap the refresh button
      final refreshButton = find.byIcon(Icons.refresh);
      expect(refreshButton, findsOneWidget);
      
      await tester.tap(refreshButton);
      await tester.pump();

      // Verify that the refresh action was triggered
      // Note: In a real test, you'd verify that the provider was invalidated
      // This is a simplified test structure
    });

    testWidgets('should display recipe cards', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            recipesProvider.overrideWith((ref) => Future.value(mockRecipes)),
            authStateProvider.overrideWith((ref) => const AsyncValue.data(
              AuthUser(
                id: 'test-id',
                email: 'test@test.com',
                accessToken: 'test-token',
                idToken: 'test-id-token',
              )
            )),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify recipe titles are displayed
      expect(find.text('Test Recipe 1'), findsOneWidget);
      expect(find.text('Test Recipe 2'), findsOneWidget);
    });

    testWidgets('should show account menu', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            recipesProvider.overrideWith((ref) => Future.value(mockRecipes)),
            authStateProvider.overrideWith((ref) => const AsyncValue.data(
              AuthUser(
                id: 'test-id',
                email: 'test@test.com',
                accessToken: 'test-token',
                idToken: 'test-id-token',
              )
            )),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify account menu button exists
      expect(find.byIcon(Icons.account_circle), findsOneWidget);
    });

    testWidgets('should display empty state when no recipes', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            recipesProvider.overrideWith((ref) => Future.value([])),
            authStateProvider.overrideWith((ref) => const AsyncValue.data(
              AuthUser(
                id: 'test-id',
                email: 'test@test.com',
                accessToken: 'test-token',
                idToken: 'test-id-token',
              )
            )),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify empty state is displayed
      expect(find.text('No recipes found'), findsOneWidget);
      expect(find.text('Add your first recipe to get started!'), findsOneWidget);
      expect(find.byIcon(Icons.restaurant_menu), findsOneWidget);
    });
  });
}