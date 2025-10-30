package com.recipeArchive.recipe_archive

import android.content.Context
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject

class MainActivity : FlutterActivity() {
    companion object {
        private const val TAG = "MainActivity"
        private const val CHANNEL = "com.recipearchive/share"
        private const val PREFS_NAME = "recipe_queue"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "checkForSharedUrl" -> {
                        Log.d(TAG, "checkForSharedUrl called from Flutter")
                        val payload = checkSharedPreferences()
                        if (payload != null) {
                            Log.d(TAG, "Returning payload to Flutter: ${payload.take(200)}...")
                            result.success(payload)
                        } else {
                            Log.d(TAG, "No pending recipes in queue")
                            result.success(null)
                        }
                    }
                    else -> {
                        Log.w(TAG, "Unknown method: ${call.method}")
                        result.notImplemented()
                    }
                }
            }

        Log.d(TAG, "MethodChannel configured")
    }

    private fun checkSharedPreferences(): String? {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val allPrefs = prefs.all

        // Get oldest recipe (sorted by timestamp)
        val oldestKey = allPrefs.keys
            .filter { it.startsWith("recipe_") }
            .minByOrNull { key ->
                try {
                    prefs.getString(key, null)?.let { jsonStr ->
                        JSONObject(jsonStr).optLong("timestamp", Long.MAX_VALUE)
                    } ?: Long.MAX_VALUE
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing timestamp for key: $key", e)
                    Long.MAX_VALUE
                }
            }

        return oldestKey?.let { key ->
            val payload = prefs.getString(key, null)
            // Remove from queue after retrieving
            prefs.edit().remove(key).apply()
            Log.d(TAG, "Retrieved and removed recipe from queue: $key")
            payload
        }
    }
}
