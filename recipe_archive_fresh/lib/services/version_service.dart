import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'extension_service.dart';

class VersionService {
  static const _storage = FlutterSecureStorage();

  static const _chromeVersionKey = 'chrome_extension_version';
  static const _safariVersionKey = 'safari_extension_version';
  static const _lastCheckKey = 'last_update_check';

  Future<String?> getInstalledVersion(String platform) async {
    final key = platform.toLowerCase() == 'chrome' ? _chromeVersionKey : _safariVersionKey;
    return await _storage.read(key: key);
  }

  Future<void> setInstalledVersion(String platform, String version) async {
    final key = platform.toLowerCase() == 'chrome' ? _chromeVersionKey : _safariVersionKey;
    await _storage.write(key: key, value: version);
  }

  Future<DateTime?> getLastUpdateCheck() async {
    final lastCheckString = await _storage.read(key: _lastCheckKey);
    if (lastCheckString != null) {
      return DateTime.tryParse(lastCheckString);
    }
    return null;
  }

  Future<void> setLastUpdateCheck(DateTime dateTime) async {
    await _storage.write(key: _lastCheckKey, value: dateTime.toIso8601String());
  }

  Future<Map<String, bool>> checkForUpdates(ExtensionVersions availableVersions) async {
    final chromeInstalled = await getInstalledVersion('chrome');
    final safariInstalled = await getInstalledVersion('safari');
    
    final extensionService = ExtensionService();
    
    final chromeUpdateAvailable = extensionService.isUpdateAvailable(
      'chrome', 
      chromeInstalled, 
      availableVersions.chrome
    );
    
    final safariUpdateAvailable = extensionService.isUpdateAvailable(
      'safari', 
      safariInstalled, 
      availableVersions.safari
    );

    await setLastUpdateCheck(DateTime.now());

    return {
      'chrome': chromeUpdateAvailable,
      'safari': safariUpdateAvailable,
    };
  }

  // Check if we should show update notifications (once per day max)
  Future<bool> shouldCheckForUpdates() async {
    final lastCheck = await getLastUpdateCheck();
    if (lastCheck == null) return true;
    
    final now = DateTime.now();
    final difference = now.difference(lastCheck);
    
    // Check at most once per day
    return difference.inDays >= 1;
  }

  Future<void> markExtensionAsUpdated(String platform, String newVersion) async {
    await setInstalledVersion(platform, newVersion);
    await setLastUpdateCheck(DateTime.now());
  }

  // Clear all stored version data (for debugging/reset)
  Future<void> clearVersionData() async {
    await _storage.delete(key: _chromeVersionKey);
    await _storage.delete(key: _safariVersionKey);
    await _storage.delete(key: _lastCheckKey);
  }
}