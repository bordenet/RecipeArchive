import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'advanced_search_service.dart';
import 'auth_service.dart';

// Enhanced analytics service with S3 integration for unified cross-device insights
// Cost: ~$0.10-0.50/month for all users combined

// Search analytics event types
enum SearchEventType {
  search,
  resultClick,
  filterApplied,
  searchCleared,
}

// Device types for cross-device analytics
enum DeviceType {
  ios,
  android,
  web,
  unknown,
}

// Enhanced analytics event structure for S3 storage
class UnifiedAnalyticsEvent {
  final String eventId;
  final String? userId; // Set by backend
  final SearchEventType eventType;
  final DateTime timestamp;
  final DeviceType deviceType;
  final String? query;
  final int? resultCount;
  final int? responseTimeMs;
  final Map<String, dynamic>? filters;
  final String? clickedRecipeId;
  final int? clickPosition;

  const UnifiedAnalyticsEvent({
    required this.eventId,
    this.userId,
    required this.eventType,
    required this.timestamp,
    required this.deviceType,
    this.query,
    this.resultCount,
    this.responseTimeMs,
    this.filters,
    this.clickedRecipeId,
    this.clickPosition,
  });

  Map<String, dynamic> toJson() => {
    'eventId': eventId,
    'userId': userId,
    'eventType': eventType.name,
    'timestamp': timestamp.toIso8601String(),
    'deviceType': deviceType.name,
    'query': query,
    'resultCount': resultCount,
    'responseTimeMs': responseTimeMs,
    'filters': filters,
    'clickedRecipeId': clickedRecipeId,
    'clickPosition': clickPosition,
  };

  factory UnifiedAnalyticsEvent.fromJson(Map<String, dynamic> json) => 
    UnifiedAnalyticsEvent(
      eventId: json['eventId'],
      userId: json['userId'],
      eventType: SearchEventType.values.byName(json['eventType']),
      timestamp: DateTime.parse(json['timestamp']),
      deviceType: _parseDeviceType(json['deviceType']),
      query: json['query'],
      resultCount: json['resultCount'],
      responseTimeMs: json['responseTimeMs'],
      filters: json['filters'],
      clickedRecipeId: json['clickedRecipeId'],
      clickPosition: json['clickPosition'],
    );

  static DeviceType _parseDeviceType(dynamic value) {
    if (value is String) {
      for (DeviceType type in DeviceType.values) {
        if (type.name == value) return type;
      }
    }
    return DeviceType.unknown;
  }
}

// Unified analytics summary from S3
class UnifiedAnalyticsSummary {
  final String userId;
  final String month;
  final int totalSearches;
  final int totalClicks;
  final int averageResponseTimeMs;
  final double averageResultCount;
  final Map<String, int> popularQueries;
  final Map<String, int> popularFilters;
  final Map<String, int> deviceBreakdown;
  final Map<String, int> topClickedRecipes;
  final DateTime lastUpdated;

  const UnifiedAnalyticsSummary({
    required this.userId,
    required this.month,
    required this.totalSearches,
    required this.totalClicks,
    required this.averageResponseTimeMs,
    required this.averageResultCount,
    required this.popularQueries,
    required this.popularFilters,
    required this.deviceBreakdown,
    required this.topClickedRecipes,
    required this.lastUpdated,
  });

  factory UnifiedAnalyticsSummary.fromJson(Map<String, dynamic> json) => 
    UnifiedAnalyticsSummary(
      userId: json['userId'] ?? '',
      month: json['month'] ?? '',
      totalSearches: json['totalSearches'] ?? 0,
      totalClicks: json['totalClicks'] ?? 0,
      averageResponseTimeMs: json['averageResponseTimeMs'] ?? 0,
      averageResultCount: (json['averageResultCount'] ?? 0.0).toDouble(),
      popularQueries: Map<String, int>.from(json['popularQueries'] ?? {}),
      popularFilters: Map<String, int>.from(json['popularFilters'] ?? {}),
      deviceBreakdown: Map<String, int>.from(json['deviceBreakdown'] ?? {}),
      topClickedRecipes: Map<String, int>.from(json['topClickedRecipes'] ?? {}),
      lastUpdated: DateTime.parse(json['lastUpdated'] ?? DateTime.now().toIso8601String()),
    );

