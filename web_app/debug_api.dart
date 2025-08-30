#!/usr/bin/env dart

import 'dart:convert';
import 'dart:io';

void main() async {
  print('🔍 API Debugging Script');
  print('========================');
  
  // Step 1: Test Authentication
  print('\n1️⃣ Testing Cognito Authentication...');
  
  const String userPoolId = 'us-west-2_qJ1i9RhxD';
  const String clientId = '5grdn7qhf1el0ioqb6hkelr29s';
  const String region = 'us-west-2';
  const String username = 'mattbordenet@hotmail.com';
  const String password = 'Recipe123';
  const String cognitoEndpoint = 'https://cognito-idp.$region.amazonaws.com/';
  
  String? accessToken;
  String? idToken;
  
  try {
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
    request.headers.set('Content-Type', 'application/x-amz-json-1.1');
    request.headers.set('X-Amz-Target', 'AWSCognitoIdentityProviderService.InitiateAuth');
    request.write(json.encode(authRequest));
    
    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();
    
    if (response.statusCode == 200) {
      final responseData = json.decode(responseBody);
      accessToken = responseData['AuthenticationResult']['AccessToken'];
      idToken = responseData['AuthenticationResult']['IdToken'];
      print('✅ Authentication successful!');
      print('🎟️ Access token length: ${accessToken?.length ?? 0}');
    } else {
      print('❌ Auth failed: ${response.statusCode}');
      print('Response: $responseBody');
      return;
    }
    
    client.close();
  } catch (e) {
    print('❌ Auth error: $e');
    return;
  }
  
  // Step 2: Test API with different auth methods
  print('\n2️⃣ Testing Recipe API with Access Token...');
  
  const String apiUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/recipes';
  
  try {
    final client = HttpClient();
    final request = await client.getUrl(Uri.parse(apiUrl));
    request.headers.set('Authorization', 'Bearer $accessToken');
    request.headers.set('Content-Type', 'application/json');
    
    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();
    
    print('📊 API Response Status: ${response.statusCode}');
    print('📄 API Response Headers:');
    response.headers.forEach((name, values) {
      print('   $name: ${values.join(', ')}');
    });
    print('📝 API Response Body: $responseBody');
    
    client.close();
  } catch (e) {
    print('❌ API error: $e');
  }
  
  // Step 3: Test with ID Token
  print('\n3️⃣ Testing Recipe API with ID Token...');
  
  try {
    final client = HttpClient();
    final request = await client.getUrl(Uri.parse(apiUrl));
    request.headers.set('Authorization', 'Bearer $idToken');
    request.headers.set('Content-Type', 'application/json');
    
    final response = await request.close();
    final responseBody = await response.transform(utf8.decoder).join();
    
    print('📊 API Response Status: ${response.statusCode}');
    print('📝 API Response Body: $responseBody');
    
    client.close();
  } catch (e) {
    print('❌ API error: $e');
  }
  
  // Step 4: Test different endpoints
  print('\n4️⃣ Testing API Health/Info endpoints...');
  
  final endpoints = [
    '/prod',
    '/prod/health',
    '/prod/info',
    '/prod/status',
  ];
  
  for (final endpoint in endpoints) {
    try {
      final client = HttpClient();
      final fullUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com$endpoint';
      final request = await client.getUrl(Uri.parse(fullUrl));
      
      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();
      
      print('📍 $endpoint: ${response.statusCode} - ${responseBody.length > 100 ? responseBody.substring(0, 100) + '...' : responseBody}');
      
      client.close();
    } catch (e) {
      print('📍 $endpoint: Error - $e');
    }
  }
  
  print('\n🏁 API Debug Complete!');
}
