import 'package:flutter/material.dart';

void main() {
  runApp(const RecipeArchiveApp());
}

class RecipeArchiveApp extends StatelessWidget {
  const RecipeArchiveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recipe Archive',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
      ),
      home: const RecipeListScreen(),
    );
  }
}

class RecipeListScreen extends StatelessWidget {
  const RecipeListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final recipes = [
      {
        'title': 'Chocolate Chip Cookies',
        'description': 'Classic homemade chocolate chip cookies that are crispy on the outside and chewy on the inside.',
        'time': '25 min',
        'rating': '4.8',
      },
      {
        'title': 'Spaghetti Carbonara',
        'description': 'Traditional Italian pasta dish with eggs, cheese, and pancetta.',
        'time': '20 min',
        'rating': '4.6',
      },
      {
        'title': 'Asian Lettuce Wraps',
        'description': 'Fresh and healthy lettuce wraps with seasoned ground chicken.',
        'time': '15 min',
        'rating': '4.7',
      },
      {
        'title': 'Mediterranean Quinoa Bowl',
        'description': 'Nutritious quinoa bowl with Mediterranean flavors and fresh vegetables.',
        'time': '30 min',
        'rating': '4.5',
      },
      {
        'title': 'Thai Green Curry',
        'description': 'Aromatic and spicy Thai curry with coconut milk and fresh herbs.',
        'time': '35 min',
        'rating': '4.9',
      },
      {
        'title': 'Breakfast Avocado Toast',
        'description': 'Simple and delicious avocado toast topped with everything seasoning.',
        'time': '10 min',
        'rating': '4.4',
      },
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Recipe Archive'),
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: recipes.length,
        itemBuilder: (context, index) {
          final recipe = recipes[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    recipe['title']!,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    recipe['description']!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.timer, size: 16, color: Colors.orange),
                      const SizedBox(width: 4),
                      Text(recipe['time']!),
                      const SizedBox(width: 16),
                      const Icon(Icons.star, size: 16, color: Colors.amber),
                      const SizedBox(width: 4),
                      Text(recipe['rating']!),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
