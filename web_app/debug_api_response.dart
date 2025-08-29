import 'dart:convert';
import 'package:http/http.dart' as http;
import 'lib/services/auth_service.dart';

void main() async {
  print('🔍 Debugging API Response Format');
  
  final authService = AuthService();
  
  try {
    // Authenticate
    final success = await authService.authenticate('mattbordenet@hotmail.com', 'Recipe123');
    
    if (!success) {
      print('❌ Authentication failed');
      return;
    }
    
    print('✅ Authentication successful!');
    
    // Make raw API call to see response format
    final headers = await authService.getAuthHeaders();
    final uri = Uri.parse('https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod/v1/recipes');
    
    print('\n📡 Making raw API call...');
    final response = await http.get(uri, headers: headers);
    
    if (response.statusCode == 200) {
      final jsonData = json.decode(response.body);
      print('\n📋 Raw API Response:');
      print('Response type: ${jsonData.runtimeType}');
      print('JSON structure:');
      print(JsonEncoder.withIndent('  ').convert(jsonData));
      
      // Check if recipes field exists
      if (jsonData is Map && jsonData.containsKey('recipes')) {
        final recipes = jsonData['recipes'];
        print('\n🔍 Recipes field analysis:');
        print('Recipes type: ${recipes.runtimeType}');
        print('Recipes length: ${recipes.length}');
        
        if (recipes.isNotEmpty) {
          print('\n📖 First recipe structure:');
          print(JsonEncoder.withIndent('  ').convert(recipes[0]));
        }
      }
      
    } else {
      print('❌ API call failed: ${response.statusCode}');
      print('Response: ${response.body}');
    }
    
  } catch (e) {
    print('❌ Error: $e');
  }
}
