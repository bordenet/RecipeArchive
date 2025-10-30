package com.recipeArchive.recipe_archive

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import android.webkit.WebViewClient
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class WebViewContentLoader(
    private val context: Context,
    private val url: String,
    private val callback: (String?, Map<String, ByteArray>?) -> Unit
) {
    companion object {
        private const val TAG = "WebViewContentLoader"
        private const val TIMEOUT_MS = 30000L
        private const val IMAGE_DOWNLOAD_TIMEOUT_MS = 10000L
    }

    private var webView: WebView? = null
    private val imageData = mutableMapOf<String, ByteArray>()
    private var completed = false
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    init {
        Log.d(TAG, "Starting WebView load for URL: $url")

        // Create WebView on main thread
        Handler(Looper.getMainLooper()).post {
            setupWebView()
        }

        // Set timeout
        Handler(Looper.getMainLooper()).postDelayed({
            if (!completed) {
                Log.w(TAG, "WebView load timed out after ${TIMEOUT_MS}ms")
                completeWithError()
            }
        }, TIMEOUT_MS)
    }

    private fun setupWebView() {
        try {
            webView = WebView(context).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    loadWithOverviewMode = true
                    useWideViewPort = true
                }

                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        Log.d(TAG, "Page finished loading: $url")
                        extractHtmlAndImages()
                    }

                    override fun onReceivedError(
                        view: WebView?,
                        errorCode: Int,
                        description: String?,
                        failingUrl: String?
                    ) {
                        Log.e(TAG, "WebView error: $description (code: $errorCode)")
                        completeWithError()
                    }
                }

                loadUrl(this@WebViewContentLoader.url)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error setting up WebView", e)
            completeWithError()
        }
    }

    private fun extractHtmlAndImages() {
        webView?.evaluateJavascript("""
            (function() {
                let images = document.querySelectorAll('img');
                let imageUrls = [];
                images.forEach(img => {
                    if (img.src && (img.width >= 200 || img.height >= 200)) {
                        imageUrls.push(img.src);
                    }
                });
                return JSON.stringify({
                    html: document.documentElement.outerHTML,
                    images: imageUrls
                });
            })();
        """) { result ->
            try {
                if (result != null && result != "null") {
                    // Remove quotes from JavaScript result
                    val cleanResult = result.trim('"').replace("\\\"", "\"")
                        .replace("\\n", "\n")
                        .replace("\\r", "\r")
                        .replace("\\t", "\t")
                        .replace("\\\\", "\\")

                    val data = JSONObject(cleanResult)
                    val html = data.optString("html", null)
                    val imageUrlsArray = data.optJSONArray("images")

                    Log.d(TAG, "Extracted HTML (${html?.length ?: 0} chars) and ${imageUrlsArray?.length() ?: 0} image URLs")

                    if (imageUrlsArray != null && imageUrlsArray.length() > 0) {
                        val imageUrls = mutableListOf<String>()
                        for (i in 0 until imageUrlsArray.length()) {
                            imageUrls.add(imageUrlsArray.getString(i))
                        }
                        downloadImages(imageUrls) {
                            complete(html, imageData)
                        }
                    } else {
                        complete(html, null)
                    }
                } else {
                    Log.w(TAG, "JavaScript returned null or empty result")
                    completeWithError()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing JavaScript result", e)
                completeWithError()
            }
        }
    }

    private fun downloadImages(urls: List<String>, onComplete: () -> Unit) {
        val client = OkHttpClient.Builder()
            .connectTimeout(IMAGE_DOWNLOAD_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .readTimeout(IMAGE_DOWNLOAD_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .build()

        var remainingDownloads = urls.size
        val maxImages = 10 // Limit to first 10 images

        Log.d(TAG, "Starting download of ${urls.take(maxImages).size} images")

        urls.take(maxImages).forEach { imageUrl ->
            val request = Request.Builder()
                .url(imageUrl)
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onResponse(call: Call, response: Response) {
                    try {
                        if (response.isSuccessful) {
                            response.body?.bytes()?.let { bytes ->
                                // Limit image size to 10MB
                                if (bytes.size <= 10 * 1024 * 1024) {
                                    synchronized(imageData) {
                                        imageData[imageUrl] = bytes
                                    }
                                    Log.d(TAG, "Downloaded image: $imageUrl (${bytes.size} bytes)")
                                } else {
                                    Log.w(TAG, "Image too large, skipping: $imageUrl (${bytes.size} bytes)")
                                }
                            }
                        } else {
                            Log.w(TAG, "Failed to download image: $imageUrl (${response.code})")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error processing image response: $imageUrl", e)
                    } finally {
                        synchronized(this@WebViewContentLoader) {
                            remainingDownloads--
                            if (remainingDownloads == 0) {
                                Handler(Looper.getMainLooper()).post {
                                    onComplete()
                                }
                            }
                        }
                    }
                }

                override fun onFailure(call: Call, e: IOException) {
                    Log.e(TAG, "Failed to download image: $imageUrl", e)
                    synchronized(this@WebViewContentLoader) {
                        remainingDownloads--
                        if (remainingDownloads == 0) {
                            Handler(Looper.getMainLooper()).post {
                                onComplete()
                            }
                        }
                    }
                }
            })
        }
    }

    private fun complete(html: String?, images: Map<String, ByteArray>?) {
        if (!completed) {
            completed = true
            Log.d(TAG, "Completing with HTML and ${images?.size ?: 0} images")
            cleanup()
            callback(html, images)
        }
    }

    private fun completeWithError() {
        if (!completed) {
            completed = true
            Log.w(TAG, "Completing with error - falling back to URL-only mode")
            cleanup()
            callback(null, null)
        }
    }

    private fun cleanup() {
        scope.cancel()
        webView?.destroy()
        webView = null
    }
}
