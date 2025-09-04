import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:web/web.dart' as web;

class ExtensionVersion {
  final String version;
  final String filename;
  final int size;
  final String downloadUrl;

  const ExtensionVersion({
    required this.version,
    required this.filename,
    required this.size,
    required this.downloadUrl,
  });

  factory ExtensionVersion.fromJson(Map<String, dynamic> json) {
    return ExtensionVersion(
      version: json['version'],
      filename: json['filename'],
      size: json['size'],
      downloadUrl: json['downloadUrl'],
    );
  }
  
  String get formattedSize {
    if (size < 1024) return '${size}B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)}KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)}MB';
  }
}

class ExtensionVersions {
  final DateTime lastUpdated;
  final ExtensionVersion chrome;
  final ExtensionVersion safari;

  const ExtensionVersions({
    required this.lastUpdated,
    required this.chrome,
    required this.safari,
  });

  factory ExtensionVersions.fromJson(Map<String, dynamic> json) {
    return ExtensionVersions(
      lastUpdated: DateTime.parse(json['lastUpdated']),
      chrome: ExtensionVersion.fromJson(json['extensions']['chrome']),
      safari: ExtensionVersion.fromJson(json['extensions']['safari']),
    );
  }
}

class ExtensionService {
  static const String _versionsUrl = 
    'https://recipearchive-storage-dev-990537043943.s3.us-west-2.amazonaws.com/extensions/versions.json';

  Future<ExtensionVersions?> getAvailableVersions() async {
    try {
      final response = await http.get(Uri.parse(_versionsUrl));
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return ExtensionVersions.fromJson(data);
      }
      
      return null;
    } catch (e) {
      // Error fetching extension versions: $e
      return null;
    }
  }

  void downloadExtension(ExtensionVersion extension, String platform) {
    // Create a temporary anchor element to trigger download
    final anchor = web.HTMLAnchorElement()
      ..href = extension.downloadUrl
      ..download = extension.filename
      ..target = '_blank';
    
    // Add to DOM, click, then remove
    web.document.body?.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  String getInstallationInstructions(String platform) {
    switch (platform.toLowerCase()) {
      case 'chrome':
        return '''
Chrome Installation:
1. Download the extension ZIP file
2. Open Chrome and go to chrome://extensions/
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the extracted folder
6. The RecipeArchive extension will appear in your toolbar
        ''';
      
      case 'safari':
        return '''
Safari Installation:
1. Download the extension ZIP file
2. Extract the ZIP file to a folder
3. Open Safari
4. Go to Safari > Preferences > Advanced
5. Check "Show Develop menu in menu bar"
6. Go to Develop > Allow Unsigned Extensions
7. Go to Safari > Preferences > Extensions
8. Find RecipeArchive and enable it
        ''';
      
      default:
        return 'Installation instructions not available for this platform.';
    }
  }

  // Check if current version is newer than installed (would require local storage)
  bool isUpdateAvailable(String platform, String? installedVersion, ExtensionVersion latestVersion) {
    if (installedVersion == null) return true;
    
    // Simple semantic version comparison
    final installed = installedVersion.split('.').map(int.parse).toList();
    final latest = latestVersion.version.split('.').map(int.parse).toList();
    
    for (int i = 0; i < 3; i++) {
      final installedPart = i < installed.length ? installed[i] : 0;
      final latestPart = i < latest.length ? latest[i] : 0;
      
      if (latestPart > installedPart) return true;
      if (latestPart < installedPart) return false;
    }
    
    return false;
  }
}