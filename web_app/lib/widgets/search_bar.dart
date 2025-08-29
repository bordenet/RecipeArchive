import 'package:flutter/material.dart';

class RecipeSearchBar extends StatefulWidget {
  final Function(String) onSearchChanged;
  final String initialQuery;

  const RecipeSearchBar({
    super.key,
    required this.onSearchChanged,
    this.initialQuery = '',
  });

  @override
  State<RecipeSearchBar> createState() => _RecipeSearchBarState();
}

class _RecipeSearchBarState extends State<RecipeSearchBar> {
  late TextEditingController _controller;
  bool _isSearching = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.3),
        ),
      ),
      child: TextField(
        controller: _controller,
        onChanged: (value) {
          setState(() {
            _isSearching = value.isNotEmpty;
          });
          widget.onSearchChanged(value);
        },
        decoration: InputDecoration(
          hintText: 'Search recipes, ingredients, cuisines...',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _isSearching
            ? IconButton(
                onPressed: () {
                  _controller.clear();
                  setState(() {
                    _isSearching = false;
                  });
                  widget.onSearchChanged('');
                },
                icon: const Icon(Icons.clear),
              )
            : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 12,
          ),
        ),
      ),
    );
  }
}
