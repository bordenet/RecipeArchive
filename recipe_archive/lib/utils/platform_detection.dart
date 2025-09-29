import 'package:flutter/foundation.dart';
import 'platform_detection_web.dart' if (dart.library.io) 'platform_detection_stub.dart';

class PlatformDetection {
  static bool get isWeb => kIsWeb;

  static bool get isDesktop {
    if (!kIsWeb) return false;
    return !isMobile;
  }

  static bool get isMobile {
    if (!kIsWeb) return true; // Native mobile apps
    return PlatformDetectionImpl.isMobile();
  }

  static bool get isIOS {
    if (!kIsWeb) {
      // For native apps, this would need platform channel
      return false;
    }
    return PlatformDetectionImpl.isIOS();
  }

  static bool get isAndroid {
    if (!kIsWeb) {
      // For native apps, this would need platform channel
      return false;
    }
    return PlatformDetectionImpl.isAndroid();
  }

  static String get platformName {
    if (isIOS) return 'iOS';
    if (isAndroid) return 'Android';
    if (isDesktop) return 'Desktop';
    return 'Unknown';
  }

  static String get browserName {
    if (!kIsWeb) return 'Native App';
    return PlatformDetectionImpl.browserName();
  }
}