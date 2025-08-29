import 'lib/services/auth_service.dart';

void main() async {
  print('🔐 Testing Authentication in Flutter Context');
  
  final authService = AuthService();
  
  try {
    print('\n🔍 Testing authentication...');
    final success = await authService.authenticate('mattbordenet@hotmail.com', 'Recipe123');
    
    if (success) {
      print('✅ Authentication successful!');
      
      // Test getting headers
      final headers = await authService.getAuthHeaders();
      print('\n📋 Auth Headers:');
      headers.forEach((key, value) {
        if (key == 'Authorization') {
          print('  $key: ${value.substring(0, 20)}...[truncated]');
        } else {
          print('  $key: $value');
        }
      });
      
    } else {
      print('❌ Authentication failed');
    }
    
  } catch (e) {
    print('❌ Error: $e');
  }
}
