package com.recipearchive.android.data.local

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import android.content.Context
import com.recipearchive.android.data.model.Recipe
import com.recipearchive.android.data.model.User

@Database(
    entities = [Recipe::class, User::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class RecipeDatabase : RoomDatabase() {
    abstract fun recipeDao(): RecipeDao
    abstract fun userDao(): UserDao

    companion object {
        const val DATABASE_NAME = "recipe_archive_db"
    }
}