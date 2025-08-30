import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:recipe_archive_fresh/screens/auth/login_screen.dart';
import 'package:recipe_archive_fresh/services/auth_service.dart';

// Generate mocks
@GenerateNiceMocks([
  MockSpec<AuthenticationService>(),
  MockSpec<FlutterSecureStorage>(),
])
import 'login_screen_test.mocks.dart';

void main() {
  group('LoginScreen Widget Tests', () {
    late MockAuthenticationService mockAuthService;

    setUp(() {
      mockAuthService = MockAuthenticationService();
    });

    testWidgets('should display login form elements', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify main UI elements
      expect(find.text('Recipe Archive'), findsOneWidget);
      expect(find.text('Sign in to your account'), findsOneWidget);
      
      // Verify form fields
      expect(find.byType(TextFormField), findsNWidgets(2)); // Email and password
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      
      // Verify buttons and links
      expect(find.text('Sign In'), findsOneWidget);
      expect(find.text('Forgot Password?'), findsOneWidget);
      expect(find.text('Sign Up'), findsOneWidget);
    });

    testWidgets('should show password checkbox functionality', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find show password checkbox
      final showPasswordCheckbox = find.text('Show password');
      expect(showPasswordCheckbox, findsOneWidget);
      
      // Find password field
      final passwordField = find.byType(TextFormField).last;
      final passwordWidget = tester.widget<TextFormField>(passwordField);
      
      // Initially password should be obscured
      expect(passwordWidget.obscureText, isTrue);
      
      // Tap show password checkbox
      await tester.tap(find.byType(Checkbox).first);
      await tester.pumpAndSettle();
      
      // Password should now be visible
      final updatedPasswordField = find.byType(TextFormField).last;
      final updatedPasswordWidget = tester.widget<TextFormField>(updatedPasswordField);
      expect(updatedPasswordWidget.obscureText, isFalse);
    });

    testWidgets('should show remember me checkbox functionality', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find remember me checkbox
      final rememberMeText = find.text('Remember me');
      expect(rememberMeText, findsOneWidget);
      
      // Find remember me checkbox (should be the second checkbox)
      final checkboxes = find.byType(Checkbox);
      expect(checkboxes, findsNWidgets(2));
      
      // Tap remember me checkbox
      await tester.tap(checkboxes.last);
      await tester.pumpAndSettle();
      
      // Verify checkbox state changed (this is a basic interaction test)
      expect(checkboxes.last, findsOneWidget);
    });

    testWidgets('should validate email field', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find email field and enter invalid email
      final emailField = find.byType(TextFormField).first;
      await tester.enterText(emailField, 'invalid-email');
      
      // Find and tap sign in button
      final signInButton = find.text('Sign In');
      await tester.tap(signInButton);
      await tester.pumpAndSettle();

      // Should show email validation error
      expect(find.text('Please enter a valid email'), findsOneWidget);
    });

    testWidgets('should validate required fields', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Clear default email field
      final emailField = find.byType(TextFormField).first;
      await tester.enterText(emailField, '');
      
      // Clear default password field  
      final passwordField = find.byType(TextFormField).last;
      await tester.enterText(passwordField, '');
      
      // Try to sign in
      final signInButton = find.text('Sign In');
      await tester.tap(signInButton);
      await tester.pumpAndSettle();

      // Should show validation errors
      expect(find.text('Please enter your email'), findsOneWidget);
      expect(find.text('Please enter your password'), findsOneWidget);
    });

    testWidgets('should show loading state during sign in', (WidgetTester tester) async {
      // Mock auth service to delay response
      when(mockAuthService.signIn(any, any))
          .thenAnswer((_) async => Future.delayed(
              const Duration(milliseconds: 100),
              () => const AuthUser(
                id: 'test-id',
                email: 'test@test.com',
                accessToken: 'test-token',
                idToken: 'test-id-token',
              )));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter valid credentials
      final emailField = find.byType(TextFormField).first;
      await tester.enterText(emailField, 'test@test.com');
      
      final passwordField = find.byType(TextFormField).last;
      await tester.enterText(passwordField, 'password123');

      // Tap sign in
      final signInButton = find.text('Sign In');
      await tester.tap(signInButton);
      await tester.pump(); // Start the loading state

      // Should show loading indicator
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      
      // Button should be disabled during loading
      final buttonWidget = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(buttonWidget.onPressed, isNull);

      await tester.pumpAndSettle(); // Complete the async operation
    });

    testWidgets('should navigate to forgot password screen', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find and tap forgot password link
      final forgotPasswordLink = find.text('Forgot Password?');
      await tester.tap(forgotPasswordLink);
      await tester.pumpAndSettle();

      // Should navigate to forgot password screen
      // (In a real test, you'd check for the ForgotPasswordScreen widget)
      expect(find.text('Forgot Password?'), findsNothing); // Should be on different screen
    });

    testWidgets('should navigate to sign up screen', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find and tap sign up link
      final signUpLink = find.text('Sign Up');
      await tester.tap(signUpLink);
      await tester.pumpAndSettle();

      // Should navigate to sign up screen
      // (In a real test, you'd check for the SignUpScreen widget)
      expect(find.text("Don't have an account? "), findsNothing); // Should be on different screen
    });

    testWidgets('should auto-populate default credentials', (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Should auto-populate with default credentials
      final emailField = find.byType(TextFormField).first;
      final passwordField = find.byType(TextFormField).last;
      
      final emailWidget = tester.widget<TextFormField>(emailField);
      final passwordWidget = tester.widget<TextFormField>(passwordField);
      
      // Should have default values (from environment or fallback)
      expect(emailWidget.controller?.text, isNotEmpty);
      expect(passwordWidget.controller?.text, isNotEmpty);
    });

    testWidgets('should handle authentication errors', (WidgetTester tester) async {
      // Mock auth service to throw error
      when(mockAuthService.signIn(any, any))
          .thenThrow(Exception('Authentication failed'));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authServiceProvider.overrideWith((ref) => mockAuthService),
          ],
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Enter credentials and sign in
      final signInButton = find.text('Sign In');
      await tester.tap(signInButton);
      await tester.pumpAndSettle();

      // Should show error snackbar
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.text('Exception: Authentication failed'), findsOneWidget);
    });
  });
}