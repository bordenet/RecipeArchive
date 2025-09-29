// Stub implementation for non-web platforms
import 'backup_result.dart';

/// Stub export for non-web platforms
Future<BackupResult> exportForWeb(String jsonContent) async {
  return BackupResult.error('Web export not supported on this platform');
}