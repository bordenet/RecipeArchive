import 'dart:convert';
import 'dart:developer' as developer;
import 'package:http/http.dart' as http;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../models/recipe.dart';
import 'auth_service.dart';

// Pagination state model
class PaginatedRecipesState {
  final List<Recipe> recipes;
  final String? nextCursor;
  final bool hasMore;
  final int? total;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final String sortBy;
  final String sortOrder;

  const PaginatedRecipesState({
    this.recipes = const [],
    this.nextCursor,
    this.hasMore = false,
    this.total,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.sortBy = 'createdAt',
    this.sortOrder = 'desc',
  });

  PaginatedRecipesState copyWith({
    List<Recipe>? recipes,
    String? nextCursor,
    bool? hasMore,
    int? total,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    String? sortBy,
    String? sortOrder,
  }) {
    return PaginatedRecipesState(
      recipes: recipes ?? this.recipes,
      nextCursor: nextCursor ?? this.nextCursor,
      hasMore: hasMore ?? this.hasMore,
      total: total ?? this.total,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: error,
      sortBy: sortBy ?? this.sortBy,
      sortOrder: sortOrder ?? this.sortOrder,
    );
  }
}

// Paginated recipes notifier
class PaginatedRecipesNotifier extends StateNotifier<PaginatedRecipesState> {
  final AuthenticationService _authService;
  static const int _defaultPageSize = 20; // Load 20 recipes per page initially

  PaginatedRecipesNotifier(this._authService) : super(const PaginatedRecipesState());

  String get apiUrl => dotenv.env['API_BASE_URL'] ??
      'https://your-api-gateway-id.execute-api.us-west-2.amazonaws.com/prod';

  // Load initial page of recipes
  Future<void> loadInitialRecipes({int limit = _defaultPageSize}) async {
    if (state.isLoading) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final user = _authService.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final queryParams = <String, String>{
        'limit': limit.toString(),
        'sortBy': state.sortBy,
        'sortOrder': state.sortOrder,
      };

      final uri = Uri.parse('$apiUrl/recipes').replace(queryParameters: queryParams);

      developer.log('Loading initial recipes from: $uri', name: 'PaginatedRecipeService');
      
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
        },
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> recipesJson = data['recipes'] ?? [];
        final pagination = data['pagination'] ?? {};

        final recipes = recipesJson.map((json) => Recipe.fromJson(json)).toList();
        
        developer.log('Loaded ${recipes.length} recipes (initial page)', name: 'PaginatedRecipeService');

