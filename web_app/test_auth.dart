import 'dart:convert';
import 'dart:io';

/// Test AWS Cognito authentication for RecipeArchive
/// Run with: dart run test_auth.dart
void main() async {
  print('🔐 Testing AWS Cognito Authentication...');
  
  // AWS Cognito Configuration (from recipe-report tool)
  const String userPoolId = 'us-west-2_qJ1i9RhxD';
  const String clientId = '5grdn7qhf1el0ioqb6hkelr29s';
  const String region = 'us-west-2';
  
  // Test credentials (from recipe-report command that works)
  const String username = 'mattbordenet@hotmail.com';
  const String password = 'Recipe123';
  
  // AWS Cognito Identity Provider endpoint
  const String cognitoEndpoint = 'https://cognito-idp.$region.amazonaws.com/';
  
  try {
    print('📡 Authenticating with Cognito...');
    
    // Create authentication request (AWS Cognito InitiateAuth)
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
    
    // Send request body
    request.write(json.encode(authRequest));
    
    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();
    
    print('📊 Response status: ${response.statusCode}');
    
    if (response.statusCode == 200) {
      final responseData = json.decode(responseBody);
      print('✅ Authentication successful!');
      
      // Extract tokens
      final authResult = responseData['AuthenticationResult'];
      if (authResult != null) {
        final accessToken = authResult['AccessToken'];
        final idToken = authResult['IdToken'];
        final refreshToken = authResult['RefreshToken'];
        
        print('🎟️ Access Token: ${accessToken?.substring(0, 50)}...');
        print('🪪 ID Token: ${idToken?.substring(0, 50)}...');
        print('🔄 Refresh Token: ${refreshToken?.substring(0, 50)}...');
        
        // Now test API call with access token
        await testRecipeAPI(accessToken);
      }
    } else {
      print('❌ Authentication failed: ${response.statusCode}');
      print('Response: $responseBody');
    }
    
    client.close();
    
  } catch (e) {
    print('❌ Error: $e');
  }
}

Future<void> testRecipeAPI(String? accessToken) async {
  if (accessToken == null) {
    print('❌ No access token available');
    return;
  }
  
  print('\n🍽️ Testing Recipe API with auth token...');
  
  const baseUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';
  const recipesEndpoint = '$baseUrl/v1/recipes';
  
  try {
    final client = HttpClient();
    final request = await client.getUrl(Uri.parse(recipesEndpoint));
    
    // Add authorization header
    request.headers.set('Authorization', 'Bearer $accessToken');
    request.headers.set('Content-Type', 'application/json');
    
    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();
    
    print('📊 Recipes API status: ${response.statusCode}');
    
    if (response.statusCode == 200) {
      final recipesData = json.decode(responseBody);
      final recipes = recipesData['recipes'] as List?;
      
      print('✅ Successfully retrieved ${recipes?.length ?? 0} recipes!');
      
      if (recipes != null && recipes.isNotEmpty) {
        print('\n📋 First few recipes:');
        for (int i = 0; i < recipes.length && i < 3; i++) {
          final recipe = recipes[i];
          print('  ${i + 1}. ${recipe['title']} (${recipe['domain'] ?? 'unknown domain'})');
        }
      }
    } else {
      print('❌ Recipe API failed: ${response.statusCode}');
      print('Response: ${responseBody.substring(0, 200)}...');
    }
    
    client.close();
    
  } catch (e) {
    print('❌ Recipe API error: $e');
  }
}
