/// Information chips for recipe metadata (time, servings, source)
library;

import 'package:flutter/material.dart';
import '../../models/recipe.dart';

/// Displays recipe metadata as interactive chips
class RecipeInfoChips extends StatelessWidget {
  final Recipe recipe;
  final int currentServings;
  final VoidCallback onServingsTap;

  const RecipeInfoChips({
    super.key,
    required this.recipe,
    required this.currentServings,
    required this.onServingsTap,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 8,
      children: [
        // Cooking Time
        _buildInfoChip(
          Icons.access_time,
          recipe.displayTime,
        ),

        // Servings (clickable)
        GestureDetector(
          onTap: onServingsTap,
          child: _buildInfoChip(
            Icons.people,
            currentServings == 1 ? '1 serving' : '$currentServings servings',
            color: currentServings != (recipe.servings ?? 4)
                ? Colors.blue
                : null,
          ),
        ),

        // Source (if available)
        if (recipe.sourceUrl != null)
          _buildInfoChip(
            Icons.link,
            recipe.displaySourceName,
          ),

        // Difficulty (if available)
        if (recipe.difficulty != null && recipe.difficulty!.isNotEmpty)
          _buildInfoChip(
            Icons.signal_cellular_alt,
            recipe.difficulty!,
          ),
      ],
    );
  }

  Widget _buildInfoChip(IconData icon, String text, {Color? color}) {
    return Chip(
      avatar: Icon(icon, size: 16, color: color ?? Colors.grey[700]),
      label: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          color: color ?? Colors.grey[800],
        ),
      ),
      backgroundColor: Colors.grey[100],
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );
  }
}