  Map<String, dynamic> toJson() => {
    'userId': userId,
    'month': month,
    'totalSearches': totalSearches,
    'totalClicks': totalClicks,
    'averageResponseTimeMs': averageResponseTimeMs,
    'averageResultCount': averageResultCount,
    'popularQueries': popularQueries,
    'popularFilters': popularFilters,
    'deviceBreakdown': deviceBreakdown,
    'topClickedRecipes': topClickedRecipes,
    'lastUpdated': lastUpdated.toIso8601String(),
  };
}

class UnifiedAnalyticsService {
  static const String _localEventsKey = 'unified_analytics_events';
  static const String _lastSyncKey = 'last_sync_timestamp';
  static const int _maxLocalEvents = 100; // Smaller buffer for hybrid approach
  static const int _syncIntervalMinutes = 5; // Sync every 5 minutes for better UX
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static String get _baseUrl =>
      dotenv.env['API_BASE_URL'] ??
      'https://your-api-gateway-id.execute-api.us-west-2.amazonaws.com/prod';

  final AuthenticationService _authService;

  UnifiedAnalyticsService(this._authService);

  // Detect device type
  DeviceType get _deviceType {
    if (kIsWeb) return DeviceType.web;
    if (Platform.isIOS) return DeviceType.ios;
    if (Platform.isAndroid) return DeviceType.android;
    return DeviceType.unknown;
  }

  // Track search performance with hybrid local/cloud storage
  Future<void> trackSearch({
    required String query,
    required int resultCount,
    required int responseTimeMs,
    required SearchParameters searchParams,
  }) async {
    final event = UnifiedAnalyticsEvent(
      eventId: DateTime.now().millisecondsSinceEpoch.toString(),
      eventType: SearchEventType.search,
      timestamp: DateTime.now(),
      deviceType: _deviceType,
      query: query.isNotEmpty ? query : null,
      resultCount: resultCount,
      responseTimeMs: responseTimeMs,
      filters: _extractFilters(searchParams),
    );

    await _storeLocalEvent(event);
    await _attemptSync(); // Try to sync if interval passed

    if (kDebugMode) {
      print('📊 Unified search tracked: query="$query", results=$resultCount, time=${responseTimeMs}ms, device=${_deviceType.name}');
      // Force immediate sync for debugging
      print('🔄 Forcing immediate sync for debugging...');
      syncToS3(); // Don't await, sync in background
    }
  }

  // Track result clicks
  Future<void> trackResultClick({
    required String recipeId,
    required int clickPosition,
    String? query,
  }) async {
    final event = UnifiedAnalyticsEvent(
      eventId: DateTime.now().millisecondsSinceEpoch.toString(),
      eventType: SearchEventType.resultClick,
      timestamp: DateTime.now(),
      deviceType: _deviceType,
      query: query,
      clickedRecipeId: recipeId,
      clickPosition: clickPosition,
    );

    await _storeLocalEvent(event);
    await _attemptSync();

    if (kDebugMode) {
      print('🎯 Unified click tracked: recipe=$recipeId, position=$clickPosition, device=${_deviceType.name}');
    }
  }

  // Track filter usage
  Future<void> trackFilterApplied(String filterType, String filterValue) async {
    final event = UnifiedAnalyticsEvent(
      eventId: DateTime.now().millisecondsSinceEpoch.toString(),
      eventType: SearchEventType.filterApplied,
      timestamp: DateTime.now(),
      deviceType: _deviceType,
      filters: {filterType: filterValue},
    );

    await _storeLocalEvent(event);
    await _attemptSync();

    if (kDebugMode) {
      print('🔍 Unified filter tracked: $filterType=$filterValue, device=${_deviceType.name}');
    }
  }

