import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:recipe_archive_fresh/main.dart';

void main() {
  group('Basic Widget Tests', () {
    testWidgets('App should build without crashing', (WidgetTester tester) async {
      // Build our app and trigger a frame.
      await tester.pumpWidget(const ProviderScope(child: RecipeArchiveApp()));

      // Verify that the app builds without throwing an error
      expect(find.byType(MaterialApp), findsOneWidget);
    });

    testWidgets('App should have correct title', (WidgetTester tester) async {
      await tester.pumpWidget(const ProviderScope(child: RecipeArchiveApp()));

      // Verify that the MaterialApp has the correct title
      final MaterialApp app = tester.widget(find.byType(MaterialApp));
      expect(app.title, 'Recipe Archive');
    });

    testWidgets('App should use Material Design', (WidgetTester tester) async {
      await tester.pumpWidget(const ProviderScope(child: RecipeArchiveApp()));

      // Verify that Material Design components are present
      expect(find.byType(MaterialApp), findsOneWidget);
    });

    testWidgets('App should handle provider scope', (WidgetTester tester) async {
      // Verify that the app works with ProviderScope
      await tester.pumpWidget(const ProviderScope(child: RecipeArchiveApp()));
      await tester.pumpAndSettle();

      // Should not throw errors during build
      expect(tester.takeException(), isNull);
    });
  });
}