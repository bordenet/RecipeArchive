/// Schema versioning constants for backup/restore compatibility
/// 
/// This file defines the current data model version and compatibility rules
/// to prevent data loss during backup imports across app versions.
class SchemaVersion {
  /// Current schema version using semantic versioning
  /// MAJOR.MINOR.PATCH format where:
  /// - MAJOR: Breaking changes requiring migration
  /// - MINOR: New optional fields, backward compatible  
  /// - PATCH: Bug fixes, no schema impact
  static const String current = '2.1.0';
  
  /// App version that introduced this schema
  static const String appVersion = '1.5.2';
  
  /// Supported schema versions for import (current + 2 previous majors)
  static const List<String> supportedVersions = [
    '2.1.0', // Current version
    '2.0.0', // Previous minor versions
    '1.5.0', // Previous major version (deprecated)
    '1.4.0', // Legacy support (import only)
  ];
  
  /// Features introduced in each schema version
  static const Map<String, List<String>> featuresByVersion = {
    '2.1.0': [
      'star_ratings',
      'search_metadata', 
      'multi_value_meal_types',
      'enhanced_tags'
    ],
    '2.0.0': [
      'search_metadata',
      'cooking_methods',
      'dietary_tags',
      'complexity_ratings'
    ],
    '1.5.0': [
      'personal_ratings',
      'recipe_tags',
      'serving_scaling'
    ],
    '1.4.0': [
      'basic_recipe_storage',
      'ingredient_parsing',
      'instruction_steps'
    ],
  };
  
  /// Breaking changes that require user consent for import
  static const Map<String, String> breakingChanges = {
    '2.0.0': 'Search metadata structure changed - old search data will be lost',
    '1.5.0': 'Recipe storage format updated - some custom tags may not import',
  };
  
  /// Schema compatibility level determination
  static SchemaCompatibility getCompatibility(String backupVersion) {
    if (backupVersion == current) {
      return SchemaCompatibility.full;
    }
    
    if (supportedVersions.contains(backupVersion)) {
      // Check if it's a major version difference
      final backupMajor = _getMajorVersion(backupVersion);
      final currentMajor = _getMajorVersion(current);
      
      if (backupMajor == currentMajor) {
        return SchemaCompatibility.compatible;
      } else {
        return SchemaCompatibility.requiresMigration;
      }
    }
    
    return SchemaCompatibility.incompatible;
  }
  
  /// Get features that will be lost/ignored during import
  static List<String> getLostFeatures(String backupVersion) {
    final backupFeatures = featuresByVersion[backupVersion] ?? [];
    final currentFeatures = featuresByVersion[current] ?? [];
    
    // Features in backup that current version doesn't support
    return backupFeatures.where((feature) => !currentFeatures.contains(feature)).toList();
  }
  
  /// Get features that will be unavailable after import
  static List<String> getUnavailableFeatures(String backupVersion) {
    final backupFeatures = featuresByVersion[backupVersion] ?? [];
    final currentFeatures = featuresByVersion[current] ?? [];
    
    // Features in current version that backup doesn't have
    return currentFeatures.where((feature) => !backupFeatures.contains(feature)).toList();
  }
  
  /// Generate backup metadata for export
  static Map<String, dynamic> generateBackupMetadata({
    required int recipeCount,
    required List<String> activeFeatures,
    required String userId,
  }) {
    return {
      'backup_metadata': {
        'schema_version': current,
        'app_version': appVersion,
        'created_at': DateTime.now().toIso8601String(),
        'user_id': _hashUserId(userId),
        'format_version': '1.0', // For backup format itself
        'feature_flags': activeFeatures,
        'record_counts': {
          'recipes': recipeCount,
        },
        'compatibility_info': {
          'minimum_app_version': '1.4.0',
          'recommended_app_version': appVersion,
          'breaking_changes': breakingChanges.keys.toList(),
        }
      }
    };
  }
  
