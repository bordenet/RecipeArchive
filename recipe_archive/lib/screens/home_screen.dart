import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/paginated_recipe_service.dart';
import '../services/auth_service.dart';
import '../widgets/recipe_card.dart';
import '../widgets/onboarding_content.dart';
import '../utils/platform_detection.dart';
import 'recipe_detail_screen.dart';
import 'extensions_screen.dart';
import 'mobile_apps_screen.dart';
import 'backup_screen.dart';
import 'advanced_search_screen.dart';
import 'search_analytics_screen.dart';
import 'admin/invitation_management_screen.dart';
import 'admin/developer_settings_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class SortingDropdown extends ConsumerWidget {
  const SortingDropdown({super.key});

  static const Map<String, String> _sortOptions = {
    'createdAt:desc': 'Newest First',
    'createdAt:asc': 'Oldest First',
    'title:asc': 'Title A-Z',
    'title:desc': 'Title Z-A',
    'prepTime:asc': 'Prep Time: Low to High',
    'prepTime:desc': 'Prep Time: High to Low',
    'cookTime:asc': 'Cook Time: Low to High',
    'cookTime:desc': 'Cook Time: High to Low',
    'servings:asc': 'Servings: Low to High',
    'servings:desc': 'Servings: High to Low',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recipesState = ref.watch(paginatedRecipesProvider);
    final notifier = ref.read(paginatedRecipesProvider.notifier);

    return PopupMenuButton<String>(
      onSelected: (value) {
        final parts = value.split(':');
        if (parts.length == 2) {
          notifier.changeSorting(parts[0], parts[1]);
        }
      },
      itemBuilder: (BuildContext context) {
        return _sortOptions.entries.map((entry) {
          return PopupMenuItem<String>(
            value: entry.key,
            child: Text(entry.value),
          );
        }).toList();
      },
      color: Colors.green[800],
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.sort, color: Colors.white, size: 20),
          const SizedBox(width: 4),
          Text(
            _sortOptions['${recipesState.sortBy}:${recipesState.sortOrder}']!,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: Colors.white),
          ),
          const Icon(Icons.arrow_drop_down, color: Colors.white),
        ],
      ),
    );
  }
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();

    // Set up infinite scroll listener
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent - 200) {
        // Load more when user scrolls within 200 pixels of the bottom
        final recipesNotifier = ref.read(paginatedRecipesProvider.notifier);
        final recipesState = ref.read(paginatedRecipesProvider);
        if (recipesState.hasMore && !recipesState.isLoadingMore) {
          recipesNotifier.loadMoreRecipes();
        }
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final recipesState = ref.watch(paginatedRecipesProvider);
    ref.watch(autoLoadRecipesProvider);

    return LayoutBuilder(builder: (context, constraints) {
      const double compactLayoutThreshold = 650.0;
      final bool isCompact = constraints.maxWidth < compactLayoutThreshold;

      PreferredSizeWidget? appBarBottom;
      if (isCompact) {
        appBarBottom = PreferredSize(
          preferredSize: const Size.fromHeight(30.0), // Reduced height
          child: Padding(
            padding:
                const EdgeInsets.fromLTRB(16.0, 0, 16.0, 0), // Reduced padding
            child: Row(
              children: [
                const Expanded(child: SortingDropdown()),
                const SizedBox(width: 16),
                if (recipesState.total != null)
                  Text(
                    '(${recipesState.recipes.length} of ${recipesState.total})',
                    style: TextStyle(
                      fontSize: Theme.of(context).textTheme.bodySmall!.fontSize,
                      color: Colors.white70,
                    ),
                  ),
              ],
            ),
          ),
        );
      }

      Widget appBarTitle;
      if (isCompact) {
        appBarTitle = const Text('Recipe Archive');
      } else {
        appBarTitle = Row(
          children: [
            const Text('Recipe Archive'),
            const Spacer(),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SortingDropdown(),
                const SizedBox(width: 24),
                if (recipesState.total != null)
                  Text(
                    '(${recipesState.recipes.length} of ${recipesState.total})',
                    style: const TextStyle(fontSize: 14, color: Colors.white70),
                  ),
              ],
            ),
            const Spacer(),
          ],
        );
      }

      return Scaffold(
        appBar: AppBar(
          title: appBarTitle,
          bottom: appBarBottom,
          backgroundColor: Colors.green,
          foregroundColor: Colors.white,
          elevation: 2,
          actions: [
            IconButton(
              icon: const Icon(Icons.search),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => const AdvancedSearchScreen(),
                  ),
                );
              },
              tooltip: 'Advanced search',
            ),
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () {
                ref.read(paginatedRecipesProvider.notifier).refreshRecipes();
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
                selectedTileColor: Colors.green.withAlpha(25),
                onTap: () {
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(Icons.search),
                title: const Text('Advanced Search'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => const AdvancedSearchScreen(),
                    ),
                  );
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
              if (!PlatformDetection.isMobile)
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
                leading: const Icon(Icons.analytics),
                title: const Text('Search Analytics'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => const SearchAnalyticsScreen(),
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
              if (_isUserAdmin()) ...[
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.admin_panel_settings),
                  title: const Text('Invitation Management'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) =>
                            const InvitationManagementScreen(),
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.developer_mode),
                  title: const Text('Developer Settings'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => const DeveloperSettingsScreen(),
                      ),
                    );
                  },
                ),
              ],
            ],
          ),
        ),
        body: _buildRecipesList(recipesState),
      );
    });
  }

  Widget _buildRecipesList(PaginatedRecipesState recipesState) {
    // Show loading for initial load
    if (recipesState.isLoading && recipesState.recipes.isEmpty) {
      return const Center(
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
      );
    }

    // Show error for initial load
    if (recipesState.error != null && recipesState.recipes.isEmpty) {
      return Center(
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
                recipesState.error!,
                style: const TextStyle(color: Colors.grey),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 16),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ElevatedButton(
                  onPressed: () {
                    ref
                        .read(paginatedRecipesProvider.notifier)
                        .refreshRecipes();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Retry'),
                ),
                if (recipesState.error!.contains('Authentication expired') ||
                    recipesState.error!.contains('401') ||
                    recipesState.error!.contains('sign in'))
                  Padding(
                    padding: const EdgeInsets.only(top: 8.0),
                    child: ElevatedButton(
                      onPressed: () async {
                        await ref.read(authStateProvider.notifier).signOut();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.orange,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Sign In Again'),
                    ),
                  ),
              ],
            ),
          ],
        ),
      );
    }

    // Show onboarding if no recipes
    if (recipesState.recipes.isEmpty) {
      return const OnboardingContent();
    }

    // Show recipes with pagination
    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(paginatedRecipesProvider.notifier).refreshRecipes();
      },
      child: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // Recipes grid
          SliverPadding(
            padding: const EdgeInsets.all(8),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final recipe = recipesState.recipes[index];

                  // Check if we should load more (when near the end)
                  ref
                      .read(paginatedRecipesProvider.notifier)
                      .checkLoadMore(index);

                  return RecipeCard(
                    recipe: recipe,
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) =>
                              RecipeDetailScreen(recipe: recipe),
                        ),
                      );
                    },
                  );
                },
                childCount: recipesState.recipes.length,
              ),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: _getCrossAxisCount(context),
                childAspectRatio: _getChildAspectRatio(context),
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
            ),
          ),

          // Loading more indicator
          if (recipesState.isLoadingMore)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Center(
                  child: Column(
                    children: [
                      CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.green),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Loading more recipes...',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // End of list indicator
          if (!recipesState.hasMore && recipesState.recipes.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: Text(
                    'All recipes loaded',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ),

          // Error loading more
          if (recipesState.error != null && recipesState.recipes.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: Column(
                    children: [
                      Text(
                        'Error loading more recipes',
                        style: TextStyle(color: Colors.red[600]),
                      ),
                      const SizedBox(height: 8),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ElevatedButton(
                            onPressed: () {
                              ref
                                  .read(paginatedRecipesProvider.notifier)
                                  .loadMoreRecipes();
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Try Again'),
                          ),
                          if (recipesState.error!
                                  .contains('Authentication expired') ||
                              recipesState.error!.contains('401') ||
                              recipesState.error!.contains('sign in'))
                            Padding(
                              padding: const EdgeInsets.only(top: 8.0),
                              child: ElevatedButton(
                                onPressed: () async {
                                  await ref
                                      .read(authStateProvider.notifier)
                                      .signOut();
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.orange,
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('Sign In Again'),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // Helper methods for responsive layout - restore original dense layout
  int _getCrossAxisCount(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;

    if (screenWidth > 1400) {
      return 5; // Restore original 5 columns for very wide screens
    } else if (screenWidth > 1100) {
      return 4; // Restore original 4 columns for wide screens
    } else if (screenWidth > 800) {
      return 3; // Restore original 3 columns for medium screens
    } else if (screenWidth > 600) {
      return 2; // Restore original 2 columns for tablets
    } else {
      return 1; // Single column for mobile
    }
  }

  double _getChildAspectRatio(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;

    // Responsive aspect ratios: lower = taller cards, higher = shorter cards
    // SIGNIFICANTLY increased ratios to make cards 25% wider and 15% shorter
    if (screenWidth > 1400) {
      return 1.22; // Much wider and shorter for 5 columns (0.85 × 1.4375)
    } else if (screenWidth > 1100) {
      return 1.29; // Much wider and shorter for 4 columns (0.9 × 1.4375)
    } else if (screenWidth > 800) {
      return 1.44; // Wider and shorter for 3 columns (1.0 × 1.4375)
    } else if (screenWidth > 600) {
      return 1.58; // Wider and shorter for 2 columns (1.1 × 1.4375)
    } else {
      return 1.87; // Much wider and shorter for single column (1.3 × 1.4375)
    }
  }

  bool _isUserAdmin() {
    final authState = ref.read(authStateProvider);
    final user = authState.value;

    // Check if user is authenticated and email matches admin email
    const adminEmail = 'mattbordenet@hotmail.com'; // From .env ADMIN_EMAIL
    return user != null && user.email == adminEmail;
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
        const SizedBox(height: 20),
        const Divider(),
        const SizedBox(height: 12),
        const Text(
          '💖 Dedicated to Susan Cameron-Bordenet-- the love of my life. 💖',
          style: TextStyle(
            fontStyle: FontStyle.italic,
            color: Colors.deepPurple,
            fontWeight: FontWeight.w500,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
