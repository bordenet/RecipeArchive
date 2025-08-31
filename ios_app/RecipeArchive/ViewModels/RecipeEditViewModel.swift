import Foundation
import SwiftUI

@MainActor
class RecipeEditViewModel: ObservableObject {
    // Original recipe
    private let originalRecipe: Recipe
    
    // Form fields
    @Published var title: String
    @Published var description: String
    @Published var prepTime: Int?
    @Published var cookingTime: Int?
    @Published var servings: Int
    @Published var difficulty: String
    @Published var cuisine: String
    @Published var tags: [String]
    @Published var ingredients: [String]
    @Published var instructions: [String]
    
    // Personal fields
    @Published var personalNotes: String
    @Published var personalRating: Double
    @Published var cookingNotes: String
    @Published var categories: [String]
    @Published var isFavorite: Bool
    @Published var personalYield: Int?
    
    // UI state
    @Published var isLoading = false
    @Published var showingUnsavedChangesAlert = false
    @Published var showingErrorAlert = false
    @Published var errorMessage = ""
    @Published var saveSuccessful = false
    
    // Services
    private let recipeService: RecipeService
    
    init(recipe: Recipe, recipeService: RecipeService = RecipeService()) {
        self.originalRecipe = recipe
        self.recipeService = recipeService
        
        // Initialize form fields with original recipe data
        self.title = recipe.title
        self.description = recipe.description ?? ""
        self.prepTime = recipe.prepTime
        self.cookingTime = recipe.cookingTime
        self.servings = recipe.servings
        self.difficulty = recipe.difficulty ?? ""
        self.cuisine = recipe.cuisine ?? ""
        self.tags = recipe.tags
        self.ingredients = recipe.ingredients.map { $0.text }
        self.instructions = recipe.instructions.map { $0.text }
        
        // Initialize personal fields
        self.personalNotes = recipe.personalNotes ?? ""
        self.personalRating = recipe.personalRating ?? 0.0
        self.cookingNotes = recipe.cookingNotes ?? ""
        self.categories = recipe.categories
        self.isFavorite = recipe.isFavorite
        self.personalYield = recipe.personalYield
    }
    
    // MARK: - Computed Properties
    
    var hasUnsavedChanges: Bool {
        return title != originalRecipe.title ||
               description != (originalRecipe.description ?? "") ||
               prepTime != originalRecipe.prepTime ||
               cookingTime != originalRecipe.cookingTime ||
               servings != originalRecipe.servings ||
               difficulty != (originalRecipe.difficulty ?? "") ||
               cuisine != (originalRecipe.cuisine ?? "") ||
               tags != originalRecipe.tags ||
               ingredients != originalRecipe.ingredients.map { $0.text } ||
               instructions != originalRecipe.instructions.map { $0.text } ||
               personalNotes != (originalRecipe.personalNotes ?? "") ||
               personalRating != (originalRecipe.personalRating ?? 0.0) ||
               cookingNotes != (originalRecipe.cookingNotes ?? "") ||
               categories != originalRecipe.categories ||
               isFavorite != originalRecipe.isFavorite ||
               personalYield != originalRecipe.personalYield
    }
    
    // MARK: - Tag Management
    
    func addTag(_ tag: String) {
        let trimmedTag = tag.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedTag.isEmpty && !tags.contains(trimmedTag) {
            tags.append(trimmedTag)
        }
    }
    
    func removeTag(_ tag: String) {
        tags.removeAll { $0 == tag }
    }
    
    // MARK: - Category Management
    
    func addCategory(_ category: String) {
        let trimmedCategory = category.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedCategory.isEmpty && !categories.contains(trimmedCategory) {
            categories.append(trimmedCategory)
        }
    }
    
    func removeCategory(_ category: String) {
        categories.removeAll { $0 == category }
    }
    
    // MARK: - Ingredient Management
    
    func addIngredient() {
        ingredients.append("")
    }
    
    func removeIngredient(at index: Int) {
        guard index >= 0 && index < ingredients.count else { return }
        ingredients.remove(at: index)
    }
    
    func moveIngredient(from source: IndexSet, to destination: Int) {
        ingredients.move(fromOffsets: source, toOffset: destination)
    }
    
    // MARK: - Instruction Management
    
    func addInstruction() {
        instructions.append("")
    }
    
    func removeInstruction(at index: Int) {
        guard index >= 0 && index < instructions.count else { return }
        instructions.remove(at: index)
    }
    
    func moveInstruction(from source: IndexSet, to destination: Int) {
        instructions.move(fromOffsets: source, toOffset: destination)
    }
    
    // MARK: - Save Recipe
    
    func saveRecipe() async {
        isLoading = true
        errorMessage = ""
        
        do {
            // Validate required fields
            guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw RecipeValidationError.emptyTitle
            }
            
            guard servings > 0 else {
                throw RecipeValidationError.invalidServings
            }
            
            // Filter out empty ingredients and instructions
            let filteredIngredients = ingredients
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .enumerated()
                .map { RecipeIngredient(text: $1) }
            
            let filteredInstructions = instructions
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .enumerated()
                .map { RecipeInstruction(stepNumber: $0 + 1, text: $1) }
            
            // Create updated recipe
            let updatedRecipe = originalRecipe.copyWith(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : description.trimmingCharacters(in: .whitespacesAndNewlines),
                ingredients: filteredIngredients,
                instructions: filteredInstructions,
                prepTime: prepTime,
                cookingTime: cookingTime,
                servings: servings,
                difficulty: difficulty.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : difficulty.trimmingCharacters(in: .whitespacesAndNewlines),
                cuisine: cuisine.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : cuisine.trimmingCharacters(in: .whitespacesAndNewlines),
                tags: tags,
                personalNotes: personalNotes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : personalNotes.trimmingCharacters(in: .whitespacesAndNewlines),
                personalRating: personalRating > 0 ? personalRating : nil,
                cookingNotes: cookingNotes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : cookingNotes.trimmingCharacters(in: .whitespacesAndNewlines),
                categories: categories,
                isFavorite: isFavorite,
                personalYield: personalYield,
                hasUserModifications: true,
                updatedAt: Date()
            )
            
            // Save via AWS backend
            try await recipeService.updateRecipe(updatedRecipe)
            
            // Update success state
            saveSuccessful = true
            
        } catch {
            errorMessage = error.localizedDescription
            showingErrorAlert = true
        }
        
