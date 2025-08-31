package com.recipearchive.android.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.recipearchive.android.data.local.UserDao
import com.recipearchive.android.data.model.User
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val userDao: UserDao,
    private val dataStore: DataStore<Preferences>
) {
    
    companion object {
        private val USER_TOKEN_KEY = stringPreferencesKey("user_token")
        private val USER_EMAIL_KEY = stringPreferencesKey("user_email")
    }

    val currentUser: Flow<User?> = userDao.getCurrentUser()
    
    val isAuthenticated: Flow<Boolean> = dataStore.data.map { preferences ->
        preferences[USER_TOKEN_KEY] != null
    }

    suspend fun signIn(email: String, password: String): Result<User> {
        return try {
            // Simulate network delay
            delay(1500)
            
            // Basic validation (simulating AWS Cognito)
            if (!email.contains("@") || password.length < 6) {
                throw AuthException("Invalid email or password")
            }
            
            val user = User(
                id = UUID.randomUUID().toString(),
                email = email,
                username = email.substringBefore("@"),
                lastLoginAt = System.currentTimeMillis()
            )
            
            // Save user to database
            userDao.insertUser(user)
            
            // Save auth state
            dataStore.edit { preferences ->
                preferences[USER_TOKEN_KEY] = "mock_token_${user.id}"
                preferences[USER_EMAIL_KEY] = email
            }
            
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signUp(email: String, password: String, confirmPassword: String): Result<User> {
        return try {
            // Validate input
            if (email.isEmpty() || password.isEmpty() || confirmPassword.isEmpty()) {
                throw AuthException("All fields are required")
            }
            
            if (password != confirmPassword) {
                throw AuthException("Passwords do not match")
            }
            
            if (password.length < 8) {
                throw AuthException("Password must be at least 8 characters")
            }
            
            if (!email.contains("@")) {
                throw AuthException("Invalid email format")
            }
            
            // Simulate network delay
            delay(2000)
            
            val user = User(
                id = UUID.randomUUID().toString(),
                email = email,
                username = email.substringBefore("@")
            )
            
            // Save user to database
            userDao.insertUser(user)
            
            // Save auth state
            dataStore.edit { preferences ->
                preferences[USER_TOKEN_KEY] = "mock_token_${user.id}"
                preferences[USER_EMAIL_KEY] = email
            }
            
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signOut(): Result<Unit> {
        return try {
            // Clear auth state
            dataStore.edit { preferences ->
                preferences.remove(USER_TOKEN_KEY)
                preferences.remove(USER_EMAIL_KEY)
            }
            
            // Clear user data
            userDao.deleteAllUsers()
            
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAuthToken(): String? {
        return dataStore.data.first()[USER_TOKEN_KEY]
    }
}

class AuthException(message: String) : Exception(message)