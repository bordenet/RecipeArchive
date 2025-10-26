import 'dart:convert';
import 'package:flutter/services.dart';

class ShareChannel {
  static const MethodChannel _channel = MethodChannel('com.recipearchive/share');

  static Future<Map<String, String>?> checkForSharedUrl() async {
    try {
      final String? result = await _channel.invokeMethod('checkForSharedUrl');
      if (result == null) return null;

      // Try to parse as JSON first
      try {
        final Map<String, dynamic> payload = json.decode(result);
        return {
          'url': payload['url'] as String,
          if (payload.containsKey('html')) 'html': payload['html'] as String,
        };
      } catch (e) {
        // Fallback: treat as plain URL string (backwards compatibility)
        return {'url': result};
      }
    } on PlatformException {
      return null;
    }
  }
}
