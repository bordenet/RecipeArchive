package com.recipeArchive.recipe_archive

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import java.util.UUID

class ShareActivity : Activity() {
    companion object {
        private const val TAG = "ShareActivity"
        private const val PREFS_NAME = "recipe_queue"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "ShareActivity onCreate")
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        Log.d(TAG, "ShareActivity onNewIntent")
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        Log.d(TAG, "ShareActivity handleIntent - action: ${intent?.action}")

        if (intent?.action == Intent.ACTION_SEND) {
            val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
            Log.d(TAG, "Received shared text: $sharedText")

            if (sharedText != null) {
                val url = extractUrl(sharedText)
                if (url != null && isValidWebUrl(url)) {
                    Log.d(TAG, "Valid URL detected: $url")
                    // Load HTML via WebView
                    WebViewContentLoader(this, url) { html, images ->
                        saveToSharedPreferences(url, html, images)
                        openMainApp()
                    }
                } else {
                    Log.w(TAG, "Invalid URL: $sharedText")
                    finish()
                }
            } else {
                Log.w(TAG, "No text in share intent")
                finish()
            }
        } else {
            Log.w(TAG, "Not a SEND action: ${intent?.action}")
            finish()
        }
    }

    private fun extractUrl(text: String): String? {
        // Handle case where text contains URL plus other content
        val urlPattern = Regex("https?://[^\\s]+")
        val match = urlPattern.find(text)
        return match?.value ?: if (text.startsWith("http://") || text.startsWith("https://")) text else null
    }

    private fun isValidWebUrl(url: String): Boolean {
        return url.startsWith("http://") || url.startsWith("https://")
    }

    private fun saveToSharedPreferences(
        url: String,
        html: String?,
        images: Map<String, ByteArray>?
    ) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val timestamp = System.currentTimeMillis()
        val uuid = UUID.randomUUID().toString().take(8)
        val key = "recipe_${timestamp}_${uuid}"

        val payload = buildString {
            append("{")
            append("\"url\":\"${escapeJson(url)}\",")
            append("\"timestamp\":$timestamp")

            if (html != null) {
                append(",\"html\":\"${escapeJson(html)}\"")
            }

            if (images != null && images.isNotEmpty()) {
                append(",\"images\":[")
                images.entries.forEachIndexed { index, (imageUrl, data) ->
                    if (index > 0) append(",")
                    append("{")
                    append("\"url\":\"${escapeJson(imageUrl)}\",")
                    append("\"data\":\"${android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP)}\",")
                    append("\"mimeType\":\"${inferMimeType(imageUrl)}\"")
                    append("}")
                }
                append("]")
            }

            append("}")
        }

        Log.d(TAG, "Saving to SharedPreferences with key: $key")
        prefs.edit().putString(key, payload).apply()
    }

    private fun escapeJson(str: String): String {
        return str
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    private fun inferMimeType(url: String): String {
        return when {
            url.endsWith(".jpg", ignoreCase = true) || url.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
            url.endsWith(".png", ignoreCase = true) -> "image/png"
            url.endsWith(".gif", ignoreCase = true) -> "image/gif"
            url.endsWith(".webp", ignoreCase = true) -> "image/webp"
            else -> "image/jpeg" // default
        }
    }

    private fun openMainApp() {
        Log.d(TAG, "Opening main app")
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            startActivity(launchIntent)
        }
        finish()
    }
}
