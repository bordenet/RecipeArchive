import Foundation
import Combine

class RecipeService: ObservableObject {
    @Published var recipes: [Recipe] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var searchText: String = ""
    
    private var allRecipes: [Recipe] = []
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        setupSearch()
        loadRecipes()
    }
    
    private func setupSearch() {
        $searchText
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] searchText in
                self?.filterRecipes(searchText: searchText)
            }
            .store(in: &cancellables)
    }
    
    func loadRecipes() {
        isLoading = true
        errorMessage = nil
        
        // Simulate AWS S3/Lambda API call
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.allRecipes = self.generateSampleRecipes()
            self.recipes = self.allRecipes
            self.isLoading = false
        }
    }
    
    func refreshRecipes() {
        loadRecipes()
    }
    
    func addRecipe(_ recipe: Recipe) {
        isLoading = true
        
        // Simulate API call to save recipe
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.allRecipes.append(recipe)
            self.filterRecipes(searchText: self.searchText)
            self.isLoading = false
        }
    }
    
    func deleteRecipe(_ recipe: Recipe) {
        allRecipes.removeAll { $0.id == recipe.id }
        filterRecipes(searchText: searchText)
    }
    
    private func filterRecipes(searchText: String) {
        if searchText.isEmpty {
            recipes = allRecipes
        } else {
            recipes = allRecipes.filter { recipe in
                recipe.title.localizedCaseInsensitiveContains(searchText) ||
                recipe.description?.localizedCaseInsensitiveContains(searchText) == true ||
                recipe.tags.contains { $0.localizedCaseInsensitiveContains(searchText) } ||
                recipe.cuisine?.localizedCaseInsensitiveContains(searchText) == true
            }
        }
    }
    
    private func generateSampleRecipes() -> [Recipe] {
        return [
            Recipe.sample,
            Recipe(
                id: "sample-2",
                title: "Spaghetti Carbonara",
                description: "Classic Italian pasta dish with eggs, cheese, and pancetta.",
                ingredients: [
                    RecipeIngredient(text: "400g spaghetti"),
                    RecipeIngredient(text: "200g pancetta"),
                    RecipeIngredient(text: "4 large eggs"),
                    RecipeIngredient(text: "100g Pecorino Romano cheese"),
                    RecipeIngredient(text: "Black pepper"),
                    RecipeIngredient(text: "Salt")
                ],
                instructions: [
                    RecipeInstruction(stepNumber: 1, text: "Cook spaghetti in salted boiling water until al dente."),
                    RecipeInstruction(stepNumber: 2, text: "Cook pancetta until crispy."),
                    RecipeInstruction(stepNumber: 3, text: "Whisk eggs with grated cheese and black pepper."),
                    RecipeInstruction(stepNumber: 4, text: "Toss hot pasta with pancetta and egg mixture."),
                    RecipeInstruction(stepNumber: 5, text: "Serve immediately with extra cheese.")
                ],
                prepTime: 10,
                cookingTime: 15,
                servings: 4,
                difficulty: "Medium",
                cuisine: "Italian",
                tags: ["pasta", "dinner", "italian"],
                imageUrl: nil,
                sourceUrl: "https://example.com/carbonara",
                sourceName: "Italian Classics"
            ),
            Recipe(
                id: "sample-3",
                title: "Avocado Toast",
                description: "Simple and healthy avocado toast with various toppings.",
                ingredients: [
                    RecipeIngredient(text: "2 slices whole grain bread"),
                    RecipeIngredient(text: "1 ripe avocado"),
                    RecipeIngredient(text: "1 tbsp lemon juice"),
                    RecipeIngredient(text: "Salt and pepper"),
                    RecipeIngredient(text: "Optional: tomatoes, eggs, seeds")
                ],
                instructions: [
                    RecipeInstruction(stepNumber: 1, text: "Toast bread until golden brown."),
                    RecipeInstruction(stepNumber: 2, text: "Mash avocado with lemon juice, salt, and pepper."),
                    RecipeInstruction(stepNumber: 3, text: "Spread avocado mixture on toast."),
                    RecipeInstruction(stepNumber: 4, text: "Add desired toppings.")
                ],
                prepTime: 5,
                cookingTime: 2,
                servings: 1,
                difficulty: "Easy",
                cuisine: "Modern",
                tags: ["breakfast", "healthy", "vegetarian"],
                imageUrl: nil,
                sourceUrl: "https://example.com/avocado-toast",
                sourceName: "Healthy Eats"
            ),
            Recipe(
                id: "sample-4",
                title: "Beef Stroganoff",
                description: "Rich and creamy Russian dish with tender beef strips and mushrooms.",
                ingredients: [
                    RecipeIngredient(text: "1 lb beef sirloin, sliced"),
                    RecipeIngredient(text: "8 oz mushrooms, sliced"),
                    RecipeIngredient(text: "1 large onion, diced"),
                    RecipeIngredient(text: "2 cloves garlic, minced"),
                    RecipeIngredient(text: "1 cup sour cream"),
                    RecipeIngredient(text: "2 tbsp flour"),
                    RecipeIngredient(text: "2 cups beef broth"),
                    RecipeIngredient(text: "Egg noodles")
                ],
                instructions: [
                    RecipeInstruction(stepNumber: 1, text: "Brown beef strips in a large skillet."),
                    RecipeInstruction(stepNumber: 2, text: "Add mushrooms and onions, cook until soft."),
                    RecipeInstruction(stepNumber: 3, text: "Sprinkle with flour and stir."),
                    RecipeInstruction(stepNumber: 4, text: "Gradually add beef broth, simmer until thickened."),
                    RecipeInstruction(stepNumber: 5, text: "Stir in sour cream and serve over noodles.")
                ],
                prepTime: 20,
                cookingTime: 25,
                servings: 6,
                difficulty: "Medium",
                cuisine: "Russian",
                tags: ["dinner", "comfort food", "beef"],
                imageUrl: nil,
                sourceUrl: "https://example.com/beef-stroganoff",
                sourceName: "Comfort Classics"
            ),
            Recipe(
                id: "sample-5",
                title: "Chicken Tikka Masala",
                description: "Creamy and flavorful Indian curry with tender chicken pieces.",
                ingredients: [
                    RecipeIngredient(text: "2 lbs chicken breast, cubed"),
                    RecipeIngredient(text: "1 cup plain yogurt"),
                    RecipeIngredient(text: "2 tbsp garam masala"),
                    RecipeIngredient(text: "1 can crushed tomatoes"),
                    RecipeIngredient(text: "1 cup heavy cream"),
                    RecipeIngredient(text: "3 cloves garlic, minced"),
                    RecipeIngredient(text: "1 inch ginger, grated"),
                    RecipeIngredient(text: "Basmati rice")
                ],
                instructions: [
                    RecipeInstruction(stepNumber: 1, text: "Marinate chicken in yogurt and spices for 2 hours."),
                    RecipeInstruction(stepNumber: 2, text: "Grill or pan-fry chicken until cooked through."),
                    RecipeInstruction(stepNumber: 3, text: "In a pan, sauté garlic and ginger."),
                    RecipeInstruction(stepNumber: 4, text: "Add tomatoes and simmer for 15 minutes."),
                    RecipeInstruction(stepNumber: 5, text: "Add cream and chicken, simmer until thickened."),
                    RecipeInstruction(stepNumber: 6, text: "Serve over basmati rice.")
                ],
                prepTime: 30,
                cookingTime: 45,
                servings: 8,
                difficulty: "Medium",
                cuisine: "Indian",
                tags: ["dinner", "curry", "chicken"],
                imageUrl: nil,
                sourceUrl: "https://example.com/tikka-masala",
                sourceName: "Indian Delights"
            )
        ]
    }
}