import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class OnboardingContent extends StatelessWidget {
  const OnboardingContent({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Welcome icon
            Icon(
              Icons.restaurant_menu,
              size: 80,
              color: Colors.green.shade400,
            ),
            const SizedBox(height: 24),

            // Welcome message
            Text(
              'Welcome to Recipe Archive!',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: Colors.green.shade700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),

            Text(
              'Capture, organize, and manage your favorite recipes from across the web.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.grey.shade600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),

            // Getting started section
            Card(
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.extension, color: Colors.green.shade600),
                        const SizedBox(width: 8),
                        Text(
                          'Get Started',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.green.shade700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    
                    _buildStep(
                      context,
                      '1',
                      'Install Browser Extension',
                      'Download our browser extension to start capturing recipes with a single click.',
                      Icons.download,
                    ),
                    const SizedBox(height: 12),
                    
                    _buildStep(
                      context,
                      '2',
                      'Visit Recipe Sites',
                      'Browse your favorite recipe websites and click the extension icon.',
                      Icons.web,
                    ),
                    const SizedBox(height: 12),
                    
                    _buildStep(
                      context,
                      '3',
                      'Build Your Archive',
                      'Your recipes will appear here, organized and searchable.',
                      Icons.archive,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Supported sites section
            Card(
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.public, color: Colors.green.shade600),
                        const SizedBox(width: 8),
                        Text(
                          'Supported Recipe Sites',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.green.shade700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    
                    Text(
                      'Click on any site below to start collecting recipes:',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Recipe sites grid
                    _buildRecipeSitesGrid(context),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Extension download button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _launchExtensionsScreen(context),
                icon: const Icon(Icons.extension),
                label: const Text('Download Browser Extension'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  textStyle: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(BuildContext context, String number, String title, String description, IconData icon) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: Colors.green.shade100,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              number,
              style: TextStyle(
                color: Colors.green.shade700,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 20, color: Colors.green.shade600),
                  const SizedBox(width: 6),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey.shade600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildRecipeSitesGrid(BuildContext context) {
    final sites = [
      {'name': 'Smitten Kitchen', 'url': 'https://smittenkitchen.com'},
      {'name': 'Food52', 'url': 'https://food52.com'},
      {'name': 'NYT Cooking', 'url': 'https://cooking.nytimes.com'},
      {'name': 'Food Network', 'url': 'https://foodnetwork.com'},
      {'name': 'Washington Post', 'url': 'https://washingtonpost.com/food'},
      {'name': 'Love & Lemons', 'url': 'https://loveandlemons.com'},
      {'name': 'AllRecipes', 'url': 'https://allrecipes.com'},
      {'name': 'Epicurious', 'url': 'https://epicurious.com'},
      {'name': 'Serious Eats', 'url': 'https://seriouseats.com'},
      {'name': 'Alexandra\'s Kitchen', 'url': 'https://alexandrascooking.com'},
      {'name': 'Food & Wine', 'url': 'https://foodandwine.com'},
      {'name': 'Damn Delicious', 'url': 'https://damndelicious.net'},
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: sites.map((site) => _buildSiteChip(context, site['name']!, site['url']!)).toList(),
    );
  }

  Widget _buildSiteChip(BuildContext context, String name, String url) {
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

  void _launchExtensionsScreen(BuildContext context) {
    Navigator.of(context).pushNamed('/extensions');
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri)) {
      throw Exception('Could not launch $url');
    }
  }
}