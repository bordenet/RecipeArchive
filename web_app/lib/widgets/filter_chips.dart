import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/recipe_service.dart';

// Providers for filter data
final cuisinesProvider = FutureProvider<List<String>>((ref) async {
  final recipeService = ref.read(recipeServiceProvider);
  return await recipeService.getCuisines();
});

final tagsProvider = FutureProvider<List<String>>((ref) async {
  final recipeService = ref.read(recipeServiceProvider);
  return await recipeService.getTags();
});

class RecipeFilterChips extends ConsumerStatefulWidget {
  final Map<String, dynamic> selectedFilters;
  final Function(Map<String, dynamic>) onFiltersChanged;

  const RecipeFilterChips({
    super.key,
    required this.selectedFilters,
    required this.onFiltersChanged,
  });

  @override
  ConsumerState<RecipeFilterChips> createState() => _RecipeFilterChipsState();
}

class _RecipeFilterChipsState extends ConsumerState<RecipeFilterChips> {
  bool _showAllFilters = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Quick filters row
        _buildQuickFilters(),
        
        // Show more filters button
        if (!_showAllFilters)
          TextButton.icon(
            onPressed: () {
              setState(() {
                _showAllFilters = true;
              });
            },
            icon: const Icon(Icons.tune, size: 16),
            label: const Text('More Filters'),
          ),
        
