import 'dart:convert';
import 'package:flutter/services.dart';

class ShareChannel {
  static const MethodChannel _channel = MethodChannel('com.recipearchive/share');
  static Function(Map<String, dynamic>)? _handler;

  static void setSharedUrlHandler(Function(Map<String, dynamic>) handler) {
    _handler = handler;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'sharedUrl') {
        final String result = call.arguments as String;
        try {
          final Map<String, dynamic> payload = json.decode(result);
          final Map<String, dynamic> sharedData = {
            'url': payload['url'] as String,
            if (payload.containsKey('html')) 'html': payload['html'] as String,
            if (payload.containsKey('images')) 'images': payload['images'] as List,
          };
          _handler?.call(sharedData);
        } catch (e) {
          _handler?.call({'url': result});
        }
      }
    });
  }

  static Future<Map<String, dynamic>?> checkForSharedUrl() async {
    try {
      final String? result = await _channel.invokeMethod('checkForSharedUrl');
      if (result == null) return null;

      // Try to parse as JSON first
      try {
        final Map<String, dynamic> payload = json.decode(result);
        return {
          'url': payload['url'] as String,
          if (payload.containsKey('html')) 'html': payload['html'] as String,
          if (payload.containsKey('images')) 'images': payload['images'] as List,
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
