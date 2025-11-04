//
//  AppLogger.swift
//  RecipeArchive
//
//  Centralized structured logging using Apple's os.Logger
//

import Foundation
import os

/// Centralized logger factory for RecipeArchive app
/// Uses Apple's native os.Logger for structured logging with privacy controls
enum AppLogger {

    /// Logger for Share Extension operations
    static let shareExtension = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "ShareExtension"
    )

    /// Logger for WKWebView content loading
    static let webView = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "WebView"
    )

    /// Logger for network operations (S3, API calls)
    static let network = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Network"
    )

    /// Logger for recipe parsing operations
    static let parser = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Parser"
    )

    /// Logger for local storage operations
    static let storage = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Storage"
    )

    /// Logger for authentication operations
    static let auth = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Auth"
    )

    /// Logger for Flutter MethodChannel bridge
    static let flutter = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Flutter"
    )
}
