package com.recipeArchive.recipe_archive

import android.content.Context
import android.os.Handler
import android.os.Looper
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
        private const val TIMEOUT_MS = 30000L
        private const val IMAGE_DOWNLOAD_TIMEOUT_MS = 10000L
    }

    private var webView: WebView? = null
    private val imageData = mutableMapOf<String, ByteArray>()
    private var completed = false
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    init {
        AppLogger.WebView.info("Starting WebView load for URL: $url")

        // Create WebView on main thread
        Handler(Looper.getMainLooper()).post {
            setupWebView()
        }

        // Set timeout
        Handler(Looper.getMainLooper()).postDelayed({
            if (!completed) {
                AppLogger.WebView.warning("WebView load timed out after ${TIMEOUT_MS}ms")
                completeWithError()
            }
        }, TIMEOUT_MS)
    }

    private fun setupWebView() {
        try {
            AppLogger.WebView.debug("Setting up WebView for URL: $url")
            webView = WebView(context).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    loadWithOverviewMode = true
                    useWideViewPort = true
                }

                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        AppLogger.WebView.debug("WebView navigation finished, extracting content")
                        extractHtmlAndImages()
                    }

                    override fun onReceivedError(
                        view: WebView?,
                        errorCode: Int,
                        description: String?,
                        failingUrl: String?
                    ) {
                        AppLogger.WebView.error("WebView error: $description (code: $errorCode)")
                        completeWithError()
                    }
                }

                loadUrl(this@WebViewContentLoader.url)
            }
        } catch (e: Exception) {
            AppLogger.WebView.error("Error setting up WebView", e)
            completeWithError()
        }
    }

    private fun extractHtmlAndImages() {
        webView?.evaluateJavascript("""
            (function() {
                let images = document.querySelectorAll('img');
                let imageUrls = [];
                let seenUrls = new Set();

                images.forEach(img => {
                    // Try multiple sources: src, data-src, data-lazy-src
                    let imgUrl = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');

                    if (imgUrl && imgUrl.startsWith('http')) {
                        // Get natural dimensions if available, or use computed dimensions
                        let width = img.naturalWidth || img.width || parseInt(img.style.width) || 0;
                        let height = img.naturalHeight || img.height || parseInt(img.style.height) || 0;

                        // Accept images that are likely to be content images
                        // Either has decent dimensions OR no dimensions set (lazy-loaded)
                        if ((width >= 200 || height >= 200 || (width === 0 && height === 0)) && !seenUrls.has(imgUrl)) {
                            imageUrls.push(imgUrl);
                            seenUrls.add(imgUrl);
                        }
                    }
                });

                // If no images found yet, try meta tags (og:image, twitter:image)
                if (imageUrls.length === 0) {
                    let metaImage = document.querySelector('meta[property="og:image"]') ||
                                   document.querySelector('meta[name="twitter:image"]');
                    if (metaImage) {
                        let content = metaImage.getAttribute('content');
                        if (content && content.startsWith('http')) {
                            imageUrls.push(content);
                        }
                    }
                }

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

                    AppLogger.WebView.debug("Extracted HTML (${html?.length ?: 0} bytes) and ${imageUrlsArray?.length() ?: 0} image URLs")

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
                    AppLogger.WebView.warning("JavaScript returned null or empty result")
                    completeWithError()
                }
            } catch (e: Exception) {
                AppLogger.WebView.error("Error parsing JavaScript result", e)
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

        AppLogger.WebView.info("Starting download of ${urls.take(maxImages).size} images")

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
                                    AppLogger.WebView.debug("Downloaded image (${bytes.size} bytes) from: $imageUrl")
                                } else {
                                    AppLogger.WebView.warning("Image too large, skipping: $imageUrl (${bytes.size} bytes)")
                                }
                            }
                        } else {
                            AppLogger.WebView.warning("Failed to download image: $imageUrl (${response.code})")
                        }
                    } catch (e: Exception) {
                        AppLogger.WebView.error("Error processing image response: $imageUrl", e)
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
                    AppLogger.WebView.warning("Failed to download image: $imageUrl - ${e.message}")
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
            AppLogger.WebView.info("WebView load completed successfully. HTML: ${html?.length ?: 0} bytes, Images: ${images?.size ?: 0}")
            cleanup()
            callback(html, images)
        }
    }

    private fun completeWithError() {
        if (!completed) {
            completed = true
            AppLogger.WebView.warning("WebView load failed, falling back to URL-only mode")
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
