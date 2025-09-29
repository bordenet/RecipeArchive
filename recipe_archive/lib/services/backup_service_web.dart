// Web-specific backup service implementation
// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;
import 'backup_result.dart';

/// Export backup for web platform
Future<BackupResult> exportForWeb(String jsonContent) async {
  try {
    final fileName = 'recipe_backup_${DateTime.now().toIso8601String().split('T')[0]}.json';

    // Use dart:html approach
    final encodedJson = Uri.encodeComponent(jsonContent);
    final dataUri = 'data:application/json;charset=utf-8,$encodedJson';

    // Create anchor element and trigger download
    final anchor = html.AnchorElement(href: dataUri);
    anchor.download = fileName;
    anchor.style.display = 'none';

    // Add to DOM, click, then remove
    html.document.body!.append(anchor);
    anchor.click();
    anchor.remove();

    return BackupResult.success(
      message: 'Backup downloaded successfully',
      filePath: fileName,
      content: jsonContent,
    );
  } catch (e) {
    return BackupResult.error('Failed to create web backup: $e');
  }
}