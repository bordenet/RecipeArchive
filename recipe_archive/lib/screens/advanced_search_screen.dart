import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/advanced_search_service.dart';
import '../widgets/recipe_card.dart';
import '../models/recipe.dart';
import 'recipe_detail_screen.dart';

// Provider for search state management
final searchParametersProvider = StateProvider<SearchParameters>((ref) => 
  const SearchParameters(limit: 20, sortBy: 'createdAt', sortOrder: 'desc'));

final searchResultProvider = FutureProvider.autoDispose.family<SearchResult, SearchParameters>(
  (ref, parameters) async {
    final searchService = ref.read(advancedSearchServiceProvider);
    return await searchService.searchRecipes(parameters);
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
  final TextEditingController _minPrepTimeController = TextEditingController();
  final TextEditingController _maxPrepTimeController = TextEditingController();
  final TextEditingController _minCookTimeController = TextEditingController();
  final TextEditingController _maxCookTimeController = TextEditingController();
  final TextEditingController _minServingsController = TextEditingController();
  final TextEditingController _maxServingsController = TextEditingController();
  final TextEditingController _sourceController = TextEditingController();

  // Selected filter values
  List<String> _selectedSemanticTags = [];
  List<String> _selectedIngredients = [];
  List<String> _selectedCookingMethods = [];
  List<String> _selectedDietaryTags = [];
  List<String> _selectedFlavorProfile = [];
  List<String> _selectedEquipment = [];
  String? _selectedTimeCategory;
  String? _selectedComplexity;
  String _sortBy = 'createdAt';
  String _sortOrder = 'desc';

  @override
  void initState() {
    super.initState();
    // Initialize with current search parameters
    final currentParams = ref.read(searchParametersProvider);
    _searchController.text = currentParams.query ?? '';
    _updateControllersFromParams(currentParams);
  }

  void _updateControllersFromParams(SearchParameters params) {
    _minPrepTimeController.text = params.minPrepTime?.toString() ?? '';
    _maxPrepTimeController.text = params.maxPrepTime?.toString() ?? '';
    _minCookTimeController.text = params.minCookTime?.toString() ?? '';
    _maxCookTimeController.text = params.maxCookTime?.toString() ?? '';
    _minServingsController.text = params.minServings?.toString() ?? '';
    _maxServingsController.text = params.maxServings?.toString() ?? '';
    _sourceController.text = params.source ?? '';
    
    _selectedSemanticTags = params.semanticTags ?? [];
    _selectedIngredients = params.primaryIngredients ?? [];
    _selectedCookingMethods = params.cookingMethods ?? [];
    _selectedDietaryTags = params.dietaryTags ?? [];
    _selectedFlavorProfile = params.flavorProfile ?? [];
    _selectedEquipment = params.equipment ?? [];
    _selectedTimeCategory = params.timeCategory;
    _selectedComplexity = params.complexity;
    _sortBy = params.sortBy ?? 'createdAt';
    _sortOrder = params.sortOrder ?? 'desc';
  }

  void _performSearch() {
    final parameters = SearchParameters(
      query: _searchController.text.isNotEmpty ? _searchController.text : null,
      minPrepTime: _parseIntInput(_minPrepTimeController.text),
      maxPrepTime: _parseIntInput(_maxPrepTimeController.text),
      minCookTime: _parseIntInput(_minCookTimeController.text),
      maxCookTime: _parseIntInput(_maxCookTimeController.text),
      minServings: _parseIntInput(_minServingsController.text),
      maxServings: _parseIntInput(_maxServingsController.text),
      semanticTags: _selectedSemanticTags.isNotEmpty ? _selectedSemanticTags : null,
      primaryIngredients: _selectedIngredients.isNotEmpty ? _selectedIngredients : null,
      cookingMethods: _selectedCookingMethods.isNotEmpty ? _selectedCookingMethods : null,
      dietaryTags: _selectedDietaryTags.isNotEmpty ? _selectedDietaryTags : null,
      flavorProfile: _selectedFlavorProfile.isNotEmpty ? _selectedFlavorProfile : null,
      equipment: _selectedEquipment.isNotEmpty ? _selectedEquipment : null,
      timeCategory: _selectedTimeCategory,
      complexity: _selectedComplexity,
      source: _sourceController.text.isNotEmpty ? _sourceController.text : null,
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
      _minPrepTimeController.clear();
      _maxPrepTimeController.clear();
      _minCookTimeController.clear();
      _maxCookTimeController.clear();
      _minServingsController.clear();
      _maxServingsController.clear();
      _sourceController.clear();
      
      _selectedSemanticTags.clear();
      _selectedIngredients.clear();
      _selectedCookingMethods.clear();
      _selectedDietaryTags.clear();
      _selectedFlavorProfile.clear();
      _selectedEquipment.clear();
      _selectedTimeCategory = null;
      _selectedComplexity = null;
      _sortBy = 'createdAt';
      _sortOrder = 'desc';
    });
    
    // Reset to default parameters
    ref.read(searchParametersProvider.notifier).state = 
      const SearchParameters(limit: 20, sortBy: 'createdAt', sortOrder: 'desc');
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
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search recipes by title, ingredients, or instructions...',
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
                    ),
                    onChanged: (value) => setState(() {}),
                    onSubmitted: (value) => _performSearch(),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _performSearch,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  child: const Text('Search'),
                ),
              ],
            ),
          ),

          // Expandable filters section
          if (_showFilters) _buildFiltersSection(),

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

  Widget _buildFiltersSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.grey[50],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Advanced Filters',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),

          // Time filters
          _buildSectionTitle('Cooking Time (minutes)'),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _minPrepTimeController,
                  decoration: const InputDecoration(
                    labelText: 'Min Prep Time',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _maxPrepTimeController,
                  decoration: const InputDecoration(
                    labelText: 'Max Prep Time',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _minCookTimeController,
                  decoration: const InputDecoration(
                    labelText: 'Min Cook Time',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _maxCookTimeController,
                  decoration: const InputDecoration(
                    labelText: 'Max Cook Time',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Servings filters
          _buildSectionTitle('Servings'),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _minServingsController,
                  decoration: const InputDecoration(
                    labelText: 'Min Servings',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _maxServingsController,
                  decoration: const InputDecoration(
                    labelText: 'Max Servings',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Semantic tags (recipe type)
          _buildTagSection('Recipe Type', AdvancedSearchService.commonSemanticTags, _selectedSemanticTags),
          const SizedBox(height: 16),

          // Dietary tags
          _buildTagSection('Dietary Requirements', AdvancedSearchService.commonDietaryTags, _selectedDietaryTags),
          const SizedBox(height: 16),

          // Cooking methods
          _buildTagSection('Cooking Methods', AdvancedSearchService.commonCookingMethods, _selectedCookingMethods),
          const SizedBox(height: 16),

          // Time category and complexity
          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  'Time Category',
                  _selectedTimeCategory,
                  AdvancedSearchService.timeCategories,
                  (value) => setState(() => _selectedTimeCategory = value),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildDropdown(
                  'Complexity',
                  _selectedComplexity,
                  AdvancedSearchService.complexityLevels,
                  (value) => setState(() => _selectedComplexity = value),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Sorting options
          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  'Sort By',
                  _sortBy,
                  AdvancedSearchService.sortOptions,
                  (value) => setState(() => _sortBy = value ?? 'createdAt'),
                  allowNull: false,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildDropdown(
                  'Sort Order',
                  _sortOrder,
                  ['desc', 'asc'],
                  (value) => setState(() => _sortOrder = value ?? 'desc'),
                  allowNull: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Source filter
          TextField(
            controller: _sourceController,
            decoration: const InputDecoration(
              labelText: 'Source Website (e.g., smittenkitchen)',
              border: OutlineInputBorder(),
              helperText: 'Filter by recipe source website',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w600,
          color: Colors.green[700],
        ),
      ),
    );
  }

  Widget _buildTagSection(String title, List<String> options, List<String> selectedTags) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(title),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: options.map((tag) {
            final isSelected = selectedTags.contains(tag);
            return FilterChip(
              label: Text(tag),
              selected: isSelected,
              onSelected: (selected) {
                setState(() {
                  if (selected) {
                    selectedTags.add(tag);
                  } else {
                    selectedTags.remove(tag);
                  }
                });
              },
              selectedColor: Colors.green[100],
              checkmarkColor: Colors.green[700],
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildDropdown(String label, String? value, List<String> options, 
                       Function(String?) onChanged, {bool allowNull = true}) {
    return DropdownButtonFormField<String>(
      value: value,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      items: [
        if (allowNull)
          const DropdownMenuItem<String>(
            value: null,
            child: Text('Any'),
          ),
        ...options.map((option) => DropdownMenuItem<String>(
          value: option,
          child: Text(option.replaceAll('-', ' ').toUpperCase()),
        )),
      ],
      onChanged: onChanged,
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
              int crossAxisCount = 1;
              double childAspectRatio = 1.1;
              
              if (constraints.maxWidth > 1400) {
                crossAxisCount = 5;
                childAspectRatio = 0.85;
              } else if (constraints.maxWidth > 1100) {
                crossAxisCount = 4;
                childAspectRatio = 0.9;
              } else if (constraints.maxWidth > 800) {
                crossAxisCount = 3;
                childAspectRatio = 0.95;
              } else if (constraints.maxWidth > 600) {
                crossAxisCount = 2;
                childAspectRatio = 1.0;
              }

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
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => RecipeDetailScreen(recipe: recipe),
                        ),
                      );
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

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _minPrepTimeController.dispose();
    _maxPrepTimeController.dispose();
    _minCookTimeController.dispose();
    _maxCookTimeController.dispose();
    _minServingsController.dispose();
    _maxServingsController.dispose();
    _sourceController.dispose();
    super.dispose();
  }
}