  /// Validate backup metadata before import
  static BackupValidationResult validateBackup(Map<String, dynamic> backupData) {
    try {
      final metadata = backupData['backup_metadata'] as Map<String, dynamic>?;
      
      if (metadata == null) {
        return BackupValidationResult(
          isValid: false,
          error: 'Missing backup metadata - this backup may be from an older app version',
          compatibility: SchemaCompatibility.incompatible,
        );
      }
      
      final backupVersion = metadata['schema_version'] as String?;
      if (backupVersion == null) {
        return BackupValidationResult(
          isValid: false,
          error: 'Invalid backup metadata - missing schema version',
          compatibility: SchemaCompatibility.incompatible,
        );
      }
      
      final compatibility = getCompatibility(backupVersion);
      final lostFeatures = getLostFeatures(backupVersion);
      final unavailableFeatures = getUnavailableFeatures(backupVersion);
      
      return BackupValidationResult(
        isValid: true,
        compatibility: compatibility,
        backupVersion: backupVersion,
        lostFeatures: lostFeatures,
        unavailableFeatures: unavailableFeatures,
        metadata: metadata,
      );
      
    } catch (e) {
      return BackupValidationResult(
        isValid: false,
        error: 'Failed to parse backup metadata: $e',
        compatibility: SchemaCompatibility.incompatible,
      );
    }
  }
  
  /// Extract major version number
  static int _getMajorVersion(String version) {
    final parts = version.split('.');
    return int.tryParse(parts.first) ?? 0;
  }
  
  /// Hash user ID for privacy in backup metadata
  static String _hashUserId(String userId) {
    // In production, use proper hashing (SHA-256)
    // For now, just return first 8 chars + length for uniqueness
    return '${userId.substring(0, 8)}...${userId.length}';
  }
}

/// Schema compatibility levels for backup imports
enum SchemaCompatibility {
  /// Exact version match - full compatibility
  full,
  
  /// Same major version - compatible with minor feature differences
  compatible,
  
  /// Different major version - requires migration, may lose data
  requiresMigration,
  
  /// Unsupported version - cannot import
  incompatible,
}

/// Result of backup validation before import
class BackupValidationResult {
  final bool isValid;
  final SchemaCompatibility compatibility;
  final String? backupVersion;
  final String? error;
  final List<String> lostFeatures;
  final List<String> unavailableFeatures;
  final Map<String, dynamic>? metadata;
  
  const BackupValidationResult({
    required this.isValid,
    required this.compatibility,
    this.backupVersion,
    this.error,
    this.lostFeatures = const [],
    this.unavailableFeatures = const [],
    this.metadata,
  });
  
  /// Whether import requires user consent due to potential data loss
  bool get requiresConsent => 
      compatibility == SchemaCompatibility.requiresMigration ||
      lostFeatures.isNotEmpty;
  
  /// User-friendly description of compatibility status
  String get compatibilityDescription {
    switch (compatibility) {
      case SchemaCompatibility.full:
        return 'Fully compatible - all features supported';
      case SchemaCompatibility.compatible:
        return 'Compatible with minor differences';
      case SchemaCompatibility.requiresMigration:
        return 'Requires migration - some data may be lost';
      case SchemaCompatibility.incompatible:
        return 'Incompatible - cannot import this backup';
    }
  }
  
  /// Generate user-friendly warning message
  String? get warningMessage {
    if (!requiresConsent) return null;
    
    final warnings = <String>[];
    
    if (lostFeatures.isNotEmpty) {
      warnings.add('The following features from your backup will be lost: ${lostFeatures.join(', ')}');
    }
    
    if (unavailableFeatures.isNotEmpty) {
      warnings.add('The following features will not be available: ${unavailableFeatures.join(', ')}');
    }
    
    if (compatibility == SchemaCompatibility.requiresMigration) {
      warnings.add('This backup is from a different app version and may require data conversion.');
    }
    
    return warnings.join('\n\n');
  }
}