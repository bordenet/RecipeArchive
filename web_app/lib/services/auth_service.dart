import 'dart:convert';
import 'dart:io';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// AWS Cognito Authentication Service for Recipe Archive
class AuthService {
  // AWS Cognito configuration from environment variables
  static String get userPoolId => dotenv.env['COGNITO_USER_POOL_ID'] ?? '';
  static String get clientId => dotenv.env['COGNITO_APP_CLIENT_ID'] ?? '';
  static String get region => dotenv.env['AWS_REGION'] ?? 'us-west-2';
  static String get cognitoEndpoint => 'https://cognito-idp.$region.amazonaws.com/';
  
  String? _accessToken;
  String? _idToken;
  String? _refreshToken;
  String? _userId;
  String? _userEmail;
  
  // Getters
  String? get accessToken => _accessToken;
  String? get idToken => _idToken;
  String? get userId => _userId;
  String? get userEmail => _userEmail;
  bool get isAuthenticated => _accessToken != null;
  
  /// Authenticate with AWS Cognito using username and password
  Future<bool> authenticate(String username, String password) async {
    try {
      print('🔐 Authenticating with AWS Cognito...');
      
      final authRequest = {
        'AuthFlow': 'USER_PASSWORD_AUTH',
        'ClientId': clientId,
        'AuthParameters': {
          'USERNAME': username,
          'PASSWORD': password,
        },
      };
      
      final client = HttpClient();
      final request = await client.postUrl(Uri.parse(cognitoEndpoint));
      
      // Set required AWS headers
      request.headers.set('Content-Type', 'application/x-amz-json-1.1');
      request.headers.set('X-Amz-Target', 'AWSCognitoIdentityProviderService.InitiateAuth');
      
      // Send request
      request.write(json.encode(authRequest));
      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();
      
      client.close();
      
      if (response.statusCode == 200) {
        final responseData = json.decode(responseBody);
        final authResult = responseData['AuthenticationResult'];
        
        if (authResult != null) {
          _accessToken = authResult['AccessToken'];
          _idToken = authResult['IdToken'];
          _refreshToken = authResult['RefreshToken'];
          
          // Extract user info from ID token
          if (_idToken != null) {
            _extractUserInfoFromJWT(_idToken!);
          }
          
          print('✅ Authentication successful for $_userEmail');
          return true;
        }
      } else {
        print('❌ Authentication failed: ${response.statusCode}');
        print('Response: $responseBody');
      }
      
      return false;
      
    } catch (e) {
      print('❌ Authentication error: $e');
      return false;
    }
  }
  
  /// Extract user information from JWT ID token
  void _extractUserInfoFromJWT(String idToken) {
    try {
      // JWT tokens have 3 parts separated by dots
      final parts = idToken.split('.');
      if (parts.length != 3) {
        print('⚠️ Invalid JWT token format');
        return;
      }
      
      // Decode the payload (second part)
      final payload = parts[1];
      
      // Add padding if needed for base64 decoding
      String normalizedPayload = payload;
      while (normalizedPayload.length % 4 != 0) {
        normalizedPayload += '=';
      }
      
      // Decode from base64
      final decodedBytes = base64.decode(normalizedPayload);
      final decodedString = utf8.decode(decodedBytes);
      final payloadData = json.decode(decodedString);
      
      // Extract user information
      _userId = payloadData['sub'];
      _userEmail = payloadData['email'];
      
      print('👤 User ID: $_userId');
      print('📧 Email: $_userEmail');
      
    } catch (e) {
      print('⚠️ Failed to extract user info from JWT: $e');
    }
  }
  
  /// Get authorization headers for API requests
  Map<String, String> getAuthHeaders() {
    if (!isAuthenticated) {
      throw Exception('Not authenticated');
    }
    
    // Use ID token instead of access token for Recipe Archive API
    // The backend expects user claims (sub, email) which are in the ID token
    return {
      'Authorization': 'Bearer $_idToken',
      'Content-Type': 'application/json',
    };
  }
  
  /// Clear authentication state
  void logout() {
    _accessToken = null;
    _idToken = null;
    _refreshToken = null;
    _userId = null;
    _userEmail = null;
    print('👋 Logged out');
  }
}

/// Recipe API Service that uses authentication
class RecipeAPIService {
  static const String baseUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';
  
  final AuthService _authService;
  
  RecipeAPIService(this._authService);
  
  /// Get all recipes for the authenticated user
  Future<List<Map<String, dynamic>>> getRecipes() async {
    if (!_authService.isAuthenticated) {
      throw Exception('Not authenticated');
    }
    
    try {
      print('🍽️ Fetching recipes...');
      
      final client = HttpClient();
      final request = await client.getUrl(Uri.parse('$baseUrl/v1/recipes'));
      
      // Add auth headers
      final headers = _authService.getAuthHeaders();
      headers.forEach((key, value) {
        request.headers.set(key, value);
      });
      
      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();
      
      client.close();
      
      if (response.statusCode == 200) {
        final responseData = json.decode(responseBody);
        final recipes = responseData['recipes'] as List<dynamic>?;
        
        if (recipes != null) {
          print('✅ Retrieved ${recipes.length} recipes');
          return recipes.cast<Map<String, dynamic>>();
        }
      } else {
        print('❌ Failed to get recipes: ${response.statusCode}');
        print('Response: $responseBody');
      }
      
      return [];
      
    } catch (e) {
      print('❌ Error getting recipes: $e');
      return [];
    }
  }
}

/// Test the authentication and API functionality
void main() async {
  print('🚀 Recipe Archive - Authentication & API Test\n');
  
  // Initialize services
  final authService = AuthService();
  final recipeService = RecipeAPIService(authService);
  
  // Test with credentials from environment
  final username = dotenv.env['TEST_USER_EMAIL'] ?? '';
  final password = dotenv.env['TEST_USER_PASSWORD'] ?? '';
  
  // Authenticate
  final success = await authService.authenticate(username, password);
  
  if (success) {
    print('\n📊 Authentication Details:');
    print('User ID: ${authService.userId}');
    print('Email: ${authService.userEmail}');
    print('Has Access Token: ${authService.accessToken != null}');
    
    // Test recipe API
    print('\n🍽️ Testing Recipe API...');
    final recipes = await recipeService.getRecipes();
    
    if (recipes.isNotEmpty) {
      print('\n📋 Recipe Summary:');
      print('Total recipes: ${recipes.length}');
      
      // Show first few recipes
      for (int i = 0; i < recipes.length && i < 5; i++) {
        final recipe = recipes[i];
        print('  ${i + 1}. ${recipe['title'] ?? 'Untitled'} (${recipe['domain'] ?? recipe['sourceUrl'] ?? 'unknown'})');
      }
      
      if (recipes.length > 5) {
        print('  ... and ${recipes.length - 5} more recipes');
      }
      
      print('\n🎯 SUCCESS: Flutter web app can now connect to AWS backend!');
      print('✅ Ready for next phase: Flutter UI integration');
      
    } else {
      print('⚠️ No recipes found or API error');
    }
    
  } else {
    print('❌ Authentication failed - cannot proceed');
  }
}
