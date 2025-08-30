import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/simple_home_screen.dart';
import 'theme/app_theme.dart';

void main() async {
  // Ensure Flutter binding is initialized
  WidgetsFlutterBinding.ensureInitialized();
  
  // Skip env loading for now to avoid hanging
  print('� Starting Recipe Archive app...');
  
  runApp(const ProviderScope(child: RecipeArchiveApp()));
}

class RecipeArchiveApp extends StatelessWidget {
  const RecipeArchiveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recipe Archive',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const SimpleHomeScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
