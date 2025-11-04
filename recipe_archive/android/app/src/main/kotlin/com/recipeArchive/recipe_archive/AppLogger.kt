package com.recipeArchive.recipe_archive

import android.util.Log

/**
 * Centralized structured logging for RecipeArchive Android app
 * Provides consistent logging categories and methods across the application
 */
object AppLogger {

    private const val TAG_PREFIX = "RecipeArchive"

    /**
     * Logger for Share Extension operations
     */
    object ShareExtension {
        private const val TAG = "$TAG_PREFIX:ShareExtension"

        fun debug(message: String) = Log.d(TAG, message)
        fun info(message: String) = Log.i(TAG, message)
        fun warning(message: String) = Log.w(TAG, message)
        fun error(message: String, throwable: Throwable? = null) {
            if (throwable != null) {
                Log.e(TAG, message, throwable)
            } else {
                Log.e(TAG, message)
            }
        }
    }

    /**
     * Logger for WebView content loading
     */
    object WebView {
        private const val TAG = "$TAG_PREFIX:WebView"

        fun debug(message: String) = Log.d(TAG, message)
        fun info(message: String) = Log.i(TAG, message)
        fun warning(message: String) = Log.w(TAG, message)
        fun error(message: String, throwable: Throwable? = null) {
            if (throwable != null) {
                Log.e(TAG, message, throwable)
            } else {
                Log.e(TAG, message)
            }
        }
    }

    /**
     * Logger for network operations (S3, API calls)
     */
    object Network {
        private const val TAG = "$TAG_PREFIX:Network"

        fun debug(message: String) = Log.d(TAG, message)
        fun info(message: String) = Log.i(TAG, message)
        fun warning(message: String) = Log.w(TAG, message)
        fun error(message: String, throwable: Throwable? = null) {
            if (throwable != null) {
                Log.e(TAG, message, throwable)
            } else {
                Log.e(TAG, message)
            }
        }
    }

    /**
     * Logger for recipe parsing operations
     */
    object Parser {
        private const val TAG = "$TAG_PREFIX:Parser"

        fun debug(message: String) = Log.d(TAG, message)
        fun info(message: String) = Log.i(TAG, message)
        fun warning(message: String) = Log.w(TAG, message)
        fun error(message: String, throwable: Throwable? = null) {
            if (throwable != null) {
                Log.e(TAG, message, throwable)
            } else {
                Log.e(TAG, message)
            }
        }
    }

    /**
     * Logger for local storage operations
     */
    object Storage {
        private const val TAG = "$TAG_PREFIX:Storage"

        fun debug(message: String) = Log.d(TAG, message)
        fun info(message: String) = Log.i(TAG, message)
        fun warning(message: String) = Log.w(TAG, message)
        fun error(message: String, throwable: Throwable? = null) {
            if (throwable != null) {
                Log.e(TAG, message, throwable)
            } else {
                Log.e(TAG, message)
            }
        }
    }

    /**
     * Logger for authentication operations
     */
    object Auth {
        private const val TAG = "$TAG_PREFIX:Auth"

        fun debug(message: String) = Log.d(TAG, message)
        fun info(message: String) = Log.i(TAG, message)
        fun warning(message: String) = Log.w(TAG, message)
        fun error(message: String, throwable: Throwable? = null) {
            if (throwable != null) {
                Log.e(TAG, message, throwable)
            } else {
                Log.e(TAG, message)
            }
        }
    }

    /**
     * Logger for Flutter MethodChannel bridge
     */
    object Flutter {
        private const val TAG = "$TAG_PREFIX:Flutter"

        fun debug(message: String) = Log.d(TAG, message)
        fun info(message: String) = Log.i(TAG, message)
        fun warning(message: String) = Log.w(TAG, message)
        fun error(message: String, throwable: Throwable? = null) {
            if (throwable != null) {
                Log.e(TAG, message, throwable)
            } else {
                Log.e(TAG, message)
            }
        }
    }
}
