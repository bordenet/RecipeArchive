import 'dart:convert';
import 'package:crypto/crypto.dart';
import '../constants/schema_version.dart';

/// Service for validating and managing backup imports with schema compatibility
class BackupValidationService {
  
  /// Validate a backup file before import
  /// Returns validation result with compatibility analysis
  static Future<BackupValidationResult> validateBackupFile(String jsonContent) async {
    try {
      final Map<String, dynamic> backupData = jsonDecode(jsonContent);
      return _validateBackupData(backupData, jsonContent);
    } catch (e) {
      return BackupValidationResult(
        isValid: false,
        error: 'Invalid JSON format: $e',
        compatibility: SchemaCompatibility.incompatible,
      );
    }
  }
  
  /// Validate backup data structure and schema compatibility
  static BackupValidationResult _validateBackupData(
    Map<String, dynamic> backupData,
    String originalContent,
  ) {
    final validationResult = SchemaVersion.validateBackup(backupData);
    
    if (!validationResult.isValid) {
      return validationResult;
    }
    
    // Additional validation checks
    final additionalChecks = _performAdditionalValidation(backupData, originalContent);
    if (!additionalChecks.isValid) {
      return additionalChecks;
    }
    
    return validationResult;
  }
  
  /// Perform additional validation beyond schema compatibility
  static BackupValidationResult _performAdditionalValidation(
    Map<String, dynamic> backupData,
    String originalContent,
  ) {
    final metadata = backupData['backup_metadata'] as Map<String, dynamic>;
    
    // Validate data checksum if present
    final expectedChecksum = metadata['data_checksum'] as String?;
    if (expectedChecksum != null) {
      final actualChecksum = _calculateChecksum(originalContent);
      if (actualChecksum != expectedChecksum) {
        return BackupValidationResult(
          isValid: false,
          error: 'Backup file integrity check failed - file may be corrupted',
          compatibility: SchemaCompatibility.incompatible,
        );
      }
    }
    
    // Validate record counts match actual data
    final recordCounts = metadata['record_counts'] as Map<String, dynamic>?;
    if (recordCounts != null) {
      final expectedRecipes = recordCounts['recipes'] as int?;
      final actualRecipes = (backupData['recipes'] as List?)?.length ?? 0;
      
      if (expectedRecipes != null && expectedRecipes != actualRecipes) {
        return BackupValidationResult(
          isValid: false,
          error: 'Recipe count mismatch - expected $expectedRecipes, found $actualRecipes',
          compatibility: SchemaCompatibility.incompatible,
        );
      }
    }
    
    // Validate required fields exist
    final recipes = backupData['recipes'] as List?;
    if (recipes == null || recipes.isEmpty) {
      return BackupValidationResult(
        isValid: false,
        error: 'No recipes found in backup file',
        compatibility: SchemaCompatibility.incompatible,
      );
    }
    
    return BackupValidationResult(
      isValid: true,
      compatibility: SchemaVersion.getCompatibility(metadata['schema_version'] as String),
      backupVersion: metadata['schema_version'] as String,
      metadata: metadata,
    );
  }
  
  /// Calculate SHA-256 checksum for integrity verification
  static String _calculateChecksum(String content) {
    final bytes = utf8.encode(content);
    final digest = sha256.convert(bytes);
    return 'sha256-${digest.toString()}';
  }
  
  /// Generate user consent dialog information
  static ImportConsentInfo generateConsentInfo(BackupValidationResult validation) {
    if (!validation.requiresConsent) {
      return ImportConsentInfo(
        requiresConsent: false,
        riskLevel: ImportRiskLevel.safe,
        title: 'Safe Import',
        message: 'This backup is fully compatible with your current app version.',
      );
    }
    
    final riskLevel = _determineRiskLevel(validation);
    final title = _generateConsentTitle(riskLevel);
    final message = _generateConsentMessage(validation, riskLevel);
    
    return ImportConsentInfo(
      requiresConsent: true,
      riskLevel: riskLevel,
      title: title,
      message: message,
      warningMessage: validation.warningMessage,
      affectedFeatures: [...validation.lostFeatures, ...validation.unavailableFeatures],
    );
  }
  
