import 'package:web/web.dart' as web;

class PlatformDetectionImpl {
  static bool isMobile() {
    final userAgent = web.window.navigator.userAgent;
    return userAgent.contains(RegExp(r'Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini'));
  }

  static bool isIOS() {
    final userAgent = web.window.navigator.userAgent;
    return userAgent.contains(RegExp(r'iPhone|iPad|iPod'));
  }

  static bool isAndroid() {
    final userAgent = web.window.navigator.userAgent;
    return userAgent.contains('Android');
  }

  static String browserName() {
    final userAgent = web.window.navigator.userAgent;

    if (userAgent.contains('Chrome') && !userAgent.contains('Edg')) {
      return 'Chrome';
    } else if (userAgent.contains('Safari') && !userAgent.contains('Chrome')) {
      return 'Safari';
    } else if (userAgent.contains('Firefox')) {
      return 'Firefox';
    } else if (userAgent.contains('Edg')) {
      return 'Edge';
    }

    return 'Unknown Browser';
  }
}