        // Extended filters
        if (_showAllFilters) ...[
          const SizedBox(height: 8),
          _buildExtendedFilters(),
          TextButton.icon(
            onPressed: () {
              setState(() {
                _showAllFilters = false;
              });
            },
            icon: const Icon(Icons.expand_less, size: 16),
            label: const Text('Show Less'),
          ),
        ],
      ],
    );
  }

  Widget _buildQuickFilters() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          // Favorites filter
          _buildFilterChip(
            label: 'Favorites',
            icon: Icons.favorite,
            isSelected: widget.selectedFilters['favoritesOnly'] == true,
            onSelected: (selected) {
              final newFilters = Map<String, dynamic>.from(widget.selectedFilters);
              if (selected) {
                newFilters['favoritesOnly'] = true;
              } else {
                newFilters.remove('favoritesOnly');
              }
              widget.onFiltersChanged(newFilters);
            },
          ),
          
          const SizedBox(width: 8),
          
          // Quick time filters
          _buildTimeFilterChip('Quick (≤30min)', 30),
          const SizedBox(width: 8),
          _buildTimeFilterChip('Medium (≤60min)', 60),
          const SizedBox(width: 8),
          
          // Popular tags
          ..._buildPopularTagChips(),
        ],
      ),
    );
  }

  Widget _buildExtendedFilters() {
    final cuisinesAsync = ref.watch(cuisinesProvider);
    final tagsAsync = ref.watch(tagsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Cuisine filter
        cuisinesAsync.when(
          data: (cuisines) => _buildCuisineFilter(cuisines),
          loading: () => const SizedBox(
            height: 40,
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, __) => const SizedBox.shrink(),
        ),
        
        const SizedBox(height: 16),
        
        // Tags filter
        tagsAsync.when(
          data: (tags) => _buildTagsFilter(tags),
          loading: () => const SizedBox(
            height: 40,
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, __) => const SizedBox.shrink(),
        ),
        
        const SizedBox(height: 16),
        
        // Time range filter
        _buildTimeRangeFilter(),
        
        const SizedBox(height: 16),
        
        // Clear filters button
        if (widget.selectedFilters.isNotEmpty)
          ElevatedButton.icon(
            onPressed: () {
              widget.onFiltersChanged({});
            },
            icon: const Icon(Icons.clear, size: 16),
            label: const Text('Clear All Filters'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Colors.white,
            ),
          ),
      ],
    );
  }

  Widget _buildFilterChip({
    required String label,
    IconData? icon,
    required bool isSelected,
    required Function(bool) onSelected,
  }) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16),
            const SizedBox(width: 4),
          ],
          Text(label),
        ],
      ),
      selected: isSelected,
      onSelected: onSelected,
      backgroundColor: Theme.of(context).colorScheme.surface,
      selectedColor: Theme.of(context).colorScheme.primary.withOpacity(0.2),
      checkmarkColor: Theme.of(context).colorScheme.primary,
    );
  }

  Widget _buildTimeFilterChip(String label, int maxMinutes) {
    final isSelected = widget.selectedFilters['maxTime'] == maxMinutes;
    
    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        final newFilters = Map<String, dynamic>.from(widget.selectedFilters);
        if (selected) {
          newFilters['maxTime'] = maxMinutes;
        } else {
          newFilters.remove('maxTime');
        }
        widget.onFiltersChanged(newFilters);
      },
      backgroundColor: Theme.of(context).colorScheme.surface,
      selectedColor: Theme.of(context).colorScheme.primary.withOpacity(0.2),
      checkmarkColor: Theme.of(context).colorScheme.primary,
    );
  }

  List<Widget> _buildPopularTagChips() {
    const popularTags = ['vegetarian', 'quick', 'healthy', 'dessert'];
    final selectedTags = List<String>.from(widget.selectedFilters['tags'] ?? []);
    
    return popularTags.map((tag) {
      final isSelected = selectedTags.contains(tag);
      
      return Container(
        margin: const EdgeInsets.only(right: 8),
        child: FilterChip(
          label: Text('#$tag'),
          selected: isSelected,
          onSelected: (selected) {
            final newFilters = Map<String, dynamic>.from(widget.selectedFilters);
            final newTags = List<String>.from(selectedTags);
            
            if (selected) {
              newTags.add(tag);
            } else {
              newTags.remove(tag);
            }
            
            if (newTags.isEmpty) {
              newFilters.remove('tags');
            } else {
              newFilters['tags'] = newTags;
            }
            
            widget.onFiltersChanged(newFilters);
          },
          backgroundColor: Theme.of(context).colorScheme.surface,
          selectedColor: Theme.of(context).colorScheme.secondary.withOpacity(0.2),
          checkmarkColor: Theme.of(context).colorScheme.secondary,
        ),
      );
    }).toList();
  }

  Widget _buildCuisineFilter(List<String> cuisines) {
    final selectedCuisine = widget.selectedFilters['cuisine'] as String?;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Cuisine',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: cuisines.map((cuisine) {
            final isSelected = selectedCuisine == cuisine;
            
            return FilterChip(
              label: Text(cuisine),
              selected: isSelected,
              onSelected: (selected) {
                final newFilters = Map<String, dynamic>.from(widget.selectedFilters);
                if (selected) {
                  newFilters['cuisine'] = cuisine;
                } else {
                  newFilters.remove('cuisine');
                }
                widget.onFiltersChanged(newFilters);
              },
              backgroundColor: Theme.of(context).colorScheme.surface,
              selectedColor: Theme.of(context).colorScheme.primary.withOpacity(0.2),
              checkmarkColor: Theme.of(context).colorScheme.primary,
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildTagsFilter(List<String> tags) {
    final selectedTags = List<String>.from(widget.selectedFilters['tags'] ?? []);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tags',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: tags.map((tag) {
            final isSelected = selectedTags.contains(tag);
            
            return FilterChip(
              label: Text('#$tag'),
              selected: isSelected,
              onSelected: (selected) {
                final newFilters = Map<String, dynamic>.from(widget.selectedFilters);
                final newTags = List<String>.from(selectedTags);
                
                if (selected) {
                  newTags.add(tag);
                } else {
                  newTags.remove(tag);
                }
                
                if (newTags.isEmpty) {
                  newFilters.remove('tags');
                } else {
                  newFilters['tags'] = newTags;
                }
                
                widget.onFiltersChanged(newFilters);
              },
              backgroundColor: Theme.of(context).colorScheme.surface,
              selectedColor: Theme.of(context).colorScheme.secondary.withOpacity(0.2),
              checkmarkColor: Theme.of(context).colorScheme.secondary,
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildTimeRangeFilter() {
    final maxTime = widget.selectedFilters['maxTime'] as int?;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Maximum cooking time: ${maxTime != null ? "${maxTime}min" : "Any"}',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        Slider(
          value: (maxTime ?? 120).toDouble(),
          min: 15,
          max: 240,
          divisions: 15,
          label: maxTime != null ? '${maxTime}min' : 'Any',
          onChanged: (value) {
            final newFilters = Map<String, dynamic>.from(widget.selectedFilters);
            newFilters['maxTime'] = value.round();
            widget.onFiltersChanged(newFilters);
          },
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('15min', style: Theme.of(context).textTheme.bodySmall),
            Text('4h+', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ],
    );
  }
}
