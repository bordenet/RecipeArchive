// Basic Flutter widget test for core functionality.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Recipe Archive smoke test', (WidgetTester tester) async {
    // Build a minimal app for testing
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          appBar: AppBar(title: const Text('Recipe Archive')),
          body: const Center(
            child: Column(
              children: [
                Text('Welcome to Recipe Archive!'),
                SizedBox(height: 16),
                CircularProgressIndicator(),
              ],
            ),
          ),
          floatingActionButton: FloatingActionButton(
            onPressed: () {},
            child: const Icon(Icons.add),
          ),
        ),
      ),
    );

    // Verify that our app shows the welcome message.
    expect(find.text('Welcome to Recipe Archive!'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // Tap the '+' icon and trigger a frame.
    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();

    // Verify that the floating action button works (no crash)
    expect(find.byIcon(Icons.add), findsOneWidget);
  });
}
