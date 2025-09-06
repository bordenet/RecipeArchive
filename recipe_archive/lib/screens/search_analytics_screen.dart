import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/search_analytics_service.dart';

class SearchAnalyticsScreen extends ConsumerStatefulWidget {
  const SearchAnalyticsScreen({super.key});

  @override
  ConsumerState<SearchAnalyticsScreen> createState() => _SearchAnalyticsScreenState();
}

class _SearchAnalyticsScreenState extends ConsumerState<SearchAnalyticsScreen> {
  SearchMetrics? _metrics;
  List<SearchAnalyticsEvent>? _recentEvents;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAnalytics();
  }

  Future<void> _loadAnalytics() async {
    setState(() => _isLoading = true);
    
    final analyticsService = ref.read(searchAnalyticsServiceProvider);
    final metrics = await analyticsService.getMetrics();
    final events = await analyticsService.getRecentEvents(limit: 20);
    
    setState(() {
      _metrics = metrics;
      _recentEvents = events;
      _isLoading = false;
    });
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
      final analyticsService = ref.read(searchAnalyticsServiceProvider);
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
            icon: const Icon(Icons.refresh),
            onPressed: _loadAnalytics,
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
                  _buildRecentActivity(),
                ],
              ),
            ),
    );
  }

  Widget _buildMetricsOverview() {
    if (_metrics == null) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Search Performance',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildMetricCard(
                    'Total Searches',
                    _metrics!.totalSearches.toString(),
                    Icons.search,
                    Colors.blue,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildMetricCard(
                    'Avg Response Time',
                    '${_metrics!.averageResponseTimeMs}ms',
                    Icons.timer,
                    Colors.orange,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _buildMetricCard(
                    'Avg Results',
                    _metrics!.averageResultCount.toStringAsFixed(1),
                    Icons.list_alt,
                    Colors.green,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildMetricCard(
                    'Last Updated',
                    _formatDateTime(_metrics!.lastUpdated),
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
    if (_metrics?.popularQueries.isEmpty ?? true) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No search queries recorded yet.'),
        ),
      );
    }

    final sortedQueries = _metrics!.popularQueries.entries.toList()
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
    if (_metrics?.popularFilters.isEmpty ?? true) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No filters used yet.'),
        ),
      );
    }

    final sortedFilters = _metrics!.popularFilters.entries.toList()
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

  Widget _buildRecentActivity() {
    if (_recentEvents?.isEmpty ?? true) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('No recent activity.'),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Recent Search Activity',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ...(_recentEvents ?? []).take(15).map((event) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Icon(
                    _getEventIcon(event.eventType),
                    size: 16,
                    color: _getEventColor(event.eventType),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _getEventDescription(event),
                          style: const TextStyle(fontSize: 13),
                        ),
                        Text(
                          _formatDateTime(event.timestamp),
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  IconData _getEventIcon(SearchEventType eventType) {
    switch (eventType) {
      case SearchEventType.search:
        return Icons.search;
      case SearchEventType.resultClick:
        return Icons.touch_app;
      case SearchEventType.filterApplied:
        return Icons.filter_list;
      case SearchEventType.searchCleared:
        return Icons.clear;
    }
  }

  Color _getEventColor(SearchEventType eventType) {
    switch (eventType) {
      case SearchEventType.search:
        return Colors.blue;
      case SearchEventType.resultClick:
        return Colors.green;
      case SearchEventType.filterApplied:
        return Colors.orange;
      case SearchEventType.searchCleared:
        return Colors.red;
    }
  }

  String _getEventDescription(SearchAnalyticsEvent event) {
    switch (event.eventType) {
      case SearchEventType.search:
        final query = event.query?.isNotEmpty == true ? '"${event.query}"' : '(empty query)';
        return 'Search $query → ${event.resultCount ?? 0} results (${event.responseTimeMs ?? 0}ms)';
      case SearchEventType.resultClick:
        return 'Clicked recipe at position ${event.clickPosition ?? 0}';
      case SearchEventType.filterApplied:
        return 'Applied filter: ${event.filters?.entries.first.key ?? 'unknown'}';
      case SearchEventType.searchCleared:
        return 'Cleared search filters';
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