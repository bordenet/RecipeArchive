// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:recipe_archive/main.dart';

void main() {
  testWidgets('Recipe Archive smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const RecipeArchiveApp());

    // Verify that our app shows the welcome message.
    expect(find.text('Welcome to Recipe Archive!'), findsOneWidget);
    expect(find.text('Your Flutter/Dart app is working!'), findsOneWidget);

    // Tap the '+' icon and trigger a frame.
    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();

    // Verify that the floating action button works (no crash)
    expect(find.byIcon(Icons.add), findsOneWidget);
  });
}
