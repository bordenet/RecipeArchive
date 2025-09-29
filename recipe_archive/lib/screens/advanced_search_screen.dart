import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/advanced_search_service.dart';
import '../services/unified_analytics_service.dart';
import '../widgets/recipe_card.dart';
import 'recipe_detail_screen.dart';

// Provider for search state management
final searchParametersProvider = StateProvider<SearchParameters>((ref) => 
  const SearchParameters(limit: 20, sortBy: 'createdAt', sortOrder: 'desc'));

final searchResultProvider = FutureProvider.autoDispose.family<SearchResult, SearchParameters>(
  (ref, parameters) async {
    final searchService = ref.read(advancedSearchServiceProvider);
    final analyticsService = ref.read(unifiedAnalyticsServiceProvider);

    // Track search performance
    final stopwatch = Stopwatch()..start();
    final result = await searchService.searchRecipes(parameters);
    stopwatch.stop();

    // Only track analytics for actual user-initiated searches (not empty default searches)
    final hasValidSearchCriteria = parameters.query?.isNotEmpty == true ||
        parameters.semanticTags?.isNotEmpty == true ||
        parameters.primaryIngredients?.isNotEmpty == true ||
        parameters.cookingMethods?.isNotEmpty == true ||
        parameters.dietaryTags?.isNotEmpty == true ||
        parameters.flavorProfile?.isNotEmpty == true ||
        parameters.equipment?.isNotEmpty == true ||
        parameters.mealType?.isNotEmpty == true ||
        parameters.source?.isNotEmpty == true ||
        parameters.timeCategory != null ||
        parameters.complexity != null ||
        parameters.maxPrepTime != null ||
        parameters.maxCookTime != null ||
        parameters.maxTotalTime != null;

    if (hasValidSearchCriteria) {
      // Track search analytics only for intentional searches
      await analyticsService.trackSearch(
        query: parameters.query ?? '',
        resultCount: result.recipes.length,
        responseTimeMs: stopwatch.elapsedMilliseconds,
        searchParams: parameters,
      );
    }

    return result;
  },
);

class AdvancedSearchScreen extends ConsumerStatefulWidget {
  const AdvancedSearchScreen({super.key});

  @override
  ConsumerState<AdvancedSearchScreen> createState() => _AdvancedSearchScreenState();
}

