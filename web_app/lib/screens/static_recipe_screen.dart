import 'package:flutter/material.dart';

class StaticRecipeScreen extends StatelessWidget {
  const StaticRecipeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recipe Archive'),
        backgroundColor: Colors.green[100],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(
          children: [
            _buildRecipeCard(
              'Chocolate Chip Cookies',
              'Classic homemade chocolate chip cookies that are crispy on the outside and chewy on the inside.',
              '25 min',
              '4.8',
            ),
            const SizedBox(height: 16),
            _buildRecipeCard(
              'Spaghetti Carbonara',
              'Traditional Italian pasta dish with eggs, cheese, and pancetta.',
              '20 min',
              '4.6',
            ),
            const SizedBox(height: 16),
            _buildRecipeCard(
              'Asian Lettuce Wraps',
              'Fresh and healthy lettuce wraps with seasoned ground chicken.',
              '15 min',
              '4.7',
            ),
            const SizedBox(height: 16),
            _buildRecipeCard(
              'Mediterranean Quinoa Bowl',
              'Nutritious quinoa bowl with Mediterranean flavors and fresh vegetables.',
              '30 min',
              '4.5',
            ),
            const SizedBox(height: 16),
            _buildRecipeCard(
              'Thai Green Curry',
              'Aromatic and spicy Thai curry with coconut milk and fresh herbs.',
              '35 min',
              '4.9',
            ),
            const SizedBox(height: 16),
            _buildRecipeCard(
              'Breakfast Avocado Toast',
              'Simple and delicious avocado toast topped with everything seasoning.',
              '10 min',
              '4.4',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecipeCard(String title, String description, String time, String rating) {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              description,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.timer, size: 16, color: Colors.orange),
                const SizedBox(width: 4),
                Text(time),
                const SizedBox(width: 16),
                const Icon(Icons.star, size: 16, color: Colors.amber),
                const SizedBox(width: 4),
                Text(rating),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
