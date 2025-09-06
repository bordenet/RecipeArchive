import 'dart:convert';
import 'dart:developer' as developer;
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../models/recipe.dart';
import 'auth_service.dart';

// Provider for the AdvancedSearchService
final advancedSearchServiceProvider = Provider<AdvancedSearchService>((ref) {
  final authService = ref.read(authServiceProvider);
  return AdvancedSearchService(authService);
});

// Search parameters class for comprehensive search
class SearchParameters {
  // Basic text search
  final String? query;
  
  // Time-based filtering
  final int? minPrepTime;
  final int? maxPrepTime;
  final int? minCookTime;
  final int? maxCookTime;
  
  // Servings filtering
  final int? minServings;
  final int? maxServings;
  
  // Advanced SearchMetadata filtering (cost-optimized)
  final List<String>? semanticTags;
  final List<String>? primaryIngredients;
  final List<String>? cookingMethods;
  final List<String>? dietaryTags;
  final List<String>? flavorProfile;
  final List<String>? equipment;
  final String? timeCategory;
  final String? complexity;
  
  // Source filtering
  final String? source;
  
  // Sorting and pagination
  final String? sortBy;
  final String? sortOrder;
  final int? limit;
  final String? cursor;

  const SearchParameters({
    this.query,
    this.minPrepTime,
    this.maxPrepTime,
    this.minCookTime,
    this.maxCookTime,
    this.minServings,
    this.maxServings,
    this.semanticTags,
    this.primaryIngredients,
    this.cookingMethods,
    this.dietaryTags,
    this.flavorProfile,
    this.equipment,
    this.timeCategory,
    this.complexity,
    this.source,
    this.sortBy,
    this.sortOrder,
    this.limit,
    this.cursor,
  });

  Map<String, String> toQueryParameters() {
    final params = <String, String>{};
    
    if (query != null && query!.isNotEmpty) params['q'] = query!;
    if (minPrepTime != null) params['minPrepTime'] = minPrepTime.toString();
    if (maxPrepTime != null) params['maxPrepTime'] = maxPrepTime.toString();
    if (minCookTime != null) params['minCookTime'] = minCookTime.toString();
    if (maxCookTime != null) params['maxCookTime'] = maxCookTime.toString();
    if (minServings != null) params['minServings'] = minServings.toString();
    if (maxServings != null) params['maxServings'] = maxServings.toString();
    
    if (semanticTags != null && semanticTags!.isNotEmpty) {
      params['semanticTags'] = semanticTags!.join(',');
    }
    if (primaryIngredients != null && primaryIngredients!.isNotEmpty) {
      params['primaryIngredients'] = primaryIngredients!.join(',');
    }
    if (cookingMethods != null && cookingMethods!.isNotEmpty) {
      params['cookingMethods'] = cookingMethods!.join(',');
    }
    if (dietaryTags != null && dietaryTags!.isNotEmpty) {
      params['dietaryTags'] = dietaryTags!.join(',');
    }
    if (flavorProfile != null && flavorProfile!.isNotEmpty) {
      params['flavorProfile'] = flavorProfile!.join(',');
    }
    if (equipment != null && equipment!.isNotEmpty) {
      params['equipment'] = equipment!.join(',');
    }
    
    if (timeCategory != null && timeCategory!.isNotEmpty) {
      params['timeCategory'] = timeCategory!;
    }
    if (complexity != null && complexity!.isNotEmpty) {
      params['complexity'] = complexity!;
    }
    if (source != null && source!.isNotEmpty) {
      params['source'] = source!;
    }
    if (sortBy != null && sortBy!.isNotEmpty) {
      params['sortBy'] = sortBy!;
    }
    if (sortOrder != null && sortOrder!.isNotEmpty) {
      params['sortOrder'] = sortOrder!;
    }
    if (limit != null) params['limit'] = limit.toString();
    if (cursor != null && cursor!.isNotEmpty) params['cursor'] = cursor!;
    
    return params;
  }

