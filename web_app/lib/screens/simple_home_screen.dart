import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/recipe.dart';
import '../services/mock_recipe_service.dart';

// Simple provider that returns mock recipes
final mockRecipesProvider = FutureProvider<List<Recipe>>((ref) async {
  // Simulate network delay
  await Future.delayed(const Duration(milliseconds: 500));
  return MockRecipeService.getMockRecipes();
});

class SimpleHomeScreen extends ConsumerWidget {
  const SimpleHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recipesAsync = ref.watch(mockRecipesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Recipe Archive'),
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      ),
      body: recipesAsync.when(
        data: (recipes) => ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: recipes.length,
          itemBuilder: (context, index) {
            final recipe = recipes[index];
            return Card(
              margin: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Recipe image
                  if (recipe.imageUrl != null)
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                      child: Image.network(
                        recipe.imageUrl!,
                        height: 200,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            height: 200,
                            color: Colors.grey[300],
                            child: const Icon(Icons.image_not_supported, size: 50),
                          );
                        },
                        loadingBuilder: (context, child, loadingProgress) {
                          if (loadingProgress == null) return child;
                          return Container(
                            height: 200,
                            color: Colors.grey[300],
                            child: const Center(child: CircularProgressIndicator()),
                          );
                        },
                      ),
                    ),
                  
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Recipe title
                        Text(
                          recipe.title,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        
                        // Recipe description
                        if (recipe.description != null)
                          Text(
                            recipe.description!,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.grey[600],
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        const SizedBox(height: 12),
                        
                        // Recipe info row
                        Row(
                          children: [
                            if (recipe.prepTimeMinutes != null) ...[
                              Icon(Icons.access_time, size: 16, color: Colors.grey[600]),
                              const SizedBox(width: 4),
                              Text(
                                '${recipe.prepTimeMinutes}m',
                                style: TextStyle(color: Colors.grey[600]),
                              ),
                              const SizedBox(width: 16),
                            ],
                            if (recipe.servings != null) ...[
                              Icon(Icons.people, size: 16, color: Colors.grey[600]),
                              const SizedBox(width: 4),
                              Text(
                                '${recipe.servings} servings',
                                style: TextStyle(color: Colors.grey[600]),
                              ),
                              const SizedBox(width: 16),
                            ],
                            if (recipe.cuisine != null) ...[
                              Icon(Icons.public, size: 16, color: Colors.grey[600]),
                              const SizedBox(width: 4),
                              Text(
                                recipe.cuisine!,
                                style: TextStyle(color: Colors.grey[600]),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 12),
                        
                        // Tags
                        if (recipe.tags != null && recipe.tags!.isNotEmpty)
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: recipe.tags!.take(3).map((tag) {
                              return Chip(
                                label: Text(
                                  tag,
                                  style: const TextStyle(fontSize: 12),
                                ),
                                backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              );
                            }).toList(),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        loading: () => const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Loading delicious recipes...'),
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
                'Oops! Something went wrong',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                error.toString(),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.refresh(mockRecipesProvider),
                child: const Text('Try Again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
