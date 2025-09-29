class PlatformDetectionImpl {
  static bool isMobile() {
    return true; // Native mobile apps are always mobile
  }

  static bool isIOS() {
    return false; // Would need platform channel to detect this properly
  }

  static bool isAndroid() {
    return false; // Would need platform channel to detect this properly
  }

  static String browserName() {
    return 'Native App';
  }
}