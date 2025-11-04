//
//  RecipeQueueService.swift
//  RecipeArchive
//
//  Manages the recipe queue in the App Group container
//

import Foundation
import os

/// Protocol for managing recipe queue operations
public protocol RecipeQueueManaging {
    func enqueue(url: URL, html: String?, images: [[String: Any]]) throws
    func dequeueNext() -> RecipeQueueItem?
}

/// Represents a queued recipe
public struct RecipeQueueItem {
    public let url: String
    public let html: String?
    public let images: [[String: Any]]?

    public var jsonString: String? {
        var payload: [String: Any] = ["url": url]
        if let html = html {
            payload["html"] = html
        }
        if let images = images {
            payload["images"] = images
        }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return nil
        }
        return jsonString
    }
}

/// Service for managing the recipe queue in the App Group container
public final class RecipeQueueService: RecipeQueueManaging {

    // MARK: - Properties

    private let appGroupIdentifier: String
    private let fileManager: FileManager

    // MARK: - Initialization

    public init(appGroupIdentifier: String = "group.com.recipearchive.shared",
                fileManager: FileManager = .default) {
        self.appGroupIdentifier = appGroupIdentifier
        self.fileManager = fileManager
    }

    // MARK: - Public Methods

    /// Enqueues a recipe for processing
    public func enqueue(url: URL, html: String?, images: [[String: Any]]) throws {
        AppLogger.storage.debug("Enqueueing recipe: \(url.absoluteString, privacy: .public)")

        let containerURL = try getContainerURL()
        let queueURL = containerURL.appendingPathComponent("recipe_queue")

        // Ensure queue directory exists
        try fileManager.createDirectory(at: queueURL, withIntermediateDirectories: true, attributes: nil)

        // Create unique filename
        let timestamp = Date().timeIntervalSince1970
        let uuid = UUID().uuidString.prefix(8)
        let filename = "recipe_\(Int(timestamp))_\(uuid).json"
        let fileURL = queueURL.appendingPathComponent(filename)

        AppLogger.storage.debug("Writing recipe to queue file: \(filename)")

        // Build payload
        var payload: [String: Any] = [
            "url": url.absoluteString,
            "timestamp": timestamp
        ]
        if let html = html {
            payload["html"] = html
            AppLogger.storage.debug("Including HTML (\(html.count) bytes)")
        }

        // Serialize images if present
        if !images.isEmpty {
            var serializableImages: [[String: Any]] = []
            for image in images {
                if let imageURL = image["url"] as? String,
                   let imageData = image["data"] as? Data,
                   let mimeType = image["mimeType"] as? String {
                    serializableImages.append([
                        "url": imageURL,
                        "data": imageData.base64EncodedString(),
                        "mimeType": mimeType
                    ])
                }
            }
            payload["images"] = serializableImages
            AppLogger.storage.debug("Including \(serializableImages.count) images")
        }

        // Serialize and write to file
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
            AppLogger.storage.error("Failed to serialize recipe payload")
            throw RecipeQueueError.serializationFailed
        }

        do {
            try data.write(to: fileURL, options: [.atomic])
            AppLogger.storage.info("Successfully enqueued recipe to: \(filename)")
        } catch {
            AppLogger.storage.error("Failed to write recipe file: \(error.localizedDescription)")
            throw RecipeQueueError.fileWriteFailed(error)
        }
    }

    /// Dequeues the next recipe from the queue (FIFO)
    public func dequeueNext() -> RecipeQueueItem? {
        AppLogger.storage.debug("Attempting to dequeue next recipe from queue")

        guard let containerURL = try? getContainerURL() else {
            AppLogger.storage.error("Failed to get App Group container URL")
            return nil
        }

        let queueURL = containerURL.appendingPathComponent("recipe_queue")

        // Get all queued recipe files sorted by creation date (oldest first)
        guard let files = try? fileManager.contentsOfDirectory(
            at: queueURL,
            includingPropertiesForKeys: [.creationDateKey],
            options: .skipsHiddenFiles
        ) else {
            AppLogger.storage.debug("No files in queue directory or directory doesn't exist")
            return nil
        }

        let recipeFiles = files
            .filter { $0.pathExtension == "json" }
            .sorted { (url1, url2) -> Bool in
                let date1 = (try? url1.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? Date.distantPast
                let date2 = (try? url2.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? Date.distantPast
                return date1 < date2
            }

        guard let firstFile = recipeFiles.first else {
            AppLogger.storage.debug("Queue is empty, no recipes to dequeue")
            return nil
        }

        AppLogger.storage.debug("Dequeuing recipe from file: \(firstFile.lastPathComponent)")

        // Read and parse file
        do {
            let data = try Data(contentsOf: firstFile)
            guard let payload = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
                  let urlString = payload["url"] as? String else {
                // Invalid file, remove it
                AppLogger.storage.warning("Invalid recipe file format, removing: \(firstFile.lastPathComponent)")
                try? fileManager.removeItem(at: firstFile)
                return nil
            }

            let html = payload["html"] as? String
            let images = payload["images"] as? [[String: Any]]

            AppLogger.storage.info("Successfully dequeued recipe: \(urlString, privacy: .public)")

            // Delete the file after reading
            try? fileManager.removeItem(at: firstFile)

            return RecipeQueueItem(url: urlString, html: html, images: images)
        } catch {
            // Remove corrupted file
            AppLogger.storage.error("Failed to read recipe file, removing: \(firstFile.lastPathComponent) - \(error.localizedDescription)")
            try? fileManager.removeItem(at: firstFile)
            return nil
        }
    }

    // MARK: - Private Methods

    private func getContainerURL() throws -> URL {
        guard let containerURL = fileManager.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else {
            AppLogger.storage.error("App Group container unavailable for identifier: \(self.appGroupIdentifier)")
            throw RecipeQueueError.appGroupUnavailable
        }
        return containerURL
    }
}
