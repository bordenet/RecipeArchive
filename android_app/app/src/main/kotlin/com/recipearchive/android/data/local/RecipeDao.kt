package com.recipearchive.android.data.local

import androidx.room.*
import com.recipearchive.android.data.model.Recipe
import kotlinx.coroutines.flow.Flow

@Dao
interface RecipeDao {
    
    @Query("SELECT * FROM recipes ORDER BY updatedAt DESC")
    fun getAllRecipes(): Flow<List<Recipe>>

    @Query("SELECT * FROM recipes WHERE id = :id")
    suspend fun getRecipeById(id: String): Recipe?

    @Query("""
        SELECT * FROM recipes 
        WHERE title LIKE :searchQuery 
        OR description LIKE :searchQuery
        OR cuisine LIKE :searchQuery
        ORDER BY updatedAt DESC
    """)
    fun searchRecipes(searchQuery: String): Flow<List<Recipe>>

    @Query("SELECT * FROM recipes WHERE tags LIKE :tag ORDER BY updatedAt DESC")
    fun getRecipesByTag(tag: String): Flow<List<Recipe>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecipe(recipe: Recipe)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecipes(recipes: List<Recipe>)

    @Update
    suspend fun updateRecipe(recipe: Recipe)

    @Delete
    suspend fun deleteRecipe(recipe: Recipe)

    @Query("DELETE FROM recipes WHERE id = :id")
    suspend fun deleteRecipeById(id: String)

    @Query("DELETE FROM recipes")
    suspend fun deleteAllRecipes()

    @Query("SELECT COUNT(*) FROM recipes")
    suspend fun getRecipeCount(): Int
}