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
public enum AppLogger {

    /// Logger for Share Extension operations
    public static let shareExtension = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "ShareExtension"
    )

    /// Logger for WKWebView content loading
    public static let webView = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "WebView"
    )

    /// Logger for network operations (S3, API calls)
    public static let network = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Network"
    )

    /// Logger for recipe parsing operations
    public static let parser = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Parser"
    )

    /// Logger for local storage operations
    public static let storage = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Storage"
    )

    /// Logger for authentication operations
    public static let auth = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Auth"
    )

    /// Logger for Flutter MethodChannel bridge
    public static let flutter = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.RecipeArchive",
        category: "Flutter"
    )
}
