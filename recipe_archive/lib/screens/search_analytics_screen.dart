import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/unified_analytics_service.dart';

class SearchAnalyticsScreen extends ConsumerStatefulWidget {
  const SearchAnalyticsScreen({super.key});

  @override
  ConsumerState<SearchAnalyticsScreen> createState() => _SearchAnalyticsScreenState();
}

class _SearchAnalyticsScreenState extends ConsumerState<SearchAnalyticsScreen> {
  UnifiedAnalyticsSummary? _summary;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAnalytics();
  }

  Future<void> _loadAnalytics() async {
    setState(() => _isLoading = true);
    
    final analyticsService = ref.read(unifiedAnalyticsServiceProvider);
    final summary = await analyticsService.getUnifiedSummary();
    
    setState(() {
      _summary = summary;
      _isLoading = false;
    });
  }

  Future<void> _syncAndRefresh() async {
    final analyticsService = ref.read(unifiedAnalyticsServiceProvider);

    // Show loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 20),
            Text('Syncing & refreshing analytics...'),
          ],
        ),
      ),
    );

    try {
      final success = await analyticsService.syncToS3();

      // Close loading dialog
      if (mounted) Navigator.of(context).pop();

      // Show result
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success
              ? '✅ Analytics synced & refreshed successfully!'
              : '❌ Failed to sync analytics. Check debug console.'),
            backgroundColor: success ? Colors.green : Colors.red,
          ),
        );
      }

      // Reload analytics if successful
      if (success) {
        await _loadAnalytics();
      }
    } catch (e) {
      // Close loading dialog
      if (mounted) Navigator.of(context).pop();

      // Show error
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Error syncing analytics: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _clearAnalytics() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Analytics Data'),
        content: const Text('This will permanently delete all search analytics data. Are you sure?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Clear'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final analyticsService = ref.read(unifiedAnalyticsServiceProvider);
      await analyticsService.clearAnalytics();
      await _loadAnalytics();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Search Analytics'),
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            tooltip: 'Sync & Refresh Analytics',
            onPressed: _syncAndRefresh,
          ),
          IconButton(
            icon: const Icon(Icons.clear_all),
            onPressed: _clearAnalytics,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildMetricsOverview(),
                  const SizedBox(height: 24),
                  _buildPopularQueries(),
                  const SizedBox(height: 24),
                  _buildPopularFilters(),
                  const SizedBox(height: 24),
                  _buildDeviceBreakdown(),
                  const SizedBox(height: 24),
                  _buildTopClickedRecipes(),
                ],
              ),
            ),
    );
  }

  Widget _buildMetricsOverview() {
    if (_summary == null) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Cross-Device Search Performance',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildMetricCard(
                    'Total Searches',
                    _summary!.totalSearches.toString(),
                    Icons.search,
                    Colors.blue,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildMetricCard(
                    'Total Clicks',
                    _summary!.totalClicks.toString(),
                    Icons.touch_app,
                    Colors.green,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _buildMetricCard(
                    'Avg Response Time',
                    '${_summary!.averageResponseTimeMs}ms',
                    Icons.timer,
                    Colors.orange,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildMetricCard(
                    'Last Updated',
                    _formatDateTime(_summary!.lastUpdated),
                    Icons.update,
                    Colors.purple,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 16),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    color: color.withValues(alpha: 0.8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPopularQueries() {
    if (_summary?.popularQueries.isEmpty ?? true) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No search queries recorded yet.'),
        ),
      );
    }

    final sortedQueries = _summary!.popularQueries.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Popular Search Terms',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ...sortedQueries.take(10).map((entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      entry.key,
                      style: const TextStyle(fontFamily: 'monospace'),
                    ),
                  ),
                  Chip(
                    label: Text('${entry.value}'),
                    backgroundColor: Colors.green.withValues(alpha: 0.1),
                    side: BorderSide(color: Colors.green.withValues(alpha: 0.3)),
                  ),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildPopularFilters() {
    if (_summary?.popularFilters.isEmpty ?? true) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No filters used yet.'),
        ),
      );
    }

    final sortedFilters = _summary!.popularFilters.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Popular Filters',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ...sortedFilters.take(15).map((entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      entry.key,
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                    ),
                  ),
                  Chip(
                    label: Text('${entry.value}'),
                    backgroundColor: Colors.blue.withValues(alpha: 0.1),
                    side: BorderSide(color: Colors.blue.withValues(alpha: 0.3)),
                  ),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceBreakdown() {
    if (_summary?.deviceBreakdown.isEmpty ?? true) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No device data available yet.'),
        ),
      );
    }

    final sortedDevices = _summary!.deviceBreakdown.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Device Usage',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ...sortedDevices.map((entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Icon(_getDeviceIcon(entry.key), size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _getDeviceLabel(entry.key),
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                  Chip(
                    label: Text('${entry.value}'),
                    backgroundColor: Colors.purple.withValues(alpha: 0.1),
                    side: BorderSide(color: Colors.purple.withValues(alpha: 0.3)),
                  ),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildTopClickedRecipes() {
    if (_summary?.topClickedRecipes.isEmpty ?? true) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No recipe clicks recorded yet.'),
        ),
      );
    }

    final sortedRecipes = _summary!.topClickedRecipes.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Most Clicked Recipes',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ...sortedRecipes.take(10).map((entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      entry.key.length > 40 ? '${entry.key.substring(0, 37)}...' : entry.key,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                  Chip(
                    label: Text('${entry.value}'),
                    backgroundColor: Colors.teal.withValues(alpha: 0.1),
                    side: BorderSide(color: Colors.teal.withValues(alpha: 0.3)),
                  ),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  IconData _getDeviceIcon(String deviceType) {
    switch (deviceType.toLowerCase()) {
      case 'ios':
        return Icons.phone_iphone;
      case 'android':
        return Icons.phone_android;
      case 'web':
        return Icons.web;
      default:
        return Icons.device_unknown;
    }
  }

  String _getDeviceLabel(String deviceType) {
    switch (deviceType.toLowerCase()) {
      case 'ios':
        return 'iPhone/iPad';
      case 'android':
        return 'Android';
      case 'web':
        return 'Web Browser';
      default:
        return 'Unknown Device';
    }
  }

  String _formatDateTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);
    
    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${dateTime.month}/${dateTime.day}/${dateTime.year}';
    }
  }
}