        state = state.copyWith(
          recipes: recipes,
          nextCursor: pagination['nextCursor'],
          hasMore: pagination['hasMore'] ?? false,
          total: pagination['total'],
          isLoading: false,
        );
      } else if (response.statusCode == 401) {
        developer.log('Authentication error: 401 Unauthorized', name: 'PaginatedRecipeService', level: 1000);
        
        // Attempt automatic token refresh and retry
        final retrySuccessful = await _handleAuthenticationError(
          retryOperation: () async {
            // Retry the loadInitialRecipes operation
            await loadInitialRecipes(limit: limit);
          },
        );
        
        if (!retrySuccessful) {
          // Only show error if all retry attempts failed
          state = state.copyWith(
            isLoading: false,
            error: 'Authentication expired. Please sign in again.',
          );
        }
        // If retry was successful, the state will be updated by the retry operation
        return;
      } else {
        developer.log('API error: ${response.statusCode} - ${response.body}', name: 'PaginatedRecipeService', level: 1000);
        state = state.copyWith(
          isLoading: false,
          error: 'Failed to load recipes: ${response.statusCode}',
        );
      }
    } catch (e) {
      developer.log('Network error: $e', name: 'PaginatedRecipeService', error: e, level: 1000);
      state = state.copyWith(
        isLoading: false,
        error: 'Network error: $e',
      );
    }
  }

  // Load next page of recipes
  Future<void> loadMoreRecipes({int limit = _defaultPageSize}) async {
    if (state.isLoadingMore || !state.hasMore || state.nextCursor == null) return;

    state = state.copyWith(isLoadingMore: true, error: null);

    try {
      final user = _authService.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      final queryParams = <String, String>{
        'limit': limit.toString(),
        'cursor': state.nextCursor!,
        'sortBy': state.sortBy,
        'sortOrder': state.sortOrder,
      };

      final uri = Uri.parse('$apiUrl/recipes').replace(queryParameters: queryParams);

      developer.log('Loading more recipes from: $uri', name: 'PaginatedRecipeService');

      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
        },
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> recipesJson = data['recipes'] ?? [];
        final pagination = data['pagination'] ?? {};

        final newRecipes = recipesJson.map((json) => Recipe.fromJson(json)).toList();
        
        developer.log('Loaded ${newRecipes.length} additional recipes', name: 'PaginatedRecipeService');

        state = state.copyWith(
          recipes: [...state.recipes, ...newRecipes],
          nextCursor: pagination['nextCursor'],
          hasMore: pagination['hasMore'] ?? false,
          total: pagination['total'],
          isLoadingMore: false,
        );
      } else if (response.statusCode == 401) {
        developer.log('Authentication error: 401 Unauthorized', name: 'PaginatedRecipeService', level: 1000);
        
        // Attempt automatic token refresh and retry
        final retrySuccessful = await _handleAuthenticationError(
          retryOperation: () async {
            // Retry the loadMoreRecipes operation
            await loadMoreRecipes(limit: limit);
          },
        );
        
        if (!retrySuccessful) {
          // Only show error if all retry attempts failed
          state = state.copyWith(
            isLoadingMore: false,
            error: 'Authentication expired. Please sign in again.',
          );
        }
        // If retry was successful, the state will be updated by the retry operation
        return;
      } else {
        developer.log('API error: ${response.statusCode} - ${response.body}', name: 'PaginatedRecipeService', level: 1000);
        state = state.copyWith(
          isLoadingMore: false,
          error: 'Failed to load more recipes: ${response.statusCode}',
        );
      }
    } catch (e) {
      developer.log('Network error: $e', name: 'PaginatedRecipeService', error: e, level: 1000);
      state = state.copyWith(
        isLoadingMore: false,
        error: 'Network error: $e',
      );
    }
  }

  // Refresh recipes (clear cache and reload from beginning)
  Future<void> refreshRecipes({int limit = _defaultPageSize}) async {
    state = const PaginatedRecipesState(); // Reset state
    await loadInitialRecipes(limit: limit);
  }

  // Handle 401 errors with automatic token refresh and retry logic
  Future<bool> _handleAuthenticationError({
    required Future<void> Function() retryOperation,
    int retryCount = 0,
  }) async {
    const int maxRetryAttempts = 3;
    const int baseDelayMs = 1000; // Start with 1 second
    
    try {
      developer.log('Authentication error detected, attempting token refresh (attempt ${retryCount + 1}/$maxRetryAttempts)', 
                   name: 'PaginatedRecipeService');
      
      // Attempt to refresh authentication
      final isAuthenticated = await _authService.isAuthenticated();
      if (isAuthenticated) {
        developer.log('Token refresh successful, retrying operation', name: 'PaginatedRecipeService');
        
        // Retry the original operation
        await retryOperation();
        return true;
      } else {
        // Authentication refresh failed
        if (retryCount < maxRetryAttempts - 1) {
          final delay = Duration(milliseconds: baseDelayMs * (1 << retryCount)); // Exponential backoff
          developer.log('Authentication refresh failed, retrying in ${delay.inMilliseconds}ms...', 
                       name: 'PaginatedRecipeService');
          
          await Future.delayed(delay);
          return await _handleAuthenticationError(
            retryOperation: retryOperation,
            retryCount: retryCount + 1,
          );
        } else {
          developer.log('Authentication refresh exhausted all retry attempts. User may need to sign in again.', 
                       name: 'PaginatedRecipeService', level: 1000);
          return false;
        }
      }
    } catch (e) {
      developer.log('Error during authentication refresh (attempt ${retryCount + 1}): $e', 
                   name: 'PaginatedRecipeService', error: e, level: 1000);
      
      // Retry on error too
      if (retryCount < maxRetryAttempts - 1) {
        final delay = Duration(milliseconds: baseDelayMs * (1 << retryCount)); // Exponential backoff
        developer.log('Retrying authentication refresh after error in ${delay.inMilliseconds}ms...', 
                     name: 'PaginatedRecipeService');
        
        await Future.delayed(delay);
        return await _handleAuthenticationError(
          retryOperation: retryOperation,
          retryCount: retryCount + 1,
        );
      } else {
        developer.log('Authentication refresh exhausted all retry attempts due to errors. User may need to sign in again.', 
                     name: 'PaginatedRecipeService', level: 1000);
        return false;
      }
    }
  }

  // Add a new recipe to the list (for optimistic updates)
  void addRecipe(Recipe recipe) {
    state = state.copyWith(
      recipes: [recipe, ...state.recipes],
      total: state.total != null ? state.total! + 1 : null,
    );
  }

  // Update an existing recipe in the list
  void updateRecipe(Recipe updatedRecipe) {
    final recipes = state.recipes.map((recipe) {
      return recipe.id == updatedRecipe.id ? updatedRecipe : recipe;
    }).toList();
    
    state = state.copyWith(recipes: recipes);
  }

  // Remove a recipe from the list
  void removeRecipe(String recipeId) {
    final recipes = state.recipes.where((recipe) => recipe.id != recipeId).toList();
    state = state.copyWith(
      recipes: recipes,
      total: state.total != null ? state.total! - 1 : null,
    );
  }

  // Check if we should load more (called when user scrolls near bottom)
  void checkLoadMore(int currentIndex) {
    // Load more when user is within 5 items of the end
    if (currentIndex >= state.recipes.length - 5 && state.hasMore && !state.isLoadingMore) {
      loadMoreRecipes();
    }
  }

  // Change sorting and reload recipes
  Future<void> changeSorting(String sortBy, String sortOrder) async {
    // If sorting hasn't changed, do nothing
    if (state.sortBy == sortBy && state.sortOrder == sortOrder) {
      return;
    }

    // Update sorting parameters and reload from beginning
    state = state.copyWith(
      sortBy: sortBy,
      sortOrder: sortOrder,
      recipes: [], // Clear existing recipes
      nextCursor: null,
      hasMore: false,
      total: null,
      error: null,
    );

    await loadInitialRecipes();
  }
}

// Provider for paginated recipes
final paginatedRecipesProvider = StateNotifierProvider<PaginatedRecipesNotifier, PaginatedRecipesState>((ref) {
  final authService = ref.read(authServiceProvider);
  return PaginatedRecipesNotifier(authService);
});

// Helper provider to auto-load recipes when auth state changes
final autoLoadRecipesProvider = Provider((ref) {
  final authState = ref.watch(authStateProvider);
  final recipesNotifier = ref.read(paginatedRecipesProvider.notifier);

  // Auto-load recipes when user is authenticated and recipes are empty
  authState.whenData((user) {
    if (user != null) {
      final recipesState = ref.read(paginatedRecipesProvider);
      if (recipesState.recipes.isEmpty && !recipesState.isLoading && recipesState.error == null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          recipesNotifier.loadInitialRecipes();
        });
      }
    }
  });

  return recipesNotifier;
});