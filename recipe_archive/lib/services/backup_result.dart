/// Result of backup operation
class BackupResult {
  final bool success;
  final String message;
  final String? filePath;
  final String? content;

  const BackupResult._({
    required this.success,
    required this.message,
    this.filePath,
    this.content,
  });

  factory BackupResult.success({
    required String message,
    String? filePath,
    String? content,
  }) => BackupResult._(
    success: true,
    message: message,
    filePath: filePath,
    content: content,
  );

  factory BackupResult.error(String message) => BackupResult._(
    success: false,
    message: message,
  );
}