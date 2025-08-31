package com.recipearchive.android.data.local

import androidx.room.TypeConverter
import com.recipearchive.android.data.model.RecipeIngredient
import com.recipearchive.android.data.model.RecipeInstruction
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class Converters {
    
    @TypeConverter
    fun fromIngredientsList(ingredients: List<RecipeIngredient>): String {
        return Json.encodeToString(ingredients)
    }

    @TypeConverter
    fun toIngredientsList(ingredientsString: String): List<RecipeIngredient> {
        return Json.decodeFromString(ingredientsString)
    }

    @TypeConverter
    fun fromInstructionsList(instructions: List<RecipeInstruction>): String {
        return Json.encodeToString(instructions)
    }

    @TypeConverter
    fun toInstructionsList(instructionsString: String): List<RecipeInstruction> {
        return Json.decodeFromString(instructionsString)
    }

    @TypeConverter
    fun fromStringList(tags: List<String>): String {
        return Json.encodeToString(tags)
    }

    @TypeConverter
    fun toStringList(tagsString: String): List<String> {
        return Json.decodeFromString(tagsString)
    }
}