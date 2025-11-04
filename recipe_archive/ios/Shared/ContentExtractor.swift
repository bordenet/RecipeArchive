//
//  ContentExtractor.swift
//  RecipeArchive
//
//  Extracts URLs, HTML, and images from shared content
//

import Foundation
import UIKit
import os

/// Result of content extraction
public struct ExtractedContent {
    public let url: URL
    public let html: String?
    public let images: [[String: Any]]

    public init(url: URL, html: String?, images: [[String: Any]]) {
        self.url = url
        self.html = html
        self.images = images
    }
}

/// Service for extracting content from NSExtensionItems
public final class ContentExtractor {

    // MARK: - Properties

    private let webArchiveProcessor: WebArchiveProcessor

    // MARK: - Initialization

    public init(webArchiveProcessor: WebArchiveProcessor = WebArchiveProcessor()) {
        self.webArchiveProcessor = webArchiveProcessor
    }

    // MARK: - Public Methods

    /// Extracts content from extension items asynchronously
    public func extractContent(
        from extensionItems: [NSExtensionItem],
        completion: @escaping (Result<ExtractedContent, ContentExtractionError>) -> Void
    ) {
        AppLogger.shareExtension.debug("Starting content extraction from \(extensionItems.count) extension items")

        var extractedURL: URL?
        var extractedHTML: String?
        var webArchiveImages: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            AppLogger.shareExtension.debug("Processing \(attachments.count) attachments")

            for attachment in attachments {
                // Extract URL
                extractURL(from: attachment, group: dispatchGroup) { url in
                    if extractedURL == nil {
                        extractedURL = url
                        if let url = url {
                            AppLogger.shareExtension.debug("Extracted URL: \(url.absoluteString, privacy: .public)")
                        }
                    }
                }

                // Extract Web Archive
                extractWebArchive(from: attachment, group: dispatchGroup) { url, html, images in
                    if extractedURL == nil {
                        extractedURL = url
                    }
                    if extractedHTML == nil {
                        extractedHTML = html
                        if let html = html {
                            AppLogger.shareExtension.debug("Extracted HTML from Web Archive (\(html.count) bytes)")
                        }
                    }
                    if !images.isEmpty {
                        AppLogger.shareExtension.debug("Extracted \(images.count) images from Web Archive")
                        webArchiveImages.append(contentsOf: images)
                    }
                }

                // Extract HTML
                extractHTML(from: attachment, group: dispatchGroup) { html in
                    if extractedHTML == nil {
                        extractedHTML = html
                        if let html = html {
                            AppLogger.shareExtension.debug("Extracted HTML from attachment (\(html.count) bytes)")
                        }
                    }
                }
            }
        }

        dispatchGroup.notify(queue: .main) {
            guard let url = extractedURL else {
                AppLogger.shareExtension.error("No URL found in shared content")
                completion(.failure(.noURL))
                return
            }

            guard self.isValidWebURL(url) else {
                AppLogger.shareExtension.error("Invalid web URL: \(url.absoluteString, privacy: .public)")
                completion(.failure(.invalidURL))
                return
            }

            AppLogger.shareExtension.info("Content extraction completed. URL: \(url.absoluteString, privacy: .public), HTML: \(extractedHTML != nil ? "yes" : "no"), Images: \(webArchiveImages.count)")
            let content = ExtractedContent(url: url, html: extractedHTML, images: webArchiveImages)
            completion(.success(content))
        }
    }

    // MARK: - Private Methods

    private func extractURL(
        from attachment: NSItemProvider,
        group: DispatchGroup,
        completion: @escaping (URL?) -> Void
    ) {
        let urlTypes = ["public.url", "public.file-url", "public.text", "public.plain-text"]
        for urlType in urlTypes where attachment.hasItemConformingToTypeIdentifier(urlType) {
            group.enter()
            attachment.loadItem(forTypeIdentifier: urlType, options: nil) { item, _ in
                defer { group.leave() }
                completion(self.url(from: item))
            }
        }
    }

    private func extractWebArchive(
        from attachment: NSItemProvider,
        group: DispatchGroup,
        completion: @escaping (URL?, String?, [[String: Any]]) -> Void
    ) {
        guard attachment.hasItemConformingToTypeIdentifier("com.apple.webarchive") else {
            return
        }

        AppLogger.shareExtension.debug("Found Web Archive attachment, loading...")
        group.enter()
        attachment.loadItem(forTypeIdentifier: "com.apple.webarchive", options: nil) { [weak self] item, error in
            defer { group.leave() }

            if let error = error {
                AppLogger.shareExtension.error("Failed to load Web Archive: \(error.localizedDescription)")
                completion(nil, nil, [])
                return
            }

            guard let item = item else {
                AppLogger.shareExtension.warning("Web Archive item is nil")
                completion(nil, nil, [])
                return
            }

            do {
                let result = try self?.webArchiveProcessor.process(item: item)
                if let result = result {
                    AppLogger.shareExtension.debug("Successfully processed Web Archive")
                }
                completion(result?.url, result?.html, result?.images ?? [])
            } catch {
                AppLogger.shareExtension.error("Failed to process Web Archive: \(error.localizedDescription)")
                completion(nil, nil, [])
            }
        }
    }

    private func extractHTML(
        from attachment: NSItemProvider,
        group: DispatchGroup,
        completion: @escaping (String?) -> Void
    ) {
        guard attachment.hasItemConformingToTypeIdentifier("public.html") else {
            return
        }

        group.enter()
        attachment.loadItem(forTypeIdentifier: "public.html", options: nil) { item, _ in
            defer { group.leave() }
            if let data = item as? Data, let html = String(data: data, encoding: .utf8) {
                completion(html)
            } else if let html = item as? String {
                completion(html)
            } else {
                completion(nil)
            }
        }
    }

    private func url(from item: Any?) -> URL? {
        if let url = item as? URL {
            return url
        }
        if let nsurl = item as? NSURL {
            return nsurl as URL
        }
        if let urlString = item as? String,
           let url = URL(string: urlString),
           isValidWebURL(url) {
            return url
        }
        if let data = item as? Data,
           let urlString = String(data: data, encoding: .utf8),
           let url = URL(string: urlString),
           isValidWebURL(url) {
            return url
        }
        if let description = (item as? CustomStringConvertible)?.description,
           let url = URL(string: description),
           isValidWebURL(url) {
            return url
        }
        return nil
    }

    private func isValidWebURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }
}
