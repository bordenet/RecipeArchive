//
//  ContentExtractor.swift
//  RecipeArchive
//
//  Extracts URLs, HTML, and images from shared content
//

import Foundation
import UIKit

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
        var extractedURL: URL?
        var extractedHTML: String?
        var webArchiveImages: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for attachment in attachments {
                // Extract URL
                extractURL(from: attachment, group: dispatchGroup) { url in
                    if extractedURL == nil {
                        extractedURL = url
                    }
                }

                // Extract Web Archive
                extractWebArchive(from: attachment, group: dispatchGroup) { url, html, images in
                    if extractedURL == nil {
                        extractedURL = url
                    }
                    if extractedHTML == nil {
                        extractedHTML = html
                    }
                    webArchiveImages.append(contentsOf: images)
                }

                // Extract HTML
                extractHTML(from: attachment, group: dispatchGroup) { html in
                    if extractedHTML == nil {
                        extractedHTML = html
                    }
                }
            }
        }

        dispatchGroup.notify(queue: .main) {
            guard let url = extractedURL else {
                completion(.failure(.noURL))
                return
            }

            guard self.isValidWebURL(url) else {
                completion(.failure(.invalidURL))
                return
            }

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

        group.enter()
        attachment.loadItem(forTypeIdentifier: "com.apple.webarchive", options: nil) { [weak self] item, error in
            defer { group.leave() }
            guard error == nil, let item = item else { return }

            do {
                let result = try self?.webArchiveProcessor.process(item: item)
                completion(result?.url, result?.html, result?.images ?? [])
            } catch {
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