        isLoading = false
    }
    
    // MARK: - Validation
    
    private func validateForm() throws {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw RecipeValidationError.emptyTitle
        }
        
        guard servings > 0 else {
            throw RecipeValidationError.invalidServings
        }
        
        let hasIngredients = ingredients.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard hasIngredients else {
            throw RecipeValidationError.noIngredients
        }
        
        let hasInstructions = instructions.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard hasInstructions else {
            throw RecipeValidationError.noInstructions
        }
    }
}

// MARK: - Validation Errors

enum RecipeValidationError: LocalizedError {
    case emptyTitle
    case invalidServings
    case noIngredients
    case noInstructions
    
    var errorDescription: String? {
        switch self {
        case .emptyTitle:
            return "Recipe title cannot be empty"
        case .invalidServings:
            return "Servings must be greater than 0"
        case .noIngredients:
            return "Recipe must have at least one ingredient"
        case .noInstructions:
            return "Recipe must have at least one instruction"
        }
    }
}

// MARK: - Recipe Service

class RecipeService {
    private let apiBaseURL = "https://4sgexl03l7.execute-api.us-west-2.amazonaws.com/prod"
    
    func updateRecipe(_ recipe: Recipe) async throws {
        guard let url = URL(string: "\(apiBaseURL)/v1/recipes/\(recipe.id)") else {
            throw RecipeServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add Authorization header (you'll need to implement authentication)
        // request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        
        do {
            request.httpBody = try encoder.encode(recipe)
        } catch {
            throw RecipeServiceError.encodingError(error)
        }
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RecipeServiceError.invalidResponse
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw RecipeServiceError.serverError(httpResponse.statusCode)
        }
    }
    
    func saveRecipe(_ recipe: Recipe) async throws {
        guard let url = URL(string: "\(apiBaseURL)/v1/recipes") else {
            throw RecipeServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add Authorization header (you'll need to implement authentication)
        // request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        
        do {
            request.httpBody = try encoder.encode(recipe)
        } catch {
            throw RecipeServiceError.encodingError(error)
        }
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RecipeServiceError.invalidResponse
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw RecipeServiceError.serverError(httpResponse.statusCode)
        }
    }
    
    func deleteRecipe(id: String) async throws {
        guard let url = URL(string: "\(apiBaseURL)/v1/recipes/\(id)") else {
            throw RecipeServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        // Add Authorization header (you'll need to implement authentication)
        // request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RecipeServiceError.invalidResponse
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw RecipeServiceError.serverError(httpResponse.statusCode)
        }
    }
    
    func searchRecipes(query: String) async throws -> [Recipe] {
        guard let url = URL(string: "\(apiBaseURL)/v1/recipes?search=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") else {
            throw RecipeServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        // Add Authorization header (you'll need to implement authentication)
        // request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RecipeServiceError.invalidResponse
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw RecipeServiceError.serverError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let apiResponse = try decoder.decode(RecipeListResponse.self, from: data)
            return apiResponse.recipes
        } catch {
            throw RecipeServiceError.decodingError(error)
        }
    }
    
    func getFavoriteRecipes() async throws -> [Recipe] {
        guard let url = URL(string: "\(apiBaseURL)/v1/recipes?favorites=true") else {
            throw RecipeServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        // Add Authorization header (you'll need to implement authentication)
        // request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RecipeServiceError.invalidResponse
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw RecipeServiceError.serverError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let apiResponse = try decoder.decode(RecipeListResponse.self, from: data)
            return apiResponse.recipes
        } catch {
            throw RecipeServiceError.decodingError(error)
        }
    }
    
    func getRecipesByCategory(_ category: String) async throws -> [Recipe] {
        guard let url = URL(string: "\(apiBaseURL)/v1/recipes?category=\(category.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") else {
            throw RecipeServiceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        // Add Authorization header (you'll need to implement authentication)
        // request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RecipeServiceError.invalidResponse
        }
        
        guard 200...299 ~= httpResponse.statusCode else {
            throw RecipeServiceError.serverError(httpResponse.statusCode)
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        do {
            let apiResponse = try decoder.decode(RecipeListResponse.self, from: data)
            return apiResponse.recipes
        } catch {
            throw RecipeServiceError.decodingError(error)
        }
    }
}

// MARK: - Service Errors

enum RecipeServiceError: LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(Int)
    case encodingError(Error)
    case decodingError(Error)
    case authenticationRequired
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let statusCode):
            return "Server error: \(statusCode)"
        case .encodingError(let error):
            return "Encoding error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .authenticationRequired:
            return "Authentication required"
        }
    }
}

// MARK: - API Response Models

struct RecipeListResponse: Codable {
    let recipes: [Recipe]
}