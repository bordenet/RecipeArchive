import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/recipe_service.dart';
import '../services/auth_service.dart';
import '../widgets/recipe_card.dart';
import 'recipe_detail_screen.dart';
import 'extensions_screen.dart';
import 'mobile_apps_screen.dart';
import 'backup_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recipesAsync = ref.watch(recipesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Recipe Archive'),
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
        elevation: 2,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(recipesProvider);
            },
            tooltip: 'Refresh recipes',
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.account_circle),
            onSelected: (value) async {
              if (value == 'logout') {
                await ref.read(authStateProvider.notifier).signOut();
              }
            },
            itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
              const PopupMenuItem<String>(
                value: 'logout',
                child: ListTile(
                  leading: Icon(Icons.logout),
                  title: Text('Sign Out'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const DrawerHeader(
              decoration: BoxDecoration(
                color: Colors.green,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.restaurant_menu,
                    color: Colors.white,
                    size: 48,
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Recipe Archive',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'Capture & organize recipes',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.home),
              title: const Text('Recipes'),
              selected: true,
              selectedTileColor: Colors.green.withValues(alpha: 0.1),
              onTap: () {
                Navigator.pop(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.extension),
              title: const Text('Browser Extensions'),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => const ExtensionsScreen(),
                  ),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.phone_android),
              title: const Text('Mobile Apps'),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => const MobileAppsScreen(),
                  ),
                );
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.backup),
              title: const Text('Backup & Restore'),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => const BackupScreen(),
                  ),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('About'),
              onTap: () {
                Navigator.pop(context);
                _showAboutDialog(context);
              },
            ),
          ],
        ),
      ),
      body: recipesAsync.when(
        data: (recipes) {
          if (recipes.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.restaurant_menu,
                    size: 64,
                    color: Colors.grey,
                  ),
                  SizedBox(height: 16),
                  Text(
                    'No recipes found',
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.grey,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Add your first recipe to get started!',
                    style: TextStyle(
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(recipesProvider);
            },
            child: LayoutBuilder(
              builder: (context, constraints) {
                // Improved responsive grid with better breakpoints and minimum sizing
                int crossAxisCount = 1;
                double childAspectRatio = 0.85;
                double minCardWidth = 280; // Minimum card width to ensure content fits
                
                // Calculate optimal number of columns based on min/max width constraints
                double availableWidth = constraints.maxWidth - 24; // Account for padding
                int maxColumns = (availableWidth / minCardWidth).floor();
                
                if (constraints.maxWidth > 1600) {
                  crossAxisCount = (maxColumns > 6) ? 6 : maxColumns; // Max 6 columns
                  childAspectRatio = 0.72; // Taller for more columns
                } else if (constraints.maxWidth > 1300) {
                  crossAxisCount = (maxColumns > 5) ? 5 : maxColumns; // Max 5 columns
                  childAspectRatio = 0.75; 
                } else if (constraints.maxWidth > 1000) {
                  crossAxisCount = (maxColumns > 4) ? 4 : maxColumns; // Max 4 columns
                  childAspectRatio = 0.78;
                } else if (constraints.maxWidth > 700) {
                  crossAxisCount = (maxColumns > 3) ? 3 : maxColumns; // Max 3 columns
                  childAspectRatio = 0.82;
                } else if (constraints.maxWidth > 600) {
                  crossAxisCount = 2; // 2 columns for medium narrow screens
                  childAspectRatio = 1.1; // Much taller to prevent text truncation
                } else {
                  // Single column for very narrow screens
                  crossAxisCount = 1;
                  childAspectRatio = 1.5; // Even taller for single column to show all content
                }
                
                // Ensure we have at least 1 column
                crossAxisCount = crossAxisCount < 1 ? 1 : crossAxisCount;

                return GridView.builder(
                  padding: const EdgeInsets.all(12), // Better padding
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: crossAxisCount,
                    childAspectRatio: childAspectRatio,
                    crossAxisSpacing: 12, // Better spacing
                    mainAxisSpacing: 12, // Better spacing
                  ),
                  itemCount: recipes.length,
                  itemBuilder: (context, index) {
                    final recipe = recipes[index];
                    return RecipeCard(
                      recipe: recipe,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => RecipeDetailScreen(recipe: recipe),
                          ),
                        );
                      },
                    );
                  },
                );
              },
            ),
          );
        },
        loading: () => const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Colors.green),
              ),
              SizedBox(height: 16),
              Text(
                'Loading recipes...',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
        error: (error, stackTrace) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.red,
              ),
              const SizedBox(height: 16),
              Text(
                'Error loading recipes',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: Colors.red,
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Text(
                  error.toString(),
                  style: const TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  ref.invalidate(recipesProvider);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showAboutDialog(
      context: context,
      applicationName: 'Recipe Archive',
      applicationVersion: '1.0.0',
      applicationIcon: const Icon(
        Icons.restaurant_menu,
        size: 48,
        color: Colors.green,
      ),
      children: [
        const Text(
          'Capture, organize, and manage your favorite recipes from across the web.',
        ),
        const SizedBox(height: 16),
        const Text(
          'Supported sites include Smitten Kitchen, Food52, NYT Cooking, Alexandra\'s Kitchen, and many more.',
        ),
        const SizedBox(height: 16),
        const Text(
          'Download our browser extensions to get started capturing recipes!',
        ),
      ],
    );
  }
}
