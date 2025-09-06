import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'advanced_search_service.dart';

// Search analytics event types
enum SearchEventType {
  search,
  resultClick,
  filterApplied,
  searchCleared,
}

// Analytics data structure
class SearchAnalyticsEvent {
  final String eventId;
  final SearchEventType eventType;
  final DateTime timestamp;
  final String? query;
  final int? resultCount;
  final int? responseTimeMs;
  final Map<String, dynamic>? filters;
  final String? clickedRecipeId;
  final int? clickPosition;

  const SearchAnalyticsEvent({
    required this.eventId,
    required this.eventType,
    required this.timestamp,
    this.query,
    this.resultCount,
    this.responseTimeMs,
    this.filters,
    this.clickedRecipeId,
    this.clickPosition,
  });

  Map<String, dynamic> toJson() => {
    'eventId': eventId,
    'eventType': eventType.name,
    'timestamp': timestamp.toIso8601String(),
    'query': query,
    'resultCount': resultCount,
    'responseTimeMs': responseTimeMs,
    'filters': filters,
    'clickedRecipeId': clickedRecipeId,
    'clickPosition': clickPosition,
  };

  factory SearchAnalyticsEvent.fromJson(Map<String, dynamic> json) => 
    SearchAnalyticsEvent(
      eventId: json['eventId'],
      eventType: SearchEventType.values.byName(json['eventType']),
      timestamp: DateTime.parse(json['timestamp']),
      query: json['query'],
      resultCount: json['resultCount'],
      responseTimeMs: json['responseTimeMs'],
      filters: json['filters'],
      clickedRecipeId: json['clickedRecipeId'],
      clickPosition: json['clickPosition'],
    );
}

// Search performance metrics
class SearchMetrics {
  final int totalSearches;
  final int averageResponseTimeMs;
  final double averageResultCount;
  final Map<String, int> popularQueries;
  final Map<String, int> popularFilters;
  final DateTime lastUpdated;

  const SearchMetrics({
    required this.totalSearches,
    required this.averageResponseTimeMs,
    required this.averageResultCount,
    required this.popularQueries,
    required this.popularFilters,
    required this.lastUpdated,
  });

  Map<String, dynamic> toJson() => {
    'totalSearches': totalSearches,
    'averageResponseTimeMs': averageResponseTimeMs,
    'averageResultCount': averageResultCount,
    'popularQueries': popularQueries,
    'popularFilters': popularFilters,
    'lastUpdated': lastUpdated.toIso8601String(),
  };

  factory SearchMetrics.fromJson(Map<String, dynamic> json) => SearchMetrics(
    totalSearches: json['totalSearches'] ?? 0,
    averageResponseTimeMs: json['averageResponseTimeMs'] ?? 0,
    averageResultCount: (json['averageResultCount'] ?? 0.0).toDouble(),
    popularQueries: Map<String, int>.from(json['popularQueries'] ?? {}),
    popularFilters: Map<String, int>.from(json['popularFilters'] ?? {}),
    lastUpdated: DateTime.parse(json['lastUpdated'] ?? DateTime.now().toIso8601String()),
  );
}

class SearchAnalyticsService {
  static const String _analyticsKey = 'search_analytics';
  static const String _metricsKey = 'search_metrics';
  static const int _maxStoredEvents = 1000; // Limit local storage usage
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  // Track search performance
  Future<void> trackSearch({
    required String query,
    required int resultCount,
    required int responseTimeMs,
    required SearchParameters searchParams,
  }) async {
    final event = SearchAnalyticsEvent(
      eventId: DateTime.now().millisecondsSinceEpoch.toString(),
      eventType: SearchEventType.search,
      timestamp: DateTime.now(),
      query: query.isNotEmpty ? query : null,
      resultCount: resultCount,
      responseTimeMs: responseTimeMs,
      filters: _extractFilters(searchParams),
    );

    await _storeEvent(event);
    await _updateMetrics(event);

    if (kDebugMode) {
      print('📊 Search tracked: query="$query", results=$resultCount, time=${responseTimeMs}ms');
    }
  }

  // Track when users click on search results
  Future<void> trackResultClick({
    required String recipeId,
    required int clickPosition,
    String? query,
  }) async {
    final event = SearchAnalyticsEvent(
      eventId: DateTime.now().millisecondsSinceEpoch.toString(),
      eventType: SearchEventType.resultClick,
      timestamp: DateTime.now(),
      query: query,
      clickedRecipeId: recipeId,
      clickPosition: clickPosition,
    );

    await _storeEvent(event);

    if (kDebugMode) {
      print('🎯 Click tracked: recipe=$recipeId, position=$clickPosition');
    }
  }

  // Track filter usage
  Future<void> trackFilterApplied(String filterType, String filterValue) async {
    final event = SearchAnalyticsEvent(
      eventId: DateTime.now().millisecondsSinceEpoch.toString(),
      eventType: SearchEventType.filterApplied,
      timestamp: DateTime.now(),
      filters: {filterType: filterValue},
    );

    await _storeEvent(event);

    if (kDebugMode) {
      print('🔍 Filter tracked: $filterType=$filterValue');
    }
  }

  // Get current search metrics
  Future<SearchMetrics> getMetrics() async {
    try {
      final metricsJson = await _storage.read(key: _metricsKey);
      if (metricsJson != null) {
        return SearchMetrics.fromJson(jsonDecode(metricsJson));
      }
    } catch (e) {
      if (kDebugMode) print('Error reading metrics: $e');
    }

    // Return empty metrics if none exist
    return SearchMetrics(
      totalSearches: 0,
      averageResponseTimeMs: 0,
      averageResultCount: 0.0,
      popularQueries: {},
      popularFilters: {},
      lastUpdated: DateTime.now(),
    );
  }

  // Get recent search events (for debugging/analysis)
  Future<List<SearchAnalyticsEvent>> getRecentEvents({int limit = 50}) async {
    try {
      final eventsJson = await _storage.read(key: _analyticsKey);
      if (eventsJson != null) {
        final eventsList = jsonDecode(eventsJson) as List;
        return eventsList
            .map((e) => SearchAnalyticsEvent.fromJson(e))
            .toList()
            ..sort((a, b) => b.timestamp.compareTo(a.timestamp))
            ..take(limit);
      }
    } catch (e) {
      if (kDebugMode) print('Error reading events: $e');
    }
    return [];
  }

  // Clear analytics data (for privacy/storage management)
  Future<void> clearAnalytics() async {
    await _storage.delete(key: _analyticsKey);
    await _storage.delete(key: _metricsKey);
    
    if (kDebugMode) print('🧹 Analytics data cleared');
  }

  // Private helper methods
  Map<String, dynamic> _extractFilters(SearchParameters params) {
    final filters = <String, dynamic>{};
    
    if (params.minPrepTime != null) filters['minPrepTime'] = params.minPrepTime;
    if (params.maxPrepTime != null) filters['maxPrepTime'] = params.maxPrepTime;
    if (params.minCookTime != null) filters['minCookTime'] = params.minCookTime;
    if (params.maxCookTime != null) filters['maxCookTime'] = params.maxCookTime;
    if (params.minTotalTime != null) filters['minTotalTime'] = params.minTotalTime;
    if (params.maxTotalTime != null) filters['maxTotalTime'] = params.maxTotalTime;
    if (params.minServings != null) filters['minServings'] = params.minServings;
    if (params.maxServings != null) filters['maxServings'] = params.maxServings;
    
    if (params.semanticTags != null && params.semanticTags!.isNotEmpty) {
      filters['semanticTags'] = params.semanticTags!.length;
    }
    if (params.primaryIngredients != null && params.primaryIngredients!.isNotEmpty) {
      filters['primaryIngredients'] = params.primaryIngredients!.length;
    }
    if (params.cookingMethods != null && params.cookingMethods!.isNotEmpty) {
      filters['cookingMethods'] = params.cookingMethods!.length;
    }
    if (params.dietaryTags != null && params.dietaryTags!.isNotEmpty) {
      filters['dietaryTags'] = params.dietaryTags!.length;
    }
    
    if (params.mealType != null) filters['mealType'] = params.mealType;
    if (params.timeCategory != null) filters['timeCategory'] = params.timeCategory;
    if (params.complexity != null) filters['complexity'] = params.complexity;
    if (params.source != null) filters['source'] = 1;
    
    filters['sortBy'] = params.sortBy ?? 'createdAt';
    filters['sortOrder'] = params.sortOrder ?? 'desc';
    
    return filters;
  }

  Future<void> _storeEvent(SearchAnalyticsEvent event) async {
    try {
      // Get existing events
      final eventsJson = await _storage.read(key: _analyticsKey);
      List<Map<String, dynamic>> events = [];
      
      if (eventsJson != null) {
        final eventsList = jsonDecode(eventsJson) as List;
        events = eventsList.cast<Map<String, dynamic>>();
      }
      
      // Add new event
      events.add(event.toJson());
      
      // Limit storage size by keeping only recent events
      if (events.length > _maxStoredEvents) {
        events.sort((a, b) => DateTime.parse(b['timestamp'])
            .compareTo(DateTime.parse(a['timestamp'])));
        events = events.take(_maxStoredEvents).toList();
      }
      
      // Store updated events
      await _storage.write(key: _analyticsKey, value: jsonEncode(events));
    } catch (e) {
      if (kDebugMode) print('Error storing analytics event: $e');
    }
  }

  Future<void> _updateMetrics(SearchAnalyticsEvent event) async {
    if (event.eventType != SearchEventType.search) return;
    
    try {
      final currentMetrics = await getMetrics();
      
      // Update query popularity
      final popularQueries = Map<String, int>.from(currentMetrics.popularQueries);
      if (event.query != null && event.query!.isNotEmpty) {
        final query = event.query!.toLowerCase().trim();
        popularQueries[query] = (popularQueries[query] ?? 0) + 1;
        
        // Keep only top 50 queries to limit storage
        if (popularQueries.length > 50) {
          final sorted = popularQueries.entries.toList()
            ..sort((a, b) => b.value.compareTo(a.value));
          popularQueries.clear();
          popularQueries.addAll(Map.fromEntries(sorted.take(50)));
        }
      }
      
      // Update filter popularity
      final popularFilters = Map<String, int>.from(currentMetrics.popularFilters);
      if (event.filters != null) {
        for (final filter in event.filters!.entries) {
          if (filter.value != null) {
            final key = '${filter.key}:${filter.value}';
            popularFilters[key] = (popularFilters[key] ?? 0) + 1;
          }
        }
        
        // Keep only top 100 filters
        if (popularFilters.length > 100) {
          final sorted = popularFilters.entries.toList()
            ..sort((a, b) => b.value.compareTo(a.value));
          popularFilters.clear();
          popularFilters.addAll(Map.fromEntries(sorted.take(100)));
        }
      }
      
      // Calculate new averages
      final newTotalSearches = currentMetrics.totalSearches + 1;
      final newAverageResponseTime = ((currentMetrics.averageResponseTimeMs * currentMetrics.totalSearches) + 
          (event.responseTimeMs ?? 0)) ~/ newTotalSearches;
      final newAverageResultCount = ((currentMetrics.averageResultCount * currentMetrics.totalSearches) + 
          (event.resultCount ?? 0)) / newTotalSearches;
      
      // Create updated metrics
      final updatedMetrics = SearchMetrics(
        totalSearches: newTotalSearches,
        averageResponseTimeMs: newAverageResponseTime,
        averageResultCount: newAverageResultCount,
        popularQueries: popularQueries,
        popularFilters: popularFilters,
        lastUpdated: DateTime.now(),
      );
      
      // Store updated metrics
      await _storage.write(key: _metricsKey, value: jsonEncode(updatedMetrics.toJson()));
    } catch (e) {
      if (kDebugMode) print('Error updating metrics: $e');
    }
  }
}

// Riverpod provider
final searchAnalyticsServiceProvider = Provider((ref) => SearchAnalyticsService());