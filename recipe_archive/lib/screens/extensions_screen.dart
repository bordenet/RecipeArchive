import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/extension_service.dart';
import '../services/version_service.dart';
import '../utils/platform_detection.dart';

class ExtensionsScreen extends StatefulWidget {
  const ExtensionsScreen({super.key});

  @override
  State<ExtensionsScreen> createState() => _ExtensionsScreenState();
}

class _ExtensionsScreenState extends State<ExtensionsScreen> {
  final ExtensionService _extensionService = ExtensionService();
  final VersionService _versionService = VersionService();
  ExtensionVersions? _versions;
  bool _isLoading = true;
  String? _error;
  Map<String, bool> _updateAvailable = {};
  Map<String, String?> _installedVersions = {};

  @override
  void initState() {
    super.initState();
    // Only load versions on non-mobile platforms since mobile users get help card
    if (!PlatformDetection.isMobile) {
      _loadVersions();
    } else {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _loadVersions() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final versions = await _extensionService.getAvailableVersions();
      
      if (versions != null) {
        // Load installed versions
        final chromeInstalled = await _versionService.getInstalledVersion('chrome');
        final safariInstalled = await _versionService.getInstalledVersion('safari');
        
        // Check for updates
        final updateStatus = await _versionService.checkForUpdates(versions);
        
        setState(() {
          _versions = versions;
          _installedVersions = {
            'chrome': chromeInstalled,
            'safari': safariInstalled,
          };
          _updateAvailable = updateStatus;
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load extension versions';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Error loading extensions: $e';
        _isLoading = false;
      });
    }
  }

  void _showInstallationInstructions(String platform) {
    final instructions = _extensionService.getInstallationInstructions(platform);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$platform Extension Installation'),
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
              Clipboard.setData(ClipboardData(text: instructions));
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

  Widget _buildMobileHelpCard() {
    final platform = PlatformDetection.platformName;
    final iconData = PlatformDetection.isIOS ? Icons.phone_iphone : Icons.phone_android;
    final color = PlatformDetection.isIOS ? Colors.blue : Colors.green;

    return Column(
      children: [
        Card(
          elevation: 4,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(iconData, size: 32, color: color),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Recipe Extensions for $platform',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue[50],
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.blue[200]!),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.info, color: Colors.blue[700], size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'How to Import Recipes from Mobile',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.blue[800],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      Text(
                        'Mobile browsers don\'t support the web extensions needed to import recipes from websites. Recipe Archive requires a desktop browser (Chrome or Safari for macOS) with our extension installed:',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),

                      const SizedBox(height: 16),

                      _buildMobileInstructionStep(
                        '1.',
                        'Open Chrome or Safari on a desktop computer',
                        Icons.computer,
                      ),
                      _buildMobileInstructionStep(
                        '2.',
                        'Visit this Recipe Archive Extensions page on desktop',
                        Icons.web,
                      ),
                      _buildMobileInstructionStep(
                        '3.',
                        'Download and install the Chrome or Safari extension',
                        Icons.extension,
                      ),
                      _buildMobileInstructionStep(
                        '4.',
                        'Browse supported recipe websites (see list below)',
                        Icons.restaurant_menu,
                      ),
                      _buildMobileInstructionStep(
                        '5.',
                        'Click the extension icon to capture recipes instantly',
                        Icons.add_circle,
                      ),
                      _buildMobileInstructionStep(
                        '6.',
                        'Recipes sync automatically to all your devices!',
                        Icons.sync,
                      ),

                      const SizedBox(height: 16),

                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.green[50],
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.green[200]!),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.check_circle, color: Colors.green[700], size: 16),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Your saved recipes will appear here on mobile automatically',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.green[800],
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      final url = Uri.base.toString();
                      Clipboard.setData(ClipboardData(text: url));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Recipe Archive URL copied! Open it on desktop to install extensions.'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    },
                    icon: const Icon(Icons.copy),
                    label: const Text('Copy Recipe Archive URL for Desktop'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: color,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Supported Sites Card
        Card(
          elevation: 4,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.public, color: Colors.green[600], size: 28),
                    const SizedBox(width: 12),
                    Text(
                      'Supported Recipe Websites',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Colors.green[700],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                Text(
                  'Visit any of these recipe websites with your desktop browser extension to instantly capture recipes:',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 16),

                // Recipe sites grid
                _buildRecipeSitesGrid(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMobileInstructionStep(String number, String text, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: Colors.blue[100],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                number,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue[800],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Icon(icon, size: 16, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecipeSitesGrid() {
    final sites = [
      {'name': 'Smitten Kitchen', 'url': 'https://smittenkitchen.com'},
      {'name': 'Food52', 'url': 'https://food52.com'},
      {'name': 'NYT Cooking', 'url': 'https://cooking.nytimes.com'},
      {'name': 'Food Network', 'url': 'https://foodnetwork.com'},
      {'name': 'Washington Post', 'url': 'https://washingtonpost.com/food'},
      {'name': 'Love & Lemons', 'url': 'https://loveandlemons.com'},
      {'name': 'Lemons & Zest', 'url': 'https://lemonsandzest.com'},
      {'name': 'AllRecipes', 'url': 'https://allrecipes.com'},
      {'name': 'Epicurious', 'url': 'https://epicurious.com'},
      {'name': 'Serious Eats', 'url': 'https://seriouseats.com'},
      {'name': 'Alexandra\'s Kitchen', 'url': 'https://alexandracooks.com'},
      {'name': 'Food & Wine', 'url': 'https://foodandwine.com'},
      {'name': 'Damn Delicious', 'url': 'https://damndelicious.net'},
      {'name': 'The Anthony Kitchen', 'url': 'https://theanthonykitchen.com'},
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: sites.map((site) => _buildSiteChip(site['name']!, site['url']!)).toList(),
    );
  }

  Widget _buildSiteChip(String name, String url) {
    return ActionChip(
      avatar: Icon(Icons.launch, size: 16, color: Colors.green.shade700),
      label: Text(
        name,
        style: TextStyle(color: Colors.green.shade700),
      ),
      backgroundColor: Colors.green.shade50,
      side: BorderSide(color: Colors.green.shade200),
      onPressed: () => _launchUrl(url),
    );
  }

  Widget _buildExtensionCard(String platform, ExtensionVersion extension, IconData icon, Color color) {
    final installedVersion = _installedVersions[platform.toLowerCase()];
    final updateAvailable = _updateAvailable[platform.toLowerCase()] ?? false;
    final isInstalled = installedVersion != null;

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
                        'Recipe Archive for $platform',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            'Latest: v${extension.version}',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.grey[600],
                            ),
                          ),
                          if (isInstalled) ...[
                            const Text(' • '),
                            Text(
                              'Installed: v$installedVersion',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: updateAvailable ? Colors.orange[700] : Colors.green[700],
                              ),
                            ),
                          ],
                          if (updateAvailable)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.orange[100],
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.orange[300]!),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.update,
                                    size: 14,
                                    color: Colors.orange[700],
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Update Available',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.orange[700],
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            Text(
              platform == 'Chrome' 
                ? 'Capture recipes from supported websites directly in Chrome. Works with 14+ recipe sites including Smitten Kitchen, Food52, Alexandra\'s Kitchen, and more.'
                : 'Native Safari extension for seamless recipe capturing. Optimized for Safari\'s privacy features and performance.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            
            const SizedBox(height: 16),
            
            Row(
              children: [
                Icon(Icons.info_outline, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  'File size: ${extension.formattedSize}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
                ),
                const Spacer(),
                if (_versions != null)
                  Text(
                    'Built: ${_versions!.lastUpdated.toLocal().toString().split(' ')[0]}',
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
                    onPressed: () => _downloadExtension(extension, platform),
                    icon: Icon(updateAvailable ? Icons.update : Icons.download),
                    label: Text(updateAvailable ? 'Update' : isInstalled ? 'Re-Download' : 'Download'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: updateAvailable ? Colors.orange : color,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton.icon(
                  onPressed: () => _showInstallationInstructions(platform),
                  icon: const Icon(Icons.help_outline),
                  label: const Text('Instructions'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                  ),
                ),
                if (isInstalled) ...[
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: () => _markAsUpdated(platform, extension.version),
                    icon: const Icon(Icons.check),
                    label: const Text('Mark Updated'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Browser Extensions'),
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
        actions: [
          if (!PlatformDetection.isMobile)
            IconButton(
              onPressed: _loadVersions,
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh',
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: PlatformDetection.isMobile ? () async {} : _loadVersions,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
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
                      'Recipe Archive Browser Extensions',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: Colors.green[800],
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      PlatformDetection.isMobile
                        ? 'Mobile browsers have limited web extension capabilities. Recipe Archive currently requires a desktop web browser (Chrome or Safari for macOS) with our browser extension installed to import recipes from websites.'
                        : 'Capture recipes directly from your browser while browsing your favorite recipe websites. Choose your browser below to download the extension.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: Colors.green[700],
                      ),
                    ),
                    if (_versions != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Last updated: ${_versions!.lastUpdated.toLocal().toString().split('.')[0]}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.green[600],
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 24),

              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_error != null)
                Center(
                  child: Column(
                    children: [
                      Icon(
                        Icons.error_outline,
                        size: 48,
                        color: Colors.red[400],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _error!,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: Colors.red[600],
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadVersions,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              else if (_versions != null) ...[
                // Show different content based on platform
                if (PlatformDetection.isMobile) ...[
                  _buildMobileHelpCard(),
                ] else ...[
                  LayoutBuilder(
                    builder: (context, constraints) {
                      if (constraints.maxWidth > 800) {
                        // Desktop layout - side by side
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: _buildExtensionCard(
                                'Chrome',
                                _versions!.chrome,
                                Icons.web,
                                Colors.blue,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: _buildExtensionCard(
                                'Safari',
                                _versions!.safari,
                                Icons.web,
                                Colors.orange,
                              ),
                            ),
                          ],
                        );
                      } else {
                        // Mobile layout - stacked
                        return Column(
                          children: [
                            _buildExtensionCard(
                              'Chrome',
                              _versions!.chrome,
                              Icons.web,
                              Colors.blue,
                            ),
                            const SizedBox(height: 16),
                            _buildExtensionCard(
                              'Safari',
                              _versions!.safari,
                              Icons.web,
                              Colors.orange,
                            ),
                          ],
                        );
                      }
                    },
                  ),
                ],
              ],

              // Always show Features and Supported Websites sections for all platforms
              const SizedBox(height: 32),

              // Features section
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Features',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildFeatureItem('🏃‍♂️ One-click recipe capture'),
                      _buildFeatureItem('🔐 Secure authentication with AWS Cognito'),
                      _buildFeatureItem('📱 Automatic image upload and optimization'),
                      _buildFeatureItem('🌐 Support for 14+ popular recipe websites'),
                      _buildFeatureItem('📊 Smart ingredient parsing and scaling'),
                      _buildFeatureItem('☁️ Cloud sync across all your devices'),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Supported Websites section
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.public, color: Colors.green[600], size: 28),
                          const SizedBox(width: 12),
                          Text(
                            'Supported Websites',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.green[700],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      Text(
                        PlatformDetection.isMobile
                          ? 'These recipe websites are supported by the Recipe Archive extension. Visit any of them on your desktop browser (with the extension installed) to capture recipes:'
                          : 'Click the extension icon while visiting any of these recipe websites to instantly capture recipes:',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey[600],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Recipe sites grid
                      _buildRecipeSitesGrid(),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeatureItem(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }

  Future<void> _downloadExtension(ExtensionVersion extension, String platform) async {
    // Trigger download
    _extensionService.downloadExtension(extension, platform);
    
    // Save the version as installed
    await _versionService.setInstalledVersion(platform.toLowerCase(), extension.version);
    
    // Refresh the UI to show the updated status
    await _loadVersions();
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$platform extension download started'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Future<void> _markAsUpdated(String platform, String version) async {
    await _versionService.markExtensionAsUpdated(platform.toLowerCase(), version);
    await _loadVersions();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$platform extension marked as updated to v$version'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri)) {
      throw Exception('Could not launch $url');
    }
  }
}