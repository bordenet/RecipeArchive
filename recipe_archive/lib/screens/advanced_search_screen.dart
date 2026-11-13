import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../services/advanced_search_service.dart';
import '../services/unified_analytics_service.dart';
import '../widgets/recipe_card.dart';
import 'recipe_detail_screen.dart';

// Provider for search state management
final searchParametersProvider = StateProvider<SearchParameters>((ref) => 
  const SearchParameters(limit: 20, sortBy: 'createdAt', sortOrder: 'desc'));

final searchResultProvider = FutureProvider.autoDispose.family<SearchResult, SearchParameters>(
  (ref, parameters) async {
    final searchService = ref.read(advancedSearchServiceProvider);
    final analyticsService = ref.read(unifiedAnalyticsServiceProvider);

    // Track search performance
    final stopwatch = Stopwatch()..start();
    final result = await searchService.searchRecipes(parameters);
    stopwatch.stop();

    // Only track analytics for actual user-initiated searches (not empty default searches)
    final hasValidSearchCriteria = parameters.query?.isNotEmpty == true ||
        parameters.semanticTags?.isNotEmpty == true ||
        parameters.primaryIngredients?.isNotEmpty == true ||
        parameters.cookingMethods?.isNotEmpty == true ||
        parameters.dietaryTags?.isNotEmpty == true ||
        parameters.flavorProfile?.isNotEmpty == true ||
        parameters.equipment?.isNotEmpty == true ||
        parameters.mealType?.isNotEmpty == true ||
        parameters.source?.isNotEmpty == true ||
        parameters.timeCategory != null ||
        parameters.complexity != null ||
        parameters.maxPrepTime != null ||
        parameters.maxCookTime != null ||
        parameters.maxTotalTime != null;

    if (hasValidSearchCriteria) {
      // Track search analytics only for intentional searches
      await analyticsService.trackSearch(
        query: parameters.query ?? '',
        resultCount: result.recipes.length,
        responseTimeMs: stopwatch.elapsedMilliseconds,
        searchParams: parameters,
      );
    }

    return result;
  },
);
