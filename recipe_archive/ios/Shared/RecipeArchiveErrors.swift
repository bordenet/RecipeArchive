//
//  RecipeArchiveErrors.swift
//  RecipeArchive
//
//  Error types for Recipe Archive iOS components
//

import Foundation

/// Errors that can occur during recipe queue operations
public enum RecipeQueueError: LocalizedError {
    case appGroupUnavailable
    case invalidPayload
    case serializationFailed
    case fileWriteFailed(Error)
    case fileReadFailed(Error)
    case noRecipesInQueue

    public var errorDescription: String? {
        switch self {
        case .appGroupUnavailable:
            return "Unable to access App Group container"
        case .invalidPayload:
            return "Recipe data is invalid or incomplete"
        case .serializationFailed:
            return "Failed to serialize recipe data"
        case .fileWriteFailed(let error):
            return "Failed to write recipe file: \(error.localizedDescription)"
        case .fileReadFailed(let error):
            return "Failed to read recipe file: \(error.localizedDescription)"
        case .noRecipesInQueue:
            return "No recipes available in queue"
        }
    }
}

/// Errors that can occur during content extraction
public enum ContentExtractionError: LocalizedError {
    case noExtensionItems
    case noURL
    case invalidURL
    case timeout
    case extractionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .noExtensionItems:
            return "No content to share"
        case .noURL:
            return "No URL found. Please share a web page."
        case .invalidURL:
            return "Invalid URL. Please share a web page (http:// or https://)"
        case .timeout:
            return "Timeout: Unable to extract content"
        case .extractionFailed(let reason):
            return "Content extraction failed: \(reason)"
        }
    }
}

/// Errors that can occur during web archive processing
public enum WebArchiveError: LocalizedError {
    case invalidArchiveData
    case missingMainResource
    case serializationFailed

    public var errorDescription: String? {
        switch self {
        case .invalidArchiveData:
            return "Web archive data is invalid"
        case .missingMainResource:
            return "Web archive is missing main resource"
        case .serializationFailed:
            return "Failed to serialize web archive"
        }
    }
}
