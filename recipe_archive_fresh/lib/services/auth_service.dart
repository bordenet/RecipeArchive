import 'dart:convert';
import 'package:amazon_cognito_identity_dart_2/cognito.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// User model for authenticated state
class AuthUser {
  final String id;
  final String email;
  final String? username;
  final String accessToken;
  final String idToken;

  const AuthUser({
    required this.id,
    required this.email,
    this.username,
    required this.accessToken,
    required this.idToken,
  });

  factory AuthUser.fromCognitoUser(CognitoUser cognitoUser, CognitoUserSession session) {
    try {
      final idToken = session.getIdToken();
      final accessToken = session.getAccessToken();
      
      if (idToken == null || accessToken == null) {
        throw Exception('Missing tokens in session');
      }
      
      final payload = idToken.decodePayload();
      if (payload == null) {
        throw Exception('Failed to decode ID token payload');
      }
      
      return AuthUser(
        id: payload['sub']?.toString() ?? '',
        email: payload['email']?.toString() ?? '',
        username: payload['cognito:username']?.toString(),
        accessToken: accessToken.getJwtToken() ?? '',
        idToken: idToken.getJwtToken() ?? '',
      );
    } catch (e) {
      print('Error creating AuthUser from Cognito: $e');
      throw Exception('Failed to create AuthUser: ${e.toString()}');
    }
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'username': username,
    'accessToken': accessToken,
    'idToken': idToken,
  };

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id'] ?? '',
    email: json['email'] ?? '',
    username: json['username'],
    accessToken: json['accessToken'] ?? '',
    idToken: json['idToken'] ?? '',
  );
}

// Authentication state
enum AuthState {
  initial,
  loading,
  authenticated,
  unauthenticated,
  error,
}

class AuthenticationService {
  static const String _userKey = 'authenticated_user';
  static const _storage = FlutterSecureStorage();

  late final CognitoUserPool _userPool;
  CognitoUser? _cognitoUser;
  AuthUser? _currentUser;

  AuthenticationService() {
    _initializeCognito();
  }

  void _initializeCognito() {
    try {
      // Use hardcoded values as fallback if .env not loaded
      final userPoolId = dotenv.env['COGNITO_USER_POOL_ID'] ?? 'us-west-2_qJ1i9RhxD';
      final clientId = dotenv.env['COGNITO_APP_CLIENT_ID'] ?? '5grdn7qhf1el0ioqb6hkelr29s';
      
      print('Initializing Cognito with poolId: $userPoolId, clientId: $clientId');
      
      if (userPoolId.isEmpty || clientId.isEmpty) {
        throw Exception('Missing Cognito configuration: userPoolId=$userPoolId, clientId=$clientId');
      }

      _userPool = CognitoUserPool(userPoolId, clientId);
      print('Cognito UserPool initialized successfully');
    } catch (e) {
      print('Error initializing Cognito: $e');
      throw Exception('Failed to initialize Cognito: ${e.toString()}');
    }
  }

  AuthUser? get currentUser => _currentUser;

  // Check if user is currently authenticated
  Future<bool> isAuthenticated() async {
    try {
      // Check if we have a stored user
      final userJson = await _storage.read(key: _userKey);
      if (userJson != null) {
        final userData = jsonDecode(userJson);
        _currentUser = AuthUser.fromJson(userData);
        
        // Verify the session is still valid
        final currentUser = _currentUser;
        if (currentUser != null && currentUser.email.isNotEmpty) {
          _cognitoUser = CognitoUser(currentUser.email, _userPool);
          final session = await _cognitoUser?.getSession();
        
          if (session != null && session.isValid()) {
            // Update stored user with fresh tokens if needed
            final cognitoUser = _cognitoUser;
            if (cognitoUser != null) {
              _currentUser = AuthUser.fromCognitoUser(cognitoUser, session);
              final updatedUser = _currentUser;
              if (updatedUser != null) {
                await _storeUser(updatedUser);
                return true;
              }
            }
          }
        }
      }
      
      // Try to get current authenticated user from Cognito
      _cognitoUser = await _userPool.getCurrentUser();
      final cognitoUser = _cognitoUser;
      if (cognitoUser != null) {
        final session = await cognitoUser.getSession();
        if (session != null && session.isValid()) {
          _currentUser = AuthUser.fromCognitoUser(cognitoUser, session);
          final currentUser = _currentUser;
          if (currentUser != null) {
            await _storeUser(currentUser);
            return true;
          }
        }
      }
      
      await _clearStoredUser();
      return false;
    } catch (e) {
      await _clearStoredUser();
      return false;
    }
  }

