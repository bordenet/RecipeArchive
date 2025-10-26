import 'package:flutter/services.dart';

class ShareChannel {
  static const MethodChannel _channel = MethodChannel('com.recipearchive/share');

  /// Callback when a URL is shared from iOS
  static void setSharedUrlHandler(Function(String url) handler) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'sharedUrl') {
        final String url = call.arguments as String;
        handler(url);
      }
    });
  }

  /// Check for pending shared URL on app launch
  static Future<String?> checkForSharedUrl() async {
    try {
      final String? url = await _channel.invokeMethod('checkForSharedUrl');
      return url;
    } on PlatformException {
      // Silently fail - no shared URL available
      return null;
    }
  }
}
