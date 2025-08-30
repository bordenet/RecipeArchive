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
            )
        ]
    }
}