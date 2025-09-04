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
  static const String _baseUrl = 'https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod';

  Future<DiagnosticSummary?> getDiagnosticSummary() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/v1/diagnostic-processor'),
        headers: {
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return DiagnosticSummary.fromJson(data);
      } else {
        // ignore: avoid_print
        print('Failed to load diagnostic data: ${response.statusCode}');
        return null;
      }
    } catch (e) {
      // ignore: avoid_print
      print('Error fetching diagnostic data: $e');
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
}