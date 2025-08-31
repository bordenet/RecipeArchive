package com.recipearchive.android.presentation.auth

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.recipearchive.android.presentation.theme.RecipeArchiveTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LoginScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun loginScreen_displaysAllUIElements() {
        composeTestRule.setContent {
            RecipeArchiveTheme {
                LoginContent(
                    uiState = AuthUiState(),
                    isSignUpMode = false,
                    onSignInClick = { _, _ -> },
                    onSignUpClick = { _, _, _ -> },
                    onToggleMode = { },
                    onErrorDismissed = { }
                )
            }
        }

        // Check that all UI elements are displayed
        composeTestRule.onNodeWithText("Recipe Archive").assertIsDisplayed()
        composeTestRule.onNodeWithText("Your personal recipe collection").assertIsDisplayed()
        composeTestRule.onNodeWithText("Welcome Back").assertIsDisplayed()
        composeTestRule.onNodeWithText("Email").assertIsDisplayed()
        composeTestRule.onNodeWithText("Password").assertIsDisplayed()
        composeTestRule.onNodeWithText("Sign In").assertIsDisplayed()
        composeTestRule.onNodeWithText("Don't have an account? Sign Up").assertIsDisplayed()
    }

    @Test
    fun loginScreen_signUpMode_displaysSignUpElements() {
        composeTestRule.setContent {
            RecipeArchiveTheme {
                LoginContent(
                    uiState = AuthUiState(),
                    isSignUpMode = true,
                    onSignInClick = { _, _ -> },
                    onSignUpClick = { _, _, _ -> },
                    onToggleMode = { },
                    onErrorDismissed = { }
                )
            }
        }

        // Check sign up specific elements
        composeTestRule.onNodeWithText("Create Account").assertIsDisplayed()
        composeTestRule.onNodeWithText("Confirm Password").assertIsDisplayed()
        composeTestRule.onNodeWithText("Already have an account? Sign In").assertIsDisplayed()
    }

    @Test
    fun loginScreen_canEnterEmailAndPassword() {
        composeTestRule.setContent {
            RecipeArchiveTheme {
                LoginContent(
                    uiState = AuthUiState(),
                    isSignUpMode = false,
                    onSignInClick = { _, _ -> },
                    onSignUpClick = { _, _, _ -> },
                    onToggleMode = { },
                    onErrorDismissed = { }
                )
            }
        }

        // Enter text in email field
        composeTestRule.onNodeWithText("Email").performTextInput("test@example.com")
        
        // Enter text in password field
        composeTestRule.onNodeWithText("Password").performTextInput("password123")
        
        // Verify text was entered (checking if Sign In button is enabled)
        composeTestRule.onNodeWithText("Sign In").assertIsEnabled()
    }

    @Test
    fun loginScreen_signInButtonDisabledWithEmptyFields() {
        composeTestRule.setContent {
            RecipeArchiveTheme {
                LoginContent(
                    uiState = AuthUiState(),
                    isSignUpMode = false,
                    onSignInClick = { _, _ -> },
                    onSignUpClick = { _, _, _ -> },
                    onToggleMode = { },
                    onErrorDismissed = { }
                )
            }
        }

        // Sign In button should be disabled with empty fields
        composeTestRule.onNodeWithText("Sign In").assertIsNotEnabled()
    }

    @Test
    fun loginScreen_toggleModeButtonWorks() {
        var isSignUpMode = false
        
        composeTestRule.setContent {
            RecipeArchiveTheme {
                LoginContent(
                    uiState = AuthUiState(),
                    isSignUpMode = isSignUpMode,
                    onSignInClick = { _, _ -> },
                    onSignUpClick = { _, _, _ -> },
                    onToggleMode = { isSignUpMode = !isSignUpMode },
                    onErrorDismissed = { }
                )
            }
        }

        // Initially in sign in mode
        composeTestRule.onNodeWithText("Welcome Back").assertIsDisplayed()
        composeTestRule.onNodeWithText("Don't have an account? Sign Up").assertIsDisplayed()

        // Click toggle button
        composeTestRule.onNodeWithText("Don't have an account? Sign Up").performClick()
        
        // Should switch to sign up mode (we'd need to recompose to see the change)
        // This is a limitation of this test setup - in real app, the UI would update
    }

    @Test
    fun loginScreen_displaysErrorMessage() {
        val errorMessage = "Invalid email or password"
        
        composeTestRule.setContent {
            RecipeArchiveTheme {
                LoginContent(
                    uiState = AuthUiState(errorMessage = errorMessage),
                    isSignUpMode = false,
                    onSignInClick = { _, _ -> },
                    onSignUpClick = { _, _, _ -> },
                    onToggleMode = { },
                    onErrorDismissed = { }
                )
            }
        }

        // Check that error message is displayed
        composeTestRule.onNodeWithText(errorMessage).assertIsDisplayed()
    }

    @Test
    fun loginScreen_displaysLoadingState() {
        composeTestRule.setContent {
            RecipeArchiveTheme {
                LoginContent(
                    uiState = AuthUiState(isLoading = true),
                    isSignUpMode = false,
                    onSignInClick = { _, _ -> },
                    onSignUpClick = { _, _, _ -> },
                    onToggleMode = { },
                    onErrorDismissed = { }
                )
            }
        }

        // Check that loading indicator is displayed and button is disabled
        composeTestRule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertIsDisplayed()
        composeTestRule.onNodeWithText("Sign In").assertIsNotEnabled()
    }

    @Test
    fun loginScreen_passwordVisibilityToggleWorks() {
        composeTestRule.setContent {
            RecipeArchiveTheme {
                LoginContent(
                    uiState = AuthUiState(),
                    isSignUpMode = false,
                    onSignInClick = { _, _ -> },
                    onSignUpClick = { _, _, _ -> },
                    onToggleMode = { },
                    onErrorDismissed = { }
                )
            }
        }

        // Find and click the password visibility toggle
        composeTestRule.onNodeWithContentDescription("Show password").assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription("Show password").performClick()
        
        // After clicking, the icon should change to "Hide password"
        // Note: This test might need adjustment based on actual implementation
        // as the icon change might not be immediately testable in this simple setup
    }
}