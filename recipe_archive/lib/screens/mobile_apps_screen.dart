import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class MobileAppsScreen extends StatelessWidget {
  const MobileAppsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mobile Apps'),
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.green[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.green[200]!),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'RecipeArchive Mobile Apps',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.green[800],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Access your recipe collection on the go with our native mobile applications. Sync seamlessly with your web browser extensions.',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.green[700],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Mobile apps section
            LayoutBuilder(
              builder: (context, constraints) {
                if (constraints.maxWidth > 800) {
                  // Desktop layout - side by side
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _buildAppCard(
                          context,
                          'iOS App',
                          Icons.apple,
                          Colors.black,
                          'Native iOS application with full feature parity',
                          'Available on the App Store',
                          'Optimized for iPhone and iPad with native iOS design',
                          () => _showComingSoonDialog(context),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildAppCard(
                          context,
                          'Android App',
                          Icons.android,
                          Colors.green[700]!,
                          'Native Android application with Material Design',
                          'Available on Google Play Store',
                          'Supports Android 8.0+ with responsive design',
                          () => _showComingSoonDialog(context),
                        ),
                      ),
                    ],
                  );
                } else {
                  // Mobile layout - stacked
                  return Column(
                    children: [
                      _buildAppCard(
                        context,
                        'iOS App',
                        Icons.apple,
                        Colors.black,
                        'Native iOS application with full feature parity',
                        'Available on the App Store',
                        'Optimized for iPhone and iPad with native iOS design',
                        () => _showComingSoonDialog(context),
                      ),
                      const SizedBox(height: 16),
                      _buildAppCard(
                        context,
                        'Android App',
                        Icons.android,
                        Colors.green[700]!,
                        'Native Android application with Material Design',
                        'Available on Google Play Store',
                        'Supports Android 8.0+ with responsive design',
                        () => _showComingSoonDialog(context),
                      ),
                    ],
                  );
                }
              },
            ),

            const SizedBox(height: 24),

            // Progressive Web App (PWA) Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.web_asset,
                          size: 32,
                          color: Colors.blue[600],
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Progressive Web App (PWA)',
                                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Text(
                                'Available now - Install directly from your mobile browser',
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: Colors.blue[700],
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 16),
                    
                    Text(
                      'Access RecipeArchive on your mobile device through our Progressive Web App. Works on both iOS and Android with offline capabilities and app-like experience.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    
                    const SizedBox(height: 16),
                    
                    Row(
                      children: [
                        Icon(Icons.info_outline, size: 16, color: Colors.grey[600]),
                        const SizedBox(width: 4),
                        Text(
                          'Works on all modern mobile browsers',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 20),
                    
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _openPWA(),
                            icon: const Icon(Icons.launch),
                            label: const Text('Open Web App'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blue[600],
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        OutlinedButton.icon(
                          onPressed: () => _showPWAInstructions(context),
                          icon: const Icon(Icons.help_outline),
                          label: const Text('Install Guide'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 32),

            // Features section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Mobile Features',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildFeatureItem('📱 Native mobile experience with touch-optimized interface'),
                    _buildFeatureItem('🔄 Real-time sync with browser extensions'),
                    _buildFeatureItem('🔍 Search and filter your recipe collection'),
                    _buildFeatureItem('📊 Ingredient scaling and shopping list generation'),
                    _buildFeatureItem('📸 View high-resolution recipe images'),
                    _buildFeatureItem('🌐 Offline access to saved recipes'),
                    _buildFeatureItem('🔐 Secure authentication with AWS Cognito'),
                    _buildFeatureItem('☁️ Cloud backup and multi-device sync'),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Development Status
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.construction,
                          color: Colors.orange[600],
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Development Status',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.orange[800],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Native mobile apps are currently in development. The PWA version provides full functionality while we finish the native iOS and Android applications.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '📅 Expected release: Q2 2025',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                        color: Colors.orange[700],
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

  Widget _buildAppCard(
    BuildContext context,
    String platform,
    IconData icon,
    Color color,
    String description,
    String availability,
    String details,
    VoidCallback onTap,
  ) {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 32, color: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'RecipeArchive for $platform',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        availability,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            Text(
              description,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            
            const SizedBox(height: 8),
            
            Text(
              details,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
            ),
            
            const SizedBox(height: 20),
            
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onTap,
                icon: const Icon(Icons.download),
                label: const Text('Coming Soon'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text),
    );
  }

  void _showComingSoonDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Coming Soon'),
        content: const Text(
          'Native mobile apps are currently in development. For now, you can use our Progressive Web App which provides the same functionality with an app-like experience.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _openPWA();
            },
            child: const Text('Try PWA'),
          ),
        ],
      ),
    );
  }

  void _showPWAInstructions(BuildContext context) {
    const instructions = '''
HOW TO INSTALL THE PWA:

📱 On iPhone/iPad (Safari):
1. Open Safari and go to the RecipeArchive web app
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

🤖 On Android (Chrome):
1. Open Chrome and go to the RecipeArchive web app
2. Tap the three-dot menu
3. Select "Add to Home screen"
4. Tap "Add" to confirm

The app will appear on your home screen like a native app with offline capabilities and push notifications.
''';

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('PWA Installation Guide'),
        content: SizedBox(
          width: 500,
          child: SingleChildScrollView(
            child: Text(
              instructions,
              style: const TextStyle(fontFamily: 'monospace'),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(const ClipboardData(text: instructions));
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Instructions copied to clipboard')),
              );
            },
            child: const Text('Copy Instructions'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _openPWA() async {
    const url = 'https://d1jcaphz4458q7.cloudfront.net';
    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
    }
  }
}