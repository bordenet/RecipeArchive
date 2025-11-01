/// Recipe instructions display with cooking method support
library;

import 'package:flutter/material.dart';
import '../../models/recipe.dart';
import '../../utils/units_converter.dart';

/// Displays recipe instructions with optional cooking method selection
class RecipeInstructions extends StatefulWidget {
  final Recipe recipe;
  final bool useMetricUnits;
  final int initialMethodIndex;

  const RecipeInstructions({
    super.key,
    required this.recipe,
    this.useMetricUnits = false,
    this.initialMethodIndex = 0,
  });

  @override
  State<RecipeInstructions> createState() => _RecipeInstructionsState();
}

class _RecipeInstructionsState extends State<RecipeInstructions> {
  late int selectedCookingMethodIndex;

  @override
  void initState() {
    super.initState();
    selectedCookingMethodIndex = widget.initialMethodIndex;
  }

  @override
  Widget build(BuildContext context) {
    final hasCookingMethods = widget.recipe.cookingMethodOptions.isNotEmpty;
    final hasMultipleCookingMethods =
        widget.recipe.cookingMethodOptions.length > 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with method selection
        Row(
          children: [
            Text(
              'Instructions',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            if (hasMultipleCookingMethods) ...[
              const Spacer(),
              _buildMethodSelector(),
            ],
          ],
        ),
        const SizedBox(height: 12),

        // Method-specific info
        if (hasCookingMethods) ...[
          _buildCookingMethodInfo(
            widget.recipe.cookingMethodOptions[selectedCookingMethodIndex],
          ),
          const SizedBox(height: 16),
        ],

        // Instructions list
        ..._getDisplayInstructions().map(_buildInstructionStep),
      ],
    );
  }

  Widget _buildMethodSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: DropdownButton<int>(
        value: selectedCookingMethodIndex,
        underline: const SizedBox(),
        isDense: true,
        items: widget.recipe.cookingMethodOptions
            .asMap()
            .entries
            .map((entry) {
          final index = entry.key;
          final method = entry.value;
          return DropdownMenuItem(
            value: index,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _getCookingMethodIcon(method.name),
                  size: 16,
                  color: Colors.grey[600],
                ),
                const SizedBox(width: 8),
                Text(method.name),
              ],
            ),
          );
        }).toList(),
        onChanged: (value) {
          setState(() {
            selectedCookingMethodIndex = value ?? 0;
          });
        },
      ),
    );
  }

  Widget _buildCookingMethodInfo(CookingMethod method) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_getCookingMethodIcon(method.name),
                  color: Colors.blue[700]),
              const SizedBox(width: 8),
              Text(
                method.name,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Colors.blue[700],
                    ),
              ),
              if (method.timeEstimate != null) ...[
                const Spacer(),
                Icon(Icons.schedule, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  method.timeEstimate!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey[600],
                      ),
                ),
              ],
            ],
          ),
          if (method.equipment.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.build, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Equipment needed: ${method.equipment.join(', ')}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.grey[700],
                        ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInstructionStep(RecipeInstruction instruction) {
    final displayText = UnitsConverter.convertInstructions(
      instruction.text,
      widget.useMetricUnits,
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: Colors.green,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                instruction.stepNumber.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
          ),
          Expanded(
            child: Text(
              displayText,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
        ],
      ),
    );
  }

  List<RecipeInstruction> _getDisplayInstructions() {
    final hasCookingMethods = widget.recipe.cookingMethodOptions.isNotEmpty;

    if (!hasCookingMethods) {
      return widget.recipe.instructions;
    }

    // Multi-method recipe - combine prep + method-specific instructions
    if (selectedCookingMethodIndex >= 0 &&
        selectedCookingMethodIndex <
            widget.recipe.cookingMethodOptions.length) {
      final methodInstructions = widget
          .recipe.cookingMethodOptions[selectedCookingMethodIndex].instructions;

      final allInstructions = <RecipeInstruction>[];

      // Add prep instructions first
      for (int i = 0; i < widget.recipe.instructions.length; i++) {
        allInstructions.add(RecipeInstruction(
          stepNumber: i + 1,
          text: widget.recipe.instructions[i].text,
        ));
      }

      // Add method-specific instructions
      final prepStepsCount = widget.recipe.instructions.length;
      for (int i = 0; i < methodInstructions.length; i++) {
        allInstructions.add(RecipeInstruction(
          stepNumber: prepStepsCount + i + 1,
          text: methodInstructions[i].text,
        ));
      }

      return allInstructions;
    }

    return widget.recipe.instructions;
  }

  IconData _getCookingMethodIcon(String methodName) {
    switch (methodName.toLowerCase()) {
      case 'stovetop':
      case 'stove':
        return Icons.local_fire_department;
      case 'slow cooker':
      case 'crockpot':
        return Icons.soup_kitchen;
      case 'oven':
      case 'bake':
      case 'baked':
        return Icons.local_pizza;
      case 'grill':
      case 'grilled':
      case 'grilling':
        return Icons.outdoor_grill;
      case 'microwave':
        return Icons.microwave;
      case 'instant pot':
      case 'pressure cooker':
        return Icons.coffee_maker;
      case 'air fryer':
        return Icons.air;
      default:
        return Icons.restaurant;
    }
  }
}
