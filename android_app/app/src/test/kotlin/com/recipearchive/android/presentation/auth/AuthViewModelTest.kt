package com.recipearchive.android.presentation.auth

import com.recipearchive.android.data.model.User
import com.recipearchive.android.data.repository.AuthRepository
import com.recipearchive.android.data.repository.AuthException
import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
class AuthViewModelTest {

    private lateinit var viewModel: AuthViewModel
    private val mockAuthRepository = mockk<AuthRepository>()
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        
        every { mockAuthRepository.isAuthenticated } returns flowOf(false)
        every { mockAuthRepository.currentUser } returns flowOf(null)
        
        viewModel = AuthViewModel(mockAuthRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        clearAllMocks()
    }

    @Test
    fun `initial state should be loading false and no error`() = runTest {
        // Assert
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.errorMessage)
    }

    @Test
    fun `signIn with valid credentials should set loading and clear error`() = runTest {
        // Arrange
        val user = User("1", "test@example.com", "test")
        coEvery { mockAuthRepository.signIn("test@example.com", "password123") } returns Result.success(user)

        // Act
        viewModel.signIn("test@example.com", "password123")
        
        // Fast-forward time to skip delays
        advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.errorMessage)
        coVerify { mockAuthRepository.signIn("test@example.com", "password123") }
    }

    @Test
    fun `signIn with invalid credentials should show error`() = runTest {
        // Arrange
        coEvery { mockAuthRepository.signIn("invalid@email", "short") } returns Result.failure(AuthException("Invalid email or password"))

        // Act
        viewModel.signIn("invalid@email", "short")
        advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertEquals("Invalid email or password", state.errorMessage)
    }

    @Test
    fun `signUp with valid data should set loading and clear error`() = runTest {
        // Arrange
        val user = User("1", "test@example.com", "test")
        coEvery { mockAuthRepository.signUp("test@example.com", "password123", "password123") } returns Result.success(user)

        // Act
        viewModel.signUp("test@example.com", "password123", "password123")
        advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertNull(state.errorMessage)
        coVerify { mockAuthRepository.signUp("test@example.com", "password123", "password123") }
    }

    @Test
    fun `signUp with mismatched passwords should show error`() = runTest {
        // Arrange
        coEvery { mockAuthRepository.signUp("test@example.com", "password123", "different") } returns Result.failure(AuthException("Passwords do not match"))

        // Act
        viewModel.signUp("test@example.com", "password123", "different")
        advanceUntilIdle()

        // Assert
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertEquals("Passwords do not match", state.errorMessage)
    }

    @Test
    fun `signOut should call repository signOut`() = runTest {
        // Arrange
        coEvery { mockAuthRepository.signOut() } returns Result.success(Unit)

        // Act
        viewModel.signOut()
        advanceUntilIdle()

        // Assert
        coVerify { mockAuthRepository.signOut() }
    }

    @Test
    fun `clearErrorMessage should clear error state`() = runTest {
        // Arrange - Set up initial error state
        coEvery { mockAuthRepository.signIn("invalid@email", "short") } returns Result.failure(AuthException("Test error"))
        viewModel.signIn("invalid@email", "short")
        advanceUntilIdle()
        
        // Verify error is set
        assertEquals("Test error", viewModel.uiState.value.errorMessage)

        // Act
        viewModel.clearErrorMessage()

        // Assert
        assertNull(viewModel.uiState.value.errorMessage)
    }

    @Test
    fun `loading state should be true during sign in operation`() = runTest {
        // Arrange
        val user = User("1", "test@example.com", "test")
        coEvery { mockAuthRepository.signIn("test@example.com", "password123") } returns Result.success(user)

        // Act
        viewModel.signIn("test@example.com", "password123")

        // Assert - Check loading state immediately after calling signIn
        assertTrue(viewModel.uiState.value.isLoading)
        
        // Complete the operation
        advanceUntilIdle()
        assertFalse(viewModel.uiState.value.isLoading)
    }

    @Test
    fun `loading state should be true during sign up operation`() = runTest {
        // Arrange
        val user = User("1", "test@example.com", "test")
        coEvery { mockAuthRepository.signUp("test@example.com", "password123", "password123") } returns Result.success(user)

        // Act
        viewModel.signUp("test@example.com", "password123", "password123")

        // Assert - Check loading state immediately after calling signUp
        assertTrue(viewModel.uiState.value.isLoading)
        
        // Complete the operation
        advanceUntilIdle()
        assertFalse(viewModel.uiState.value.isLoading)
    }
}