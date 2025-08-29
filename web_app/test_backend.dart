import 'dart:convert';
import 'dart:io';

/// Simple test script to verify AWS backend connectivity
/// Run with: dart run test_backend.dart
void main() async {
  print('🔍 Testing AWS Backend Connection...');
  
  const baseUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';
  const testEndpoint = '$baseUrl/v1/health';
  
  try {
    // Create HTTP client
    final client = HttpClient();
    
    // Test health endpoint first
    print('📡 Testing health endpoint: $testEndpoint');
    
    final healthRequest = await client.getUrl(Uri.parse(testEndpoint));
    final healthResponse = await healthRequest.close();
    
    if (healthResponse.statusCode == 200) {
      print('✅ Health check passed');
      
      // Now try to get recipes (this will likely fail without auth)
      print('📡 Testing recipes endpoint...');
      
      const recipesEndpoint = '$baseUrl/v1/recipes';
      final recipesRequest = await client.getUrl(Uri.parse(recipesEndpoint));
      final recipesResponse = await recipesRequest.close();
      
      print('📊 Recipes endpoint status: ${recipesResponse.statusCode}');
      
      if (recipesResponse.statusCode == 401) {
        print('🔐 Authentication required (expected for recipes endpoint)');
      } else if (recipesResponse.statusCode == 200) {
        final responseBody = await recipesResponse.transform(utf8.decoder).join();
        final jsonData = json.decode(responseBody);
        print('✅ Recipes response: ${jsonData.toString().substring(0, 100)}...');
      }
      
    } else {
      print('❌ Health check failed: ${healthResponse.statusCode}');
    }
    
    client.close();
    
  } catch (e) {
    print('❌ Connection error: $e');
  }
  
  print('\n🎯 Next steps:');
  print('1. Backend is reachable, but authentication is required');
  print('2. Need to implement AWS Cognito JWT token handling');
  print('3. Use hardcoded credentials from recipe-report tool for testing');
}
