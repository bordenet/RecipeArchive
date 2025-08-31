package com.recipearchive.android.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.preferencesOf
import com.recipearchive.android.data.local.UserDao
import com.recipearchive.android.data.model.User
import io.mockk.*
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class AuthRepositoryTest {

    private lateinit var authRepository: AuthRepository
    private val mockUserDao = mockk<UserDao>()
    private val mockDataStore = mockk<DataStore<Preferences>>()

    @Before
    fun setup() {
        authRepository = AuthRepository(mockUserDao, mockDataStore)
        
        every { mockDataStore.data } returns flowOf(preferencesOf())
        coEvery { mockDataStore.edit(any()) } returns preferencesOf()
    }

    @After
    fun tearDown() {
        clearAllMocks()
    }

    @Test
    fun `signIn with valid credentials should return success`() = runTest {
        // Arrange
        val email = "test@example.com"
        val password = "password123"
        coEvery { mockUserDao.insertUser(any()) } returns Unit

        // Act
        val result = authRepository.signIn(email, password)

        // Assert
        assertTrue(result.isSuccess)
        val user = result.getOrNull()
        assertNotNull(user)
        assertEquals(email, user.email)
        assertEquals("test", user.username)
        coVerify { mockUserDao.insertUser(any()) }
    }

    @Test
    fun `signIn with invalid email should return failure`() = runTest {
        // Arrange
        val email = "invalid-email"
        val password = "password123"

        // Act
        val result = authRepository.signIn(email, password)

        // Assert
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is AuthException)
    }

    @Test
    fun `signIn with short password should return failure`() = runTest {
        // Arrange
        val email = "test@example.com"
        val password = "123"

        // Act
        val result = authRepository.signIn(email, password)

        // Assert
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is AuthException)
    }

    @Test
    fun `signUp with valid data should return success`() = runTest {
        // Arrange
        val email = "newuser@example.com"
        val password = "password123"
        val confirmPassword = "password123"
        coEvery { mockUserDao.insertUser(any()) } returns Unit

        // Act
        val result = authRepository.signUp(email, password, confirmPassword)

        // Assert
        assertTrue(result.isSuccess)
        val user = result.getOrNull()
        assertNotNull(user)
        assertEquals(email, user.email)
        coVerify { mockUserDao.insertUser(any()) }
    }

    @Test
    fun `signUp with mismatched passwords should return failure`() = runTest {
        // Arrange
        val email = "test@example.com"
        val password = "password123"
        val confirmPassword = "different123"

        // Act
        val result = authRepository.signUp(email, password, confirmPassword)

        // Assert
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is AuthException)
        assertEquals("Passwords do not match", result.exceptionOrNull()?.message)
    }

    @Test
    fun `signUp with short password should return failure`() = runTest {
        // Arrange
        val email = "test@example.com"
        val password = "short"
        val confirmPassword = "short"

        // Act
        val result = authRepository.signUp(email, password, confirmPassword)

        // Assert
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is AuthException)
        assertEquals("Password must be at least 8 characters", result.exceptionOrNull()?.message)
    }

    @Test
    fun `signUp with empty fields should return failure`() = runTest {
        // Arrange
        val email = ""
        val password = ""
        val confirmPassword = ""

        // Act
        val result = authRepository.signUp(email, password, confirmPassword)

        // Assert
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is AuthException)
        assertEquals("All fields are required", result.exceptionOrNull()?.message)
    }

    @Test
    fun `signOut should clear data and return success`() = runTest {
        // Arrange
        coEvery { mockUserDao.deleteAllUsers() } returns Unit

        // Act
        val result = authRepository.signOut()

        // Assert
        assertTrue(result.isSuccess)
        coVerify { mockUserDao.deleteAllUsers() }
        coVerify { mockDataStore.edit(any()) }
    }
}