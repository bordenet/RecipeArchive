import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import '../services/backup_service.dart';
import '../services/recipe_service.dart';

class BackupScreen extends StatefulWidget {
  const BackupScreen({super.key});

  @override
  State<BackupScreen> createState() => _BackupScreenState();
}

class _BackupScreenState extends State<BackupScreen> {
  late final BackupService _backupService;
  bool _isLoading = false;
  String? _statusMessage;
  bool _overwriteExisting = false;

  @override
  void initState() {
    super.initState();
    // TODO: Get RecipeService from dependency injection or provider
    _backupService = BackupService(RecipeService());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Backup & Restore'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.backup, size: 28, color: Theme.of(context).primaryColor),
                        const SizedBox(width: 12),
                        Text(
                          'Data Protection',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Backup your recipes to keep them safe, or restore from a previous backup.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).textTheme.bodySmall?.color,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Export Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.download, color: Colors.green[700]),
                        const SizedBox(width: 8),
                        Text(
                          'Export Recipes',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Create a backup file containing all your recipes, notes, and personal settings.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _isLoading ? null : _exportRecipes,
                        icon: const Icon(Icons.save_alt),
                        label: const Text('Create Backup'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green[600],
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Import Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.upload, color: Colors.blue[700]),
                        const SizedBox(width: 8),
                        Text(
                          'Import Recipes',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Restore recipes from a backup file. Choose how to handle existing recipes.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    
                    // Import options
                    CheckboxListTile(
                      title: const Text('Overwrite existing recipes'),
                      subtitle: const Text('Replace recipes with the same ID'),
                      value: _overwriteExisting,
                      onChanged: (value) {
                        setState(() {
                          _overwriteExisting = value ?? false;
                        });
                      },
                      contentPadding: EdgeInsets.zero,
                    ),
                    
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _isLoading ? null : _importRecipes,
                        icon: const Icon(Icons.folder_open),
                        label: const Text('Select Backup File'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue[600],
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            // Loading indicator
            if (_isLoading) ...[
              const SizedBox(height: 24),
              const Center(
                child: CircularProgressIndicator(),
              ),
            ],
            
            // Status message
            if (_statusMessage != null) ...[
              const SizedBox(height: 24),
              Card(
                color: Theme.of(context).colorScheme.surfaceVariant,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        color: Theme.of(context).primaryColor,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _statusMessage!,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            
            const Spacer(),
            
            // Warning
            Card(
              color: Colors.orange[50],
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber, color: Colors.orange[700]),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Important',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              color: Colors.orange[800],
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Keep your backup files safe! Store them in multiple locations to prevent data loss.',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.orange[700],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _exportRecipes() async {
    setState(() {
      _isLoading = true;
      _statusMessage = 'Creating backup...';
    });

    try {
      final result = await _backupService.exportRecipes();
      
      setState(() {
        _isLoading = false;
        _statusMessage = result.success 
            ? result.message 
            : 'Export failed: ${result.message}';
      });

      if (result.success) {
        // Show success dialog
        if (mounted) {
          _showSuccessDialog(
            'Backup Created Successfully',
            result.message,
            actions: result.content != null ? [
              TextButton(
                onPressed: () => _copyToClipboard(result.content!),
                child: const Text('Copy to Clipboard'),
              ),
            ] : null,
          );
        }
      } else {
        // Show error
        if (mounted) {
          _showErrorDialog('Export Failed', result.message);
        }
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _statusMessage = 'Export failed: $e';
      });
      
      if (mounted) {
        _showErrorDialog('Export Failed', 'An unexpected error occurred: $e');
      }
    }
  }

  Future<void> _importRecipes() async {
    try {
      // Pick file
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['json'],
        withData: true,
      );

      if (result == null || result.files.isEmpty) {
        return; // User cancelled
      }

      final file = result.files.first;
      String content;

      if (file.bytes != null) {
        // Web platform
        content = String.fromCharCodes(file.bytes!);
      } else if (file.path != null) {
        // Mobile platform
        content = await File(file.path!).readAsString();
      } else {
        _showErrorDialog('Import Failed', 'Could not read the selected file.');
        return;
      }

      setState(() {
        _isLoading = true;
        _statusMessage = 'Importing recipes...';
      });

      final importResult = await _backupService.importRecipes(
        content,
        overwriteExisting: _overwriteExisting,
      );

      setState(() {
        _isLoading = false;
        _statusMessage = importResult.message;
      });

      if (importResult.success) {
        // Show detailed success dialog
        if (mounted) {
          _showImportSuccessDialog(importResult);
        }
      } else {
        // Show error
        if (mounted) {
          _showErrorDialog('Import Failed', importResult.message);
        }
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _statusMessage = 'Import failed: $e';
      });
      
      if (mounted) {
        _showErrorDialog('Import Failed', 'An unexpected error occurred: $e');
      }
    }
  }

  void _copyToClipboard(String content) {
    Clipboard.setData(ClipboardData(text: content));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Backup content copied to clipboard')),
    );
  }

  void _showSuccessDialog(String title, String message, {List<Widget>? actions}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.check_circle, color: Colors.green, size: 48),
        title: Text(title),
        content: Text(message),
        actions: [
          ...?actions,
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showErrorDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.error, color: Colors.red, size: 48),
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showImportSuccessDialog(RestoreResult result) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.check_circle, color: Colors.green, size: 48),
        title: const Text('Import Completed'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('✅ ${result.imported} new recipes imported'),
            Text('🔄 ${result.updated} existing recipes updated'),
            Text('⏭️ ${result.skipped} recipes skipped'),
            if (result.deduplicated > 0)
              Text('🔍 ${result.deduplicated} duplicates detected and skipped'),
            if (result.errors.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Errors:', style: TextStyle(fontWeight: FontWeight.bold)),
              ...result.errors.take(3).map((error) => Text('• $error', style: const TextStyle(fontSize: 12))),
              if (result.errors.length > 3)
                Text('... and ${result.errors.length - 3} more errors', style: const TextStyle(fontSize: 12)),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}