  /// Determine import risk level based on validation results
  static ImportRiskLevel _determineRiskLevel(BackupValidationResult validation) {
    if (validation.compatibility == SchemaCompatibility.incompatible) {
      return ImportRiskLevel.blocked;
    }
    
    if (validation.lostFeatures.isNotEmpty || 
        validation.compatibility == SchemaCompatibility.requiresMigration) {
      return ImportRiskLevel.dangerous;
    }
    
    if (validation.unavailableFeatures.isNotEmpty) {
      return ImportRiskLevel.warning;
    }
    
    return ImportRiskLevel.safe;
  }
  
  /// Generate consent dialog title
  static String _generateConsentTitle(ImportRiskLevel riskLevel) {
    switch (riskLevel) {
      case ImportRiskLevel.safe:
        return 'Safe Import';
      case ImportRiskLevel.warning:
        return 'Import with Limitations';
      case ImportRiskLevel.dangerous:
        return 'Potentially Lossy Import';
      case ImportRiskLevel.blocked:
        return 'Import Blocked';
    }
  }
  
  /// Generate detailed consent message
  static String _generateConsentMessage(BackupValidationResult validation, ImportRiskLevel riskLevel) {
    final buffer = StringBuffer();
    
    switch (riskLevel) {
      case ImportRiskLevel.safe:
        buffer.writeln('This backup is fully compatible with your current app version.');
        break;
        
      case ImportRiskLevel.warning:
        buffer.writeln('This backup is compatible but some newer features will not be available.');
        if (validation.unavailableFeatures.isNotEmpty) {
          buffer.writeln('\nUnavailable features:');
          for (final feature in validation.unavailableFeatures) {
            buffer.writeln('• $feature');
          }
        }
        break;
        
      case ImportRiskLevel.dangerous:
        buffer.writeln('⚠️ WARNING: This import may result in data loss.');
        buffer.writeln('\nThis backup is from a different app version (${validation.backupVersion}) and requires migration.');
        
        if (validation.lostFeatures.isNotEmpty) {
          buffer.writeln('\nData that will be lost:');
          for (final feature in validation.lostFeatures) {
            buffer.writeln('• $feature');
          }
        }
        
        buffer.writeln('\n💡 We recommend creating a backup of your current recipes before proceeding.');
        break;
        
      case ImportRiskLevel.blocked:
        buffer.writeln('❌ This backup cannot be imported.');
        buffer.writeln('\nReason: ${validation.error}');
        if (validation.backupVersion != null) {
          buffer.writeln('Backup version: ${validation.backupVersion}');
          buffer.writeln('Current supported versions: ${SchemaVersion.supportedVersions.join(', ')}');
        }
        break;
    }
    
    return buffer.toString();
  }
  
  /// Create backup of current data before risky import
  static Future<String> createPreImportBackup() async {
    // This would integrate with existing backup service
    // For now, return a placeholder
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'pre_import_backup_$timestamp.json';
  }
  
  /// Migrate backup data to current schema if possible
  static Future<Map<String, dynamic>> migrateBackupData(
    Map<String, dynamic> backupData,
    String fromVersion,
  ) async {
    // This would contain actual migration logic between versions
    // For now, return the data as-is with updated metadata
    final migratedData = Map<String, dynamic>.from(backupData);
    
    // Update metadata to current version
    final metadata = migratedData['backup_metadata'] as Map<String, dynamic>;
    metadata['schema_version'] = SchemaVersion.current;
    metadata['migrated_from'] = fromVersion;
    metadata['migration_timestamp'] = DateTime.now().toIso8601String();
    
    return migratedData;
  }
}

/// Information for user consent dialog during import
class ImportConsentInfo {
  final bool requiresConsent;
  final ImportRiskLevel riskLevel;
  final String title;
  final String message;
  final String? warningMessage;
  final List<String> affectedFeatures;
  
  const ImportConsentInfo({
    required this.requiresConsent,
    required this.riskLevel,
    required this.title,
    required this.message,
    this.warningMessage,
    this.affectedFeatures = const [],
  });
  
  /// Whether import should be blocked entirely
  bool get isBlocked => riskLevel == ImportRiskLevel.blocked;
  
  /// Whether import requires explicit typed confirmation
  bool get requiresTypedConfirmation => riskLevel == ImportRiskLevel.dangerous;
  
  /// Confirmation text user must type for dangerous imports
  String get confirmationText => 'IMPORT WITH DATA LOSS';
}

/// Risk levels for backup imports
enum ImportRiskLevel {
  /// Safe to import automatically
  safe,
  
  /// Compatible with warnings about limitations
  warning,
  
  /// Potential data loss, requires explicit consent
  dangerous,
  
  /// Cannot import, blocked entirely
  blocked,
}