import 'package:flutter/material.dart';

class SimpleRecipeApp extends StatelessWidget {
  const SimpleRecipeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recipe Archive',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.orange),
        useMaterial3: true,
      ),
      home: const SimpleRecipeList(),
    );
  }
}

class SimpleRecipeList extends StatefulWidget {
  const SimpleRecipeList({super.key});

  @override
  State<SimpleRecipeList> createState() => _SimpleRecipeListState();
}

class _SimpleRecipeListState extends State<SimpleRecipeList> {
  final List<Map<String, dynamic>> sampleRecipes = [
    {
      'id': '1',
      'title': 'Margarita',
      'domain': 'www.foodnetwork.com',
      'date': '2025-08-29',
      'prepTime': 5,
      'cookTime': 0,
      'servings': 1,
    },
    {
      'id': '2',
      'title': 'Easy Peach Crumble Cake',
      'domain': 'food52.com',
      'date': '2025-08-29',
      'prepTime': 15,
      'cookTime': 45,
      'servings': 8,
    },
    {
      'id': '3',
      'title': 'Philly Fluff Cake',
      'domain': 'www.epicurious.com',
      'date': '2025-08-29',
      'prepTime': 20,
      'cookTime': 60,
      'servings': 12,
    },
    // Add more sample recipes...
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recipe Archive'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search recipes...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: sampleRecipes.length,
              itemBuilder: (context, index) {
                final recipe = sampleRecipes[index];
                return Card(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  child: ListTile(
                    title: Text(recipe['title']),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Source: ${recipe['domain']}'),
                        Text('Date: ${recipe['date']}'),
                        if (recipe['prepTime'] > 0 || recipe['cookTime'] > 0)
                          Text('Time: ${recipe['prepTime'] + recipe['cookTime']} min'),
                        if (recipe['servings'] > 0)
                          Text('Serves: ${recipe['servings']}'),
                      ],
                    ),
                    leading: const CircleAvatar(
                      child: Icon(Icons.restaurant),
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios),
                    onTap: () {
                      // Navigate to recipe detail
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => SimpleRecipeDetail(recipe: recipe),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Add new recipe
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class SimpleRecipeDetail extends StatelessWidget {
  final Map<String, dynamic> recipe;

  const SimpleRecipeDetail({super.key, required this.recipe});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(recipe['title']),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Recipe Details',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 16),
                    Text('Source: ${recipe['domain']}'),
                    Text('Date Added: ${recipe['date']}'),
                    if (recipe['prepTime'] > 0)
                      Text('Prep Time: ${recipe['prepTime']} minutes'),
                    if (recipe['cookTime'] > 0)
                      Text('Cook Time: ${recipe['cookTime']} minutes'),
                    if (recipe['servings'] > 0)
                      Text('Servings: ${recipe['servings']}'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Ingredients',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('Ingredients will be loaded from the backend...'),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Instructions',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('Instructions will be loaded from the backend...'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
