import "package:logger/logger.dart";

/// Centralized logging infrastructure for RecipeArchive Flutter app.
///
/// Provides consistent, structured logging with privacy controls and
/// production-grade observability similar to Swift's os.Logger and
/// Kotlin's android.util.Log.
///
/// Usage:
/// ```dart
/// AppLogger.auth.info("User logged in", userId: user.id);
/// AppLogger.network.error("API request failed", url: url, error: error);
/// ```
class AppLogger {
  // Singleton logger instances per category
  static final CategoryLogger auth = CategoryLogger("Auth");
  static final CategoryLogger network = CategoryLogger("Network");
  static final CategoryLogger recipe = CategoryLogger("Recipe");
  static final CategoryLogger storage = CategoryLogger("Storage");
  static final CategoryLogger share = CategoryLogger("Share");
  static final CategoryLogger backup = CategoryLogger("Backup");
  static final CategoryLogger analytics = CategoryLogger("Analytics");
  static final CategoryLogger ui = CategoryLogger("UI");

  AppLogger._(); // Private constructor to prevent instantiation
}

/// Category-specific logger with structured logging support.
///
/// Wraps the `logger` package to provide:
/// - Consistent metadata formatting
/// - Privacy controls for sensitive data
/// - Production-ready log levels
class CategoryLogger {
  final String category;
  late final Logger _logger;

  CategoryLogger(this.category) {
    _logger = Logger(
      printer: _RecipeArchivePrinter(category),
      level: Level.debug, // TODO: Use Level.info for production builds
    );
  }

  /// Debug-level logging (development only, disabled in production)
  void debug(String message, {Map<String, dynamic>? metadata}) {
    _logger.d(message, error: metadata);
  }

  /// Info-level logging (normal operations)
  void info(String message, {Map<String, dynamic>? metadata}) {
    _logger.i(message, error: metadata);
  }

  /// Warning-level logging (recoverable errors)
  void warning(String message, {Map<String, dynamic>? metadata}) {
    _logger.w(message, error: metadata);
  }

  /// Error-level logging (critical failures)
  void error(String message, {Map<String, dynamic>? metadata, Object? error, StackTrace? stackTrace}) {
    final combinedMetadata = <String, dynamic>{
      if (metadata != null) ...metadata,
      if (error != null) "errorDetails": error.toString(),
    };
    _logger.e(message, error: combinedMetadata, stackTrace: stackTrace);
  }

  /// Fatal-level logging (unrecoverable errors)
  void fatal(String message, {Map<String, dynamic>? metadata, Object? error, StackTrace? stackTrace}) {
    final combinedMetadata = <String, dynamic>{
      if (metadata != null) ...metadata,
      if (error != null) "errorDetails": error.toString(),
    };
    _logger.f(message, error: combinedMetadata, stackTrace: stackTrace);
  }

  /// Redact sensitive data (URLs, user IDs, recipe titles) for privacy.
  ///
  /// Example:
  /// ```dart
  /// AppLogger.network.info("Downloading image", metadata: {
  ///   "url": AppLogger.network.redact(imageUrl)
  /// });
  /// ```
  String redact(String? sensitiveData) {
    if (sensitiveData == null || sensitiveData.isEmpty) {
      return "<null>";
    }
    // Show first and last 4 characters, redact middle
    if (sensitiveData.length <= 8) {
      return "<redacted>";
    }
    final prefix = sensitiveData.substring(0, 4);
    final suffix = sensitiveData.substring(sensitiveData.length - 4);
    return "$prefix...$suffix";
  }
}

/// Custom log printer that formats logs with category and metadata.
///
/// Output format:
/// ```
/// [Auth] User logged in | userId: abc123, sessionId: xyz789
/// [Network] API request failed | url: https://..., statusCode: 500
/// ```
class _RecipeArchivePrinter extends LogPrinter {
  final String category;

  _RecipeArchivePrinter(this.category);

  @override
  List<String> log(LogEvent event) {
    final color = _getLevelColor(event.level);
    final emoji = _getLevelEmoji(event.level);
    final message = event.message;

    // Format metadata if present
    String metadataStr = "";
    if (event.error != null && event.error is Map<String, dynamic>) {
      final metadata = event.error as Map<String, dynamic>;
      final pairs = metadata.entries
          .map((e) => "${e.key}: ${e.value}")
          .join(", ");
      metadataStr = " | $pairs";
    }

    final logLine = "$emoji [$category] $message$metadataStr";
    return [color(logLine)];
  }

  AnsiColor _getLevelColor(Level level) {
    switch (level) {
      case Level.debug:
        return AnsiColor.fg(AnsiColor.grey(0.5));
      case Level.info:
        return AnsiColor.fg(12); // Blue
      case Level.warning:
        return AnsiColor.fg(208); // Orange
      case Level.error:
        return AnsiColor.fg(196); // Red
      case Level.fatal:
        return AnsiColor.fg(199); // Pink
      default:
        return AnsiColor.none();
    }
  }

  String _getLevelEmoji(Level level) {
    switch (level) {
      case Level.debug:
        return "🔍";
      case Level.info:
        return "ℹ️";
      case Level.warning:
        return "⚠️";
      case Level.error:
        return "❌";
      case Level.fatal:
        return "💀";
      default:
        return "📝";
    }
  }
}