  // Sign in with email and password
  Future<AuthUser> signIn(String email, String password) async {
    try {
      print('Starting sign in for email: $email');
      
      if (_userPool == null) {
        throw Exception('Cognito UserPool not initialized');
      }
      
      _cognitoUser = CognitoUser(email, _userPool);
      print('Created CognitoUser');
      
      final authDetails = AuthenticationDetails(
        username: email,
        password: password,
      );
      print('Created AuthenticationDetails');
      
      final cognitoUser = _cognitoUser;
      if (cognitoUser == null) {
        throw Exception('Failed to create Cognito user');
      }
      
      print('Calling authenticateUser...');
      final session = await cognitoUser.authenticateUser(authDetails);
      print('Authentication completed, session valid: ${session?.isValid()}');
      
      if (session == null || !session.isValid()) {
        throw Exception('Failed to authenticate user - invalid session');
      }
      
      print('Creating AuthUser from session...');
      _currentUser = AuthUser.fromCognitoUser(cognitoUser, session);
      final currentUser = _currentUser;
      if (currentUser == null) {
        throw Exception('Failed to create user from Cognito response');
      }
      
      print('Storing user...');
      await _storeUser(currentUser);
      print('Sign in completed successfully');
      return currentUser;
    } catch (e) {
      if (e is CognitoUserException) {
        final message = e.message ?? 'Authentication failed';
        if (message.contains('UserNotConfirmed')) {
          throw Exception('Please verify your email address before signing in');
        } else if (message.contains('NotAuthorized')) {
          throw Exception('Invalid email or password');
        } else if (message.contains('TooManyRequests')) {
          throw Exception('Too many failed attempts. Please try again later');
        } else if (message.contains('UserNotFound')) {
          throw Exception('User not found. Please check your email address');
        } else {
          throw Exception(message);
        }
      }
      throw Exception('Sign in failed: ${e.toString()}');
    }
  }

  // Sign up new user
  Future<void> signUp(String email, String password, {String? username}) async {
    try {
      final userAttributes = [
        AttributeArg(name: 'email', value: email),
        if (username != null) AttributeArg(name: 'preferred_username', value: username),
      ];
      
      await _userPool.signUp(email, password, userAttributes: userAttributes);
    } catch (e) {
      if (e is CognitoUserException) {
        final message = e.message ?? 'Sign up failed';
        if (message.contains('UsernameExists')) {
          throw Exception('An account with this email already exists');
        } else if (message.contains('InvalidPassword')) {
          throw Exception('Password does not meet requirements');
        } else if (message.contains('InvalidParameter')) {
          throw Exception('Invalid email format');
        } else {
          throw Exception(message);
        }
      }
      throw Exception('Sign up failed: ${e.toString()}');
    }
  }

  // Confirm sign up with verification code
  Future<void> confirmSignUp(String email, String confirmationCode) async {
    try {
      final cognitoUser = CognitoUser(email, _userPool);
      await cognitoUser.confirmRegistration(confirmationCode);
    } catch (e) {
      if (e is CognitoUserException) {
        final message = e.message ?? 'Verification failed';
        if (message.contains('CodeMismatch')) {
          throw Exception('Invalid verification code');
        } else if (message.contains('ExpiredCode')) {
          throw Exception('Verification code has expired');
        } else if (message.contains('NotAuthorized')) {
          throw Exception('User is already confirmed');
        } else {
          throw Exception(message);
        }
      }
      throw Exception('Verification failed: ${e.toString()}');
    }
  }

  // Resend verification code
  Future<void> resendConfirmationCode(String email) async {
    try {
      final cognitoUser = CognitoUser(email, _userPool);
      await cognitoUser.resendConfirmationCode();
    } catch (e) {
      throw Exception('Failed to resend verification code: ${e.toString()}');
    }
  }

  // Sign out
  Future<void> signOut() async {
    try {
      final cognitoUser = _cognitoUser;
      if (cognitoUser != null) {
        await cognitoUser.signOut();
      }
      await _clearStoredUser();
      _cognitoUser = null;
      _currentUser = null;
    } catch (e) {
      // Even if sign out fails, clear local data
      await _clearStoredUser();
      _cognitoUser = null;
      _currentUser = null;
    }
  }

  // Reset password
  Future<void> resetPassword(String email) async {
    try {
      final cognitoUser = CognitoUser(email, _userPool);
      await cognitoUser.forgotPassword();
    } catch (e) {
      throw Exception('Failed to reset password: ${e.toString()}');
    }
  }

  // Store user in secure storage
  Future<void> _storeUser(AuthUser user) async {
    await _storage.write(key: _userKey, value: jsonEncode(user.toJson()));
  }

  // Clear stored user data
  Future<void> _clearStoredUser() async {
    await _storage.delete(key: _userKey);
    _currentUser = null;
  }
}

// Riverpod providers
final authServiceProvider = Provider<AuthenticationService>((ref) {
  return AuthenticationService();
});

final authStateProvider = StateNotifierProvider<AuthStateNotifier, AsyncValue<AuthUser?>>((ref) {
  final authService = ref.read(authServiceProvider);
  return AuthStateNotifier(authService);
});

class AuthStateNotifier extends StateNotifier<AsyncValue<AuthUser?>> {
  final AuthenticationService _authService;

  AuthStateNotifier(this._authService) : super(const AsyncValue.loading()) {
    _initializeAuth();
  }

  Future<void> _initializeAuth() async {
    try {
      final isAuth = await _authService.isAuthenticated();
      state = AsyncValue.data(isAuth ? _authService.currentUser : null);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  Future<void> signIn(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await _authService.signIn(email, password);
      state = AsyncValue.data(user);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  Future<void> signUp(String email, String password, {String? username}) async {
    state = const AsyncValue.loading();
    try {
      await _authService.signUp(email, password, username: username);
      // Stay in loading state until confirmation
      state = const AsyncValue.data(null);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  Future<void> confirmSignUp(String email, String confirmationCode) async {
    try {
      await _authService.confirmSignUp(email, confirmationCode);
      state = const AsyncValue.data(null);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  Future<void> signOut() async {
    try {
      await _authService.signOut();
      state = const AsyncValue.data(null);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }

  Future<void> resetPassword(String email) async {
    try {
      await _authService.resetPassword(email);
    } catch (e) {
      state = AsyncValue.error(e, StackTrace.current);
    }
  }
}