  SearchParameters copyWith({
    String? query,
    int? minPrepTime,
    int? maxPrepTime,
    int? minCookTime,
    int? maxCookTime,
    int? minServings,
    int? maxServings,
    List<String>? semanticTags,
    List<String>? primaryIngredients,
    List<String>? cookingMethods,
    List<String>? dietaryTags,
    List<String>? flavorProfile,
    List<String>? equipment,
    String? timeCategory,
    String? complexity,
    String? source,
    String? sortBy,
    String? sortOrder,
    int? limit,
    String? cursor,
  }) {
    return SearchParameters(
      query: query ?? this.query,
      minPrepTime: minPrepTime ?? this.minPrepTime,
      maxPrepTime: maxPrepTime ?? this.maxPrepTime,
      minCookTime: minCookTime ?? this.minCookTime,
      maxCookTime: maxCookTime ?? this.maxCookTime,
      minServings: minServings ?? this.minServings,
      maxServings: maxServings ?? this.maxServings,
      semanticTags: semanticTags ?? this.semanticTags,
      primaryIngredients: primaryIngredients ?? this.primaryIngredients,
      cookingMethods: cookingMethods ?? this.cookingMethods,
      dietaryTags: dietaryTags ?? this.dietaryTags,
      flavorProfile: flavorProfile ?? this.flavorProfile,
      equipment: equipment ?? this.equipment,
      timeCategory: timeCategory ?? this.timeCategory,
      complexity: complexity ?? this.complexity,
      source: source ?? this.source,
      sortBy: sortBy ?? this.sortBy,
      sortOrder: sortOrder ?? this.sortOrder,
      limit: limit ?? this.limit,
      cursor: cursor ?? this.cursor,
    );
  }
}

// Search result with pagination info
class SearchResult {
  final List<Recipe> recipes;
  final int total;
  final bool hasMore;
  final String? nextCursor;

  const SearchResult({
    required this.recipes,
    required this.total,
    required this.hasMore,
    this.nextCursor,
  });
}

// Advanced search service with comprehensive filtering
class AdvancedSearchService {
  final AuthenticationService _authService;
  
  AdvancedSearchService(this._authService);
  
  String get apiUrl => dotenv.env['API_BASE_URL'] ?? 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';

  // Comprehensive search using new backend endpoint
  Future<SearchResult> searchRecipes(SearchParameters parameters) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }
    
    final queryParams = parameters.toQueryParameters();
    final uri = Uri.parse('$apiUrl/v1/recipes/search').replace(queryParameters: queryParams);
    
    try {
      developer.log('Advanced search query: $uri', name: 'AdvancedSearchService');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${user.idToken}',
        },
      );
      
      developer.log('Search API response: ${response.statusCode}', name: 'AdvancedSearchService');
      
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> recipesJson = data['recipes'] ?? [];
        final Map<String, dynamic> pagination = data['pagination'] ?? {};
        
        final recipes = recipesJson.map((json) => Recipe.fromJson(json)).toList();
        
        developer.log('Advanced search returned ${recipes.length} recipes', name: 'AdvancedSearchService');
        
        return SearchResult(
          recipes: recipes,
          total: pagination['total'] ?? 0,
          hasMore: pagination['hasMore'] ?? false,
          nextCursor: pagination['nextCursor'],
        );
      } else {
        developer.log('Search API error: ${response.statusCode} - ${response.body}', name: 'AdvancedSearchService', level: 1000);
        throw Exception('Failed to search recipes: ${response.statusCode}');
      }
    } catch (e) {
      developer.log('Search network error: $e', name: 'AdvancedSearchService', error: e, level: 1000);
      throw Exception('Network error during search: $e');
    }
  }

  // Quick search with just text query (convenience method)
  Future<List<Recipe>> quickSearch(String query) async {
    final parameters = SearchParameters(query: query, limit: 20);
    final result = await searchRecipes(parameters);
    return result.recipes;
  }

  // Predefined search filters for common use cases
  static const List<String> commonSemanticTags = [
    'italian', 'comfort-food', 'healthy', 'quick', 'vegetarian', 'dessert', 'breakfast',
    'dinner', 'snack', 'appetizer', 'main-course', 'side-dish', 'soup', 'salad'
  ];

  static const List<String> commonCookingMethods = [
    'baked', 'grilled', 'sauteed', 'boiled', 'roasted', 'fried', 'steamed',
    'braised', 'slow-cooked', 'pressure-cooked', 'no-cook', 'microwave'
  ];

  static const List<String> commonDietaryTags = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-carb',
    'keto', 'paleo', 'whole30', 'mediterranean', 'low-sodium', 'sugar-free'
  ];

  static const List<String> commonFlavorProfiles = [
    'savory', 'sweet', 'spicy', 'tangy', 'herbed', 'smoky', 'rich', 'fresh',
    'creamy', 'crispy', 'zesty', 'mild', 'bold', 'aromatic'
  ];

  static const List<String> commonEquipment = [
    'oven', 'stovetop', 'slow-cooker', 'pressure-cooker', 'air-fryer', 'grill',
    'food-processor', 'blender', 'stand-mixer', 'large-pot', 'skillet', 'baking-sheet'
  ];

  static const List<String> timeCategories = [
    'quick-15min', 'medium-30min', 'long-60min', 'extended-120min'
  ];

  static const List<String> complexityLevels = [
    'beginner', 'intermediate', 'advanced'
  ];

  static const List<String> sortOptions = [
    'createdAt', 'title', 'prepTime', 'cookTime', 'servings'
  ];
}