class _AdvancedSearchScreenState extends ConsumerState<AdvancedSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _showFilters = false;

  
  // Filter controllers
  final TextEditingController _maxPrepTimeController = TextEditingController();
  final TextEditingController _maxCookTimeController = TextEditingController();
  final TextEditingController _maxTotalTimeController = TextEditingController();
  // Selected filter values
  List<String> _selectedSemanticTags = [];
  List<String> _selectedIngredients = [];
  List<String> _selectedCookingMethods = [];
  List<String> _selectedDietaryTags = [];
  List<String> _selectedFlavorProfile = [];
  List<String> _selectedEquipment = [];
  List<String> _selectedSourceWebsites = [];
  String? _selectedTimeCategory;
  String? _selectedComplexity;
  List<String> _selectedMealTypes = [];
  String _sortBy = 'createdAt';
  String _sortOrder = 'desc';
  
  // Common source websites for multi-select dropdown

  @override
  void initState() {
    super.initState();
    // Initialize with current search parameters
    final currentParams = ref.read(searchParametersProvider);
    _searchController.text = currentParams.query ?? '';
    _updateControllersFromParams(currentParams);
  }

  void _updateControllersFromParams(SearchParameters params) {
    _maxPrepTimeController.text = params.maxPrepTime?.toString() ?? '';
    _maxCookTimeController.text = params.maxCookTime?.toString() ?? '';
    _maxTotalTimeController.text = params.maxTotalTime?.toString() ?? '';
    // Parse source field - handle both single string and potential comma-separated values
    if (params.source != null && params.source!.isNotEmpty) {
      _selectedSourceWebsites = params.source!.split(',').map((s) => s.trim()).toList();
    } else {
      _selectedSourceWebsites = [];
    }
    
    _selectedSemanticTags = params.semanticTags ?? [];
    _selectedIngredients = params.primaryIngredients ?? [];
    _selectedCookingMethods = params.cookingMethods ?? [];
    _selectedDietaryTags = params.dietaryTags ?? [];
    _selectedFlavorProfile = params.flavorProfile ?? [];
    _selectedEquipment = params.equipment ?? [];
    _selectedTimeCategory = params.timeCategory;
    _selectedComplexity = params.complexity;
    _selectedMealTypes = params.mealType ?? [];
    _sortBy = params.sortBy ?? 'createdAt';
    _sortOrder = params.sortOrder ?? 'desc';
  }

  // Security validation for search terms
  String _sanitizeSearchInput(String input) {
    // Remove potentially dangerous characters and trim
    String sanitized = input
        .replaceAll('<', '')
        .replaceAll('>', '')
        .replaceAll('"', '')
        .replaceAll("'", '')
        .replaceAll('\\', '')
        .replaceAll('/', '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    // Enforce 256 character limit
    if (sanitized.length > 256) {
      sanitized = sanitized.substring(0, 256);
    }

    return sanitized;
  }

  void _performSearch() {
    final searchQuery = _searchController.text.isNotEmpty
        ? _sanitizeSearchInput(_searchController.text)
        : null;

    final parameters = SearchParameters(
      query: searchQuery,
      maxPrepTime: _parseIntInput(_maxPrepTimeController.text),
      maxCookTime: _parseIntInput(_maxCookTimeController.text),
      maxTotalTime: _parseIntInput(_maxTotalTimeController.text),
      semanticTags: _selectedSemanticTags.isNotEmpty ? _selectedSemanticTags : null,
      primaryIngredients: _selectedIngredients.isNotEmpty ? _selectedIngredients : null,
      cookingMethods: _selectedCookingMethods.isNotEmpty ? _selectedCookingMethods : null,
      dietaryTags: _selectedDietaryTags.isNotEmpty ? _selectedDietaryTags : null,
      flavorProfile: _selectedFlavorProfile.isNotEmpty ? _selectedFlavorProfile : null,
      equipment: _selectedEquipment.isNotEmpty ? _selectedEquipment : null,
      timeCategory: _selectedTimeCategory,
      complexity: _selectedComplexity,
      mealType: _selectedMealTypes.isNotEmpty ? _selectedMealTypes : null,
      source: _selectedSourceWebsites.isNotEmpty ? _selectedSourceWebsites.join(',') : null,
      sortBy: _sortBy,
      sortOrder: _sortOrder,
      limit: 20,
    );

    ref.read(searchParametersProvider.notifier).state = parameters;
  }

  int? _parseIntInput(String text) {
    if (text.isEmpty) return null;
    return int.tryParse(text);
  }

  void _clearAllFilters() {
    setState(() {
      _searchController.clear();
      _maxPrepTimeController.clear();
      _maxCookTimeController.clear();
      _selectedSourceWebsites.clear();

      _selectedSemanticTags.clear();
      _selectedIngredients.clear();
      _selectedCookingMethods.clear();
      _selectedDietaryTags.clear();
      _selectedFlavorProfile.clear();
      _selectedEquipment.clear();
      _selectedTimeCategory = null;
      _selectedComplexity = null;
      _selectedMealTypes.clear();
      _sortBy = 'createdAt';
      _sortOrder = 'desc';
    });

    // Reset to default parameters and trigger search
    ref.read(searchParametersProvider.notifier).state =
      const SearchParameters(limit: 20, sortBy: 'createdAt', sortOrder: 'desc');

    // Trigger a fresh search with cleared parameters
    _performSearch();
  }

  @override
  Widget build(BuildContext context) {
    final searchParams = ref.watch(searchParametersProvider);
    final searchResultAsync = ref.watch(searchResultProvider(searchParams));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Advanced Recipe Search'),
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: Icon(_showFilters ? Icons.filter_list : Icons.filter_list_outlined),
            onPressed: () {
              setState(() {
                _showFilters = !_showFilters;
              });
            },
            tooltip: _showFilters ? 'Hide filters' : 'Show filters',
          ),
          IconButton(
            icon: const Icon(Icons.clear_all),
            onPressed: _clearAllFilters,
            tooltip: 'Clear all filters',
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.grey[50],
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    maxLength: 256, // Enforce character limit
                    decoration: InputDecoration(
                      hintText: 'Search recipes by title, ingredients, or instructions...',
                      helperText: 'Max 256 characters',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              _performSearch();
                            },
                          )
                        : null,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Colors.green, width: 2),
                      ),
                      counterText: '', // Hide character counter
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    ),
                    onChanged: (value) => setState(() {}),
                    onSubmitted: (value) => _performSearch(),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 48, // Match input field height only
                  child: ElevatedButton(
                    onPressed: _performSearch,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Search'),
                  ),
                ),
              ],
            ),
          ),

          // Expandable filters section
          if (_showFilters) _buildScrollableFiltersSection(),

          // Results section
          Expanded(
            child: searchResultAsync.when(
              data: (result) => _buildSearchResults(result),
              loading: () => const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.green),
                    ),
                    SizedBox(height: 16),
                    Text('Searching recipes...'),
                  ],
                ),
              ),
              error: (error, stackTrace) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 64, color: Colors.red),
                    const SizedBox(height: 16),
                    Text(
                      'Search Error',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: Colors.red,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0),
                      child: Text(
                        error.toString(),
                        style: const TextStyle(color: Colors.grey),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _performSearch,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Retry Search'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScrollableFiltersSection() {
    return Container(
      constraints: const BoxConstraints(
        maxHeight: 200, // Fixed compact height
      ),
      child: SingleChildScrollView(
        child: _buildCompactFiltersSection(),
      ),
    );
  }

  Widget _buildCompactFiltersSection() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.grey[50],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Quick filters row - most commonly used
          Row(
            children: [
              Expanded(
                child: _buildMealTypeMultiSelect(),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildCompactDropdown(
                  'Time',
                  _selectedTimeCategory,
                  AdvancedSearchService.timeCategories,
                  (value) {
                    setState(() => _selectedTimeCategory = value);
                    _performSearch();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildCompactDropdown(
                  'Complexity',
                  _selectedComplexity,
                  AdvancedSearchService.complexityLevels,
                  (value) {
                    setState(() => _selectedComplexity = value);
                    _performSearch();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Active filter chips
          if (_hasActiveFilters()) ...[
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: _buildActiveFilterChips(),
            ),
            const SizedBox(height: 8),
          ],

          // Expandable detailed filters
          ExpansionTile(
            title: const Text('More Filters', style: TextStyle(fontSize: 14)),
            tilePadding: EdgeInsets.zero,
            childrenPadding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              _buildDetailedFiltersContent(),
            ],
          ),
        ],
      ),
    );
  }







  Widget _buildSearchResults(SearchResult result) {
    if (result.recipes.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'No recipes found',
              style: TextStyle(fontSize: 18, color: Colors.grey),
            ),
            SizedBox(height: 8),
            Text(
              'Try adjusting your search filters',
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Results header
        Container(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Text(
                'Found ${result.total} recipes',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (result.hasMore)
                Text(
                  'Showing first ${result.recipes.length}',
                  style: const TextStyle(color: Colors.grey),
                ),
            ],
          ),
        ),

        // Results grid
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              int crossAxisCount = _getCrossAxisCount(constraints.maxWidth);
              double childAspectRatio = _getChildAspectRatio(constraints.maxWidth);

              return GridView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(8),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: crossAxisCount,
                  childAspectRatio: childAspectRatio,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: result.recipes.length,
                itemBuilder: (context, index) {
                  final recipe = result.recipes[index];
                  return RecipeCard(
                    recipe: recipe,
                    onTap: () async {
                      // Track result click for analytics
                      final analyticsService = ref.read(unifiedAnalyticsServiceProvider);
                      final currentSearchParams = ref.read(searchParametersProvider);
                      await analyticsService.trackResultClick(
                        recipeId: recipe.id,
                        clickPosition: index + 1,
                        query: currentSearchParams.query,
                      );
                      
                      if (context.mounted) {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => RecipeDetailScreen(recipe: recipe),
                          ),
                        );
                      }
                    },
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  // Helper methods for responsive layout - matching HomeScreen geometry
  int _getCrossAxisCount(double screenWidth) {
    if (screenWidth > 1400) {
      return 5; // 5 columns for very wide screens
    } else if (screenWidth > 1100) {
      return 4; // 4 columns for wide screens
    } else if (screenWidth > 800) {
      return 3; // 3 columns for medium screens
    } else if (screenWidth > 600) {
      return 2; // 2 columns for tablets
    } else {
      return 1; // Single column for mobile
    }
  }

  double _getChildAspectRatio(double screenWidth) {
    // Use the same aspect ratios as HomeScreen for consistent card geometry
    if (screenWidth > 1400) {
      return 1.22; // Much wider and shorter for 5 columns
    } else if (screenWidth > 1100) {
      return 1.29; // Much wider and shorter for 4 columns
    } else if (screenWidth > 800) {
      return 1.44; // Wider and shorter for 3 columns
    } else if (screenWidth > 600) {
      return 1.58; // Wider and shorter for 2 columns
    } else {
      return 1.87; // Much wider and shorter for single column
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _maxPrepTimeController.dispose();
    _maxCookTimeController.dispose();
    _maxTotalTimeController.dispose();
    super.dispose();
  }

  // Helper methods for compact filters
  Widget _buildCompactDropdown(
    String label,
    String? value,
    List<String> options,
    void Function(String?) onChanged,
  ) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey[300]!),
        borderRadius: BorderRadius.circular(8),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Text(label, style: const TextStyle(fontSize: 12)),
          isExpanded: true,
          items: [
            DropdownMenuItem<String>(
              value: null,
              child: Text('Any $label', style: const TextStyle(fontSize: 12)),
            ),
            ...options.map((option) => DropdownMenuItem<String>(
              value: option,
              child: Text(option, style: const TextStyle(fontSize: 12)),
            )),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }

  bool _hasActiveFilters() {
    return _selectedSemanticTags.isNotEmpty ||
        _selectedIngredients.isNotEmpty ||
        _selectedCookingMethods.isNotEmpty ||
        _selectedDietaryTags.isNotEmpty ||
        _selectedSourceWebsites.isNotEmpty ||
        _maxPrepTimeController.text.isNotEmpty ||
        _maxCookTimeController.text.isNotEmpty;
  }

  List<Widget> _buildActiveFilterChips() {
    List<Widget> chips = [];

    // Add chips for selected tags
    for (String tag in _selectedSemanticTags) {
      chips.add(_buildFilterChip('Type: $tag', () {
        setState(() => _selectedSemanticTags.remove(tag));
        _performSearch();
      }));
    }

    for (String diet in _selectedDietaryTags) {
      chips.add(_buildFilterChip('Diet: $diet', () {
        setState(() => _selectedDietaryTags.remove(diet));
        _performSearch();
      }));
    }

    for (String method in _selectedCookingMethods) {
      chips.add(_buildFilterChip('Method: $method', () {
        setState(() => _selectedCookingMethods.remove(method));
        _performSearch();
      }));
    }

    // Add chips for selected meal types
    for (String mealType in _selectedMealTypes) {
      chips.add(_buildFilterChip('Meal: $mealType', () {
        setState(() => _selectedMealTypes.remove(mealType));
        _performSearch();
      }));
    }

    // Add chips for time ranges
    if (_maxPrepTimeController.text.isNotEmpty) {
      chips.add(_buildFilterChip('Prep: ≤${_maxPrepTimeController.text}min', () {
        _maxPrepTimeController.clear();
        _performSearch();
      }));
    }

    if (_maxCookTimeController.text.isNotEmpty) {
      chips.add(_buildFilterChip('Cook: ≤${_maxCookTimeController.text}min', () {
        _maxCookTimeController.clear();
        _performSearch();
      }));
    }

    return chips;
  }

  Widget _buildFilterChip(String label, VoidCallback onDeleted) {
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 11)),
      deleteIcon: const Icon(Icons.close, size: 14),
      onDeleted: onDeleted,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _buildDetailedFiltersContent() {
    return Column(
      children: [
        // Compact time inputs
        Row(
          children: [
            Expanded(child: _buildCompactTimeInput('Max Prep', _maxPrepTimeController)),
            const SizedBox(width: 8),
            Expanded(child: _buildCompactTimeInput('Max Cook', _maxCookTimeController)),
          ],
        ),
        const SizedBox(height: 8),

        // Tag selection with chips
        _buildExpandableTagSection('Recipe Types', AdvancedSearchService.commonSemanticTags, _selectedSemanticTags),
        _buildExpandableTagSection('Dietary', AdvancedSearchService.commonDietaryTags, _selectedDietaryTags),
        _buildExpandableTagSection('Cooking Methods', AdvancedSearchService.commonCookingMethods, _selectedCookingMethods),
      ],
    );
  }

  Widget _buildCompactTimeInput(String label, TextEditingController controller) {
    return SizedBox(
      height: 32,
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          labelStyle: const TextStyle(fontSize: 10),
        ),
        style: const TextStyle(fontSize: 12),
        keyboardType: TextInputType.number,
        onSubmitted: (_) => _performSearch(),
      ),
    );
  }

  Widget _buildExpandableTagSection(String title, List<String> options, List<String> selected) {
    return ExpansionTile(
      title: Text('$title (${selected.length})', style: const TextStyle(fontSize: 12)),
      tilePadding: EdgeInsets.zero,
      childrenPadding: const EdgeInsets.symmetric(vertical: 4),
      children: [
        Wrap(
          spacing: 4,
          runSpacing: 2,
          children: options.map((option) => FilterChip(
            label: Text(option, style: const TextStyle(fontSize: 10)),
            selected: selected.contains(option),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            visualDensity: VisualDensity.compact,
            onSelected: (isSelected) {
              setState(() {
                if (isSelected) {
                  selected.add(option);
                } else {
                  selected.remove(option);
                }
              });
              _performSearch();
            },
          )).toList(),
        ),
      ],
    );
  }

  Widget _buildMealTypeMultiSelect() {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade400),
        borderRadius: BorderRadius.circular(4),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          hint: Text('Meal Type', style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
          value: null, // Always null to show hint
          isExpanded: true,
          isDense: true,
          items: [
            // "Select All" option
            DropdownMenuItem<String>(
              value: '__select_all__',
              child: Row(
                children: [
                  Icon(
                    _selectedMealTypes.length == AdvancedSearchService.mealTypes.length
                      ? Icons.check_box
                      : Icons.check_box_outline_blank,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  const Text('Select All', style: TextStyle(fontSize: 14)),
                ],
              ),
            ),
            const DropdownMenuItem<String>(
              value: '__divider__',
              enabled: false,
              child: Divider(height: 1),
            ),
            // Individual meal type options
            ...AdvancedSearchService.mealTypes.map((mealType) =>
              DropdownMenuItem<String>(
                value: mealType,
                child: Row(
                  children: [
                    Icon(
                      _selectedMealTypes.contains(mealType)
                        ? Icons.check_box
                        : Icons.check_box_outline_blank,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(mealType, style: const TextStyle(fontSize: 14))),
                  ],
                ),
              ),
            ),
          ],
          onChanged: (String? value) {
            if (value == null || value == '__divider__') return;

            setState(() {
              if (value == '__select_all__') {
                // Toggle select all
                if (_selectedMealTypes.length == AdvancedSearchService.mealTypes.length) {
                  _selectedMealTypes.clear();
                } else {
                  _selectedMealTypes = List.from(AdvancedSearchService.mealTypes);
                }
              } else {
                // Toggle individual item
                if (_selectedMealTypes.contains(value)) {
                  _selectedMealTypes.remove(value);
                } else {
                  _selectedMealTypes.add(value);
                }
              }
            });
            _performSearch();
          },
          selectedItemBuilder: (BuildContext context) {
            return AdvancedSearchService.mealTypes.map<Widget>((String item) {
              return Container(
                alignment: Alignment.centerLeft,
                child: Text(
                  _selectedMealTypes.isEmpty
                    ? 'Meal Type'
                    : '${_selectedMealTypes.length} selected',
                  style: TextStyle(
                    color: _selectedMealTypes.isEmpty ? Colors.grey.shade600 : Colors.black,
                    fontSize: 14,
                  ),
                ),
              );
            }).toList();
          },
        ),
      ),
    );
  }
}