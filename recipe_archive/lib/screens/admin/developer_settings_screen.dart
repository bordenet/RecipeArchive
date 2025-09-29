import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class DeveloperSettingsScreen extends StatefulWidget {
  const DeveloperSettingsScreen({super.key});

  @override
  State<DeveloperSettingsScreen> createState() => _DeveloperSettingsScreenState();
}

class _DeveloperSettingsScreenState extends State<DeveloperSettingsScreen> {
  final _storage = const FlutterSecureStorage();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _isDeveloperMode = false;
  bool _autoLoginEnabled = false;
  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    try {
      final isDeveloperMode = await _storage.read(key: 'developer_mode') == 'true';
      final devEmail = await _storage.read(key: 'dev_email') ?? '';
      final devPassword = await _storage.read(key: 'dev_password') ?? '';
      final autoLoginEnabled = await _storage.read(key: 'auto_login_enabled') == 'true';

      setState(() {
        _isDeveloperMode = isDeveloperMode;
        _emailController.text = devEmail;
        _passwordController.text = devPassword;
        _autoLoginEnabled = autoLoginEnabled;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _saveSettings() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      await _storage.write(key: 'developer_mode', value: _isDeveloperMode.toString());
      await _storage.write(key: 'auto_login_enabled', value: _autoLoginEnabled.toString());

      if (_isDeveloperMode) {
        await _storage.write(key: 'dev_email', value: _emailController.text.trim());
        await _storage.write(key: 'dev_password', value: _passwordController.text);
      } else {
        // Clear developer credentials when disabling developer mode
        await _storage.delete(key: 'dev_email');
        await _storage.delete(key: 'dev_password');
        await _storage.write(key: 'auto_login_enabled', value: 'false');
        setState(() {
          _autoLoginEnabled = false;
        });
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Developer settings saved successfully'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to save settings: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isSaving = false;
      });
    }
  }

  Future<void> _clearAllSettings() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear All Settings'),
        content: const Text(
          'This will clear all developer settings and stored credentials. '
          'You will need to sign in manually next time. Are you sure?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      // Clear all authentication-related storage
      await _storage.delete(key: 'developer_mode');
      await _storage.delete(key: 'dev_email');
      await _storage.delete(key: 'dev_password');
      await _storage.delete(key: 'auto_login_enabled');
      await _storage.delete(key: 'saved_email');
      await _storage.delete(key: 'saved_password');
      await _storage.delete(key: 'remember_me');

      setState(() {
        _isDeveloperMode = false;
        _autoLoginEnabled = false;
        _emailController.clear();
        _passwordController.clear();
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('All settings cleared successfully'),
          backgroundColor: Colors.orange,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to clear settings: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Developer Settings'),
          backgroundColor: Colors.red.shade600,
          foregroundColor: Colors.white,
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Developer Settings'),
        backgroundColor: Colors.red.shade600,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: _clearAllSettings,
            icon: const Icon(Icons.clear_all),
            tooltip: 'Clear All Settings',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Warning Card
              Card(
                color: Colors.orange.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      Icon(Icons.warning, color: Colors.orange.shade700),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Developer Mode',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.orange.shade700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'These settings are for development convenience only. '
                              'Disable before sharing the app with others.',
                              style: TextStyle(color: Colors.orange.shade800),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Developer Mode Toggle
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Developer Mode',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Enable developer mode to use stored credentials for quick login during development.',
                      ),
                      const SizedBox(height: 16),
                      SwitchListTile(
                        title: const Text('Enable Developer Mode'),
                        subtitle: Text(
                          _isDeveloperMode
                              ? 'Developer credentials will be used for login'
                              : 'Standard login flow will be used',
                        ),
                        value: _isDeveloperMode,
                        onChanged: (value) {
                          setState(() {
                            _isDeveloperMode = value;
                          });
                        },
                        activeThumbColor: Colors.red.shade600,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Developer Credentials
              if (_isDeveloperMode) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Developer Credentials',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'These credentials will be used for automatic login during development. '
                          'They are stored securely on this device only.',
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _emailController,
                          decoration: const InputDecoration(
                            labelText: 'Developer Email',
                            hintText: 'your-admin-email@example.com',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.email),
                          ),
                          keyboardType: TextInputType.emailAddress,
                          validator: (value) {
                            if (_isDeveloperMode && (value == null || value.trim().isEmpty)) {
                              return 'Email is required when developer mode is enabled';
                            }
                            if (value != null && value.isNotEmpty &&
                                !RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                              return 'Please enter a valid email address';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _passwordController,
                          decoration: const InputDecoration(
                            labelText: 'Developer Password',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.lock),
                          ),
                          obscureText: true,
                          validator: (value) {
                            if (_isDeveloperMode && (value == null || value.isEmpty)) {
                              return 'Password is required when developer mode is enabled';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        SwitchListTile(
                          title: const Text('Enable Auto-Login'),
                          subtitle: const Text(
                            'Automatically sign in using developer credentials when app starts',
                          ),
                          value: _autoLoginEnabled,
                          onChanged: (value) {
                            setState(() {
                              _autoLoginEnabled = value;
                            });
                          },
                          activeThumbColor: Colors.red.shade600,
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),
              ],

              // Security Information
              Card(
                color: Colors.blue.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.info, color: Colors.blue.shade700),
                          const SizedBox(width: 8),
                          Text(
                            'Security Information',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.blue.shade700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '• Developer credentials are stored using Flutter Secure Storage\n'
                        '• Credentials are encrypted and only accessible by this app\n'
                        '• Auto-login only works in developer mode\n'
                        '• Regular users will always need to enter credentials manually\n'
                        '• Disable developer mode before distributing the app',
                        style: TextStyle(color: Colors.blue.shade800),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // Save Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _saveSettings,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isSaving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text(
                          'Save Settings',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}