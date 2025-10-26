import 'package:http/http.dart' as http;
import 'dart:convert';

class DiagnosticSummary {
  final int totalFailures;
  final Map<String, int> failuresByDomain;
  final Map<String, int> failuresByType;
  final List<PatternAnalysis> commonPatterns;
  final List<FailureDetails> recentFailures;
  final List<ParserSuggestion> parserSuggestions;
  final DateTime lastAnalyzed;

  const DiagnosticSummary({
    required this.totalFailures,
    required this.failuresByDomain,
    required this.failuresByType,
    required this.commonPatterns,
    required this.recentFailures,
    required this.parserSuggestions,
    required this.lastAnalyzed,
  });

  factory DiagnosticSummary.fromJson(Map<String, dynamic> json) {
    return DiagnosticSummary(
      totalFailures: json['totalFailures'] ?? 0,
      failuresByDomain: Map<String, int>.from(json['failuresByDomain'] ?? {}),
      failuresByType: Map<String, int>.from(json['failuresByType'] ?? {}),
      commonPatterns: (json['commonPatterns'] as List<dynamic>? ?? [])
          .map((p) => PatternAnalysis.fromJson(p))
          .toList(),
      recentFailures: (json['recentFailures'] as List<dynamic>? ?? [])
          .map((f) => FailureDetails.fromJson(f))
          .toList(),
      parserSuggestions: (json['parserSuggestions'] as List<dynamic>? ?? [])
          .map((s) => ParserSuggestion.fromJson(s))
          .toList(),
      lastAnalyzed: DateTime.parse(json['lastAnalyzed']),
    );
  }
}

class PatternAnalysis {
  final String pattern;
  final int count;
  final String description;
  final String severity;

  const PatternAnalysis({
    required this.pattern,
    required this.count,
    required this.description,
    required this.severity,
  });

  factory PatternAnalysis.fromJson(Map<String, dynamic> json) {
    return PatternAnalysis(
      pattern: json['pattern'] ?? '',
      count: json['count'] ?? 0,
      description: json['description'] ?? '',
      severity: json['severity'] ?? 'low',
    );
  }
}

class FailureDetails {
  final String url;
  final String domain;
  final String errorType;
  final String errorMessage;
  final DateTime timestamp;
  final String userAgent;
  final String? s3Path;

  const FailureDetails({
    required this.url,
    required this.domain,
    required this.errorType,
    required this.errorMessage,
    required this.timestamp,
    required this.userAgent,
    this.s3Path,
  });

  factory FailureDetails.fromJson(Map<String, dynamic> json) {
    return FailureDetails(
      url: json['url'] ?? '',
      domain: json['domain'] ?? '',
      errorType: json['errorType'] ?? '',
      errorMessage: json['errorMessage'] ?? '',
      timestamp: DateTime.parse(json['timestamp']),
      userAgent: json['userAgent'] ?? '',
      s3Path: json['s3Path'],
    );
  }
}

class ParserSuggestion {
  final String domain;
  final String priority;
  final String issue;
  final String suggestion;
  final List<String> examples;
  final double confidence;

  const ParserSuggestion({
    required this.domain,
    required this.priority,
    required this.issue,
    required this.suggestion,
    required this.examples,
    required this.confidence,
  });

  factory ParserSuggestion.fromJson(Map<String, dynamic> json) {
    return ParserSuggestion(
      domain: json['domain'] ?? '',
      priority: json['priority'] ?? 'low',
      issue: json['issue'] ?? '',
      suggestion: json['suggestion'] ?? '',
      examples: List<String>.from(json['examples'] ?? []),
      confidence: (json['confidence'] ?? 0.0).toDouble(),
    );
  }
}

class DiagnosticService {
  static const String _baseUrl = 'https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod';

  /// Report a Flutter error to the diagnostic endpoint
  Future<bool> reportError({
    required String errorMessage,
    required String stackTrace,
    required String errorType,
    String? context,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final errorReport = {
        'timestamp': DateTime.now().toIso8601String(),
        'url': Uri.base.toString(),
        'userAgent': 'Flutter Web App',
        'errorType': errorType,
        'error': errorMessage,
        'context': 'flutter-web',
        'extension': 'flutter-web',
        'platform': 'flutter_web',
        'stackTrace': stackTrace,
        'metadata': metadata,
      };

      // Wrap in errors array format expected by endpoint
      final requestBody = {
        'errors': [errorReport]
      };

      final response = await http.post(
        Uri.parse('$_baseUrl/report-error'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode(requestBody),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Error reported successfully to diagnostics endpoint
        return true;
      } else {
        // Failed to report error: ${response.statusCode}
        return false;
      }
    } catch (e) {
      // Error reporting failed: $e
      return false;
    }
  }

  Future<DiagnosticSummary?> getDiagnosticSummary() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/diagnostic-processor'),
        headers: {
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return DiagnosticSummary.fromJson(data);
      } else {
        // Failed to load diagnostic data: ${response.statusCode}
        return null;
      }
    } catch (e) {
      // Error fetching diagnostic data: $e
      return null;
    }
  }

  String getPriorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'blue';
      default:
        return 'grey';
    }
  }

  String getSeverityColor(String severity) {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'green';
      default:
        return 'grey';
    }
  }

  String formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  double getConfidencePercentage(double confidence) {
    return (confidence * 100).round().toDouble();
  }

  /// Report mobile share failure to diagnostic backend
  /// This is for mobile app share extension failures (iOS/Android)
  Future<bool> reportMobileShareFailure({
    required String url,
    required String errorType,
    required String userId,
    required String authToken,
    String? errorDetails,
    String? browserContext,
    String platform = 'unknown',
  }) async {
    try {
      final payload = {
        'event_type': 'mobile_share_failure',
        'url': url,
        'error_type': errorType,
        'platform': platform,
        'app_version': '1.0.0', // TODO: Get from package info
        'user_id': userId,
        'timestamp': DateTime.now().toIso8601String(),
        if (errorDetails != null) 'error_details': errorDetails,
        if (browserContext != null) 'browser_context': browserContext,
      };

      final response = await http.post(
        Uri.parse('https://d1jcaphz4458q7.cloudfront.net/api/v1/diagnostics/mobile-share-failure'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode(payload),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      // Diagnostic reporting should never crash the app
      return false;
    }
  }
}