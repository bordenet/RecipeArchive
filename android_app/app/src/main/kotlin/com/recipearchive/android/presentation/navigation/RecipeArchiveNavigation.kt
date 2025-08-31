package com.recipearchive.android.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.recipearchive.android.presentation.auth.AuthViewModel
import com.recipearchive.android.presentation.auth.LoginScreen
import com.recipearchive.android.presentation.recipes.RecipeListScreen

@Composable
fun RecipeArchiveNavigation(
    navController: NavHostController = rememberNavController()
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val isAuthenticated by authViewModel.isAuthenticated.collectAsStateWithLifecycle(false)

    NavHost(
        navController = navController,
        startDestination = if (isAuthenticated) "recipe_list" else "login"
    ) {
        composable("login") {
            LoginScreen(viewModel = authViewModel)
        }

        composable("recipe_list") {
            RecipeListScreen(
                onRecipeClick = { recipeId ->
                    navController.navigate("recipe_detail/$recipeId")
                },
                onAddRecipeClick = {
                    navController.navigate("add_recipe")
                },
                onProfileClick = {
                    navController.navigate("profile")
                }
            )
        }

        composable("recipe_detail/{recipeId}") { backStackEntry ->
            val recipeId = backStackEntry.arguments?.getString("recipeId") ?: ""
            RecipeDetailPlaceholder(
                recipeId = recipeId,
                onBackClick = { navController.popBackStack() }
            )
        }

        composable("add_recipe") {
            AddRecipePlaceholder(
                onBackClick = { navController.popBackStack() },
                onSaveClick = { navController.popBackStack() }
            )
        }

        composable("profile") {
            ProfilePlaceholder(
                onBackClick = { navController.popBackStack() },
                onSignOutClick = {
                    authViewModel.signOut()
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}

// Placeholder screens for demonstration
@Composable
private fun RecipeDetailPlaceholder(
    recipeId: String,
    onBackClick: () -> Unit
) {
    androidx.compose.material3.Text("Recipe Detail: $recipeId")
}

@Composable
private fun AddRecipePlaceholder(
    onBackClick: () -> Unit,
    onSaveClick: () -> Unit
) {
    androidx.compose.material3.Text("Add Recipe Screen")
}

@Composable
private fun ProfilePlaceholder(
    onBackClick: () -> Unit,
    onSignOutClick: () -> Unit
) {
    androidx.compose.foundation.layout.Column {
        androidx.compose.material3.Text("Profile Screen")
        androidx.compose.material3.Button(onClick = onSignOutClick) {
            androidx.compose.material3.Text("Sign Out")
        }
    }
}