  // Get unified analytics summary from S3 (cross-device)
  Future<UnifiedAnalyticsSummary> getUnifiedSummary({String? month}) async {
    // Try to sync any pending local events first
    await syncToS3();

    try {
      final token = await _getAuthToken();
      if (token == null) {
        throw Exception('No authentication token available');
      }

      final queryParams = month != null ? '?month=$month' : '';
      final response = await http.get(
        Uri.parse('$_baseUrl/analytics/summary$queryParams'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return UnifiedAnalyticsSummary.fromJson(data);
      } else {
        if (kDebugMode) print('Failed to get unified summary: ${response.statusCode}');
        throw Exception('Failed to load analytics summary');
      }
    } catch (e) {
      if (kDebugMode) print('Error getting unified summary: $e');
      
      // Return empty summary as fallback
      return UnifiedAnalyticsSummary(
        userId: '',
        month: month ?? DateTime.now().toString().substring(0, 7),
        totalSearches: 0,
        totalClicks: 0,
        averageResponseTimeMs: 0,
        averageResultCount: 0.0,
        popularQueries: {},
        popularFilters: {},
        deviceBreakdown: {},
        topClickedRecipes: {},
        lastUpdated: DateTime.now(),
      );
    }
  }

  // Force sync local events to S3
  Future<bool> syncToS3() async {
    if (kDebugMode) print('🔄 Starting analytics sync to S3...');

    try {
      final localEvents = await _getLocalEvents();
      if (localEvents.isEmpty) {
        if (kDebugMode) print('📊 No local events to sync');
        return true;
      }

      if (kDebugMode) print('📊 Found ${localEvents.length} local events to sync');

      final token = await _getAuthToken();
      if (token == null) {
        if (kDebugMode) print('⚠️ No auth token for sync - user not authenticated');
        return false;
      }

      if (kDebugMode) print('🔑 Auth token obtained, sending to API...');

      final response = await http.post(
        Uri.parse('$_baseUrl/analytics/events'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'events': localEvents.map((e) => e.toJson()).toList(),
        }),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 201 || response.statusCode == 200) {
        await _clearLocalEvents();
        await _storage.write(key: _lastSyncKey, value: DateTime.now().toIso8601String());

        if (kDebugMode) {
          print('✅ Successfully synced ${localEvents.length} analytics events to S3!');
        }
        return true;
      } else {
        if (kDebugMode) {
          print('❌ Failed to sync events - Status: ${response.statusCode}');
          print('❌ Response body: ${response.body}');
        }
        return false;
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Analytics sync error: $e');
        print('📍 Stack trace: ${StackTrace.current}');
      }
      return false;
    }
  }

  // Clear all analytics data
  Future<void> clearAnalytics() async {
    await _clearLocalEvents();
    await _storage.delete(key: _lastSyncKey);
    
    if (kDebugMode) print('🧹 Unified analytics data cleared');
  }

  // Private helper methods
  Future<void> _storeLocalEvent(UnifiedAnalyticsEvent event) async {
    try {
      final events = await _getLocalEvents();
      events.add(event);
      
      // Limit local storage size
      if (events.length > _maxLocalEvents) {
        events.sort((a, b) => b.timestamp.compareTo(a.timestamp));
        events.removeRange(_maxLocalEvents, events.length);
      }
      
      final eventsJson = events.map((e) => e.toJson()).toList();
      await _storage.write(key: _localEventsKey, value: jsonEncode(eventsJson));
    } catch (e) {
      if (kDebugMode) print('Error storing local event: $e');
    }
  }

  Future<List<UnifiedAnalyticsEvent>> _getLocalEvents() async {
    try {
      final eventsJson = await _storage.read(key: _localEventsKey);
      if (eventsJson != null) {
        final eventsList = jsonDecode(eventsJson) as List;
        return eventsList.map((e) => UnifiedAnalyticsEvent.fromJson(e)).toList();
      }
    } catch (e) {
      if (kDebugMode) print('Error reading local events: $e');
    }
    return [];
  }

  Future<void> _clearLocalEvents() async {
    await _storage.delete(key: _localEventsKey);
  }

  Future<void> _attemptSync() async {
    try {
      final lastSyncStr = await _storage.read(key: _lastSyncKey);
      final lastSync = lastSyncStr != null ? DateTime.parse(lastSyncStr) : null;
      
      if (lastSync == null || DateTime.now().difference(lastSync).inMinutes >= _syncIntervalMinutes) {
        // Don't await - sync in background
        syncToS3();
      }
    } catch (e) {
      if (kDebugMode) print('Sync attempt error: $e');
    }
  }

  Future<String?> _getAuthToken() async {
    try {
      // Get token from auth service
      final user = _authService.currentUser;
      if (user == null) {
        if (kDebugMode) print('⚠️ No authenticated user for analytics sync');
        return null;
      }
      return user.idToken;
    } catch (e) {
      if (kDebugMode) print('❌ Error getting auth token for analytics: $e');
      return null;
    }
  }

  Map<String, dynamic> _extractFilters(SearchParameters params) {
    final filters = <String, dynamic>{};
    
    if (params.maxPrepTime != null) filters['maxPrepTime'] = params.maxPrepTime;
    if (params.maxCookTime != null) filters['maxCookTime'] = params.maxCookTime;
    
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
}

// Riverpod provider
final unifiedAnalyticsServiceProvider = Provider((ref) {
  final authService = ref.read(authServiceProvider);
  return UnifiedAnalyticsService(authService);
});