//
//  WebArchiveProcessor.swift
//  RecipeArchive
//
//  Processes Apple Web Archive format
//

import Foundation

/// Result of web archive processing
public struct WebArchiveResult {
    public let url: URL?
    public let html: String?
    public let images: [[String: Any]]

    public init(url: URL?, html: String?, images: [[String: Any]]) {
        self.url = url
        self.html = html
        self.images = images
    }
}

/// Service for processing web archives
public final class WebArchiveProcessor {

    // MARK: - Public Methods

    /// Processes a web archive item
    public func process(item: Any) throws -> WebArchiveResult {
        let data: Data

        if let url = item as? URL {
            do {
                data = try Data(contentsOf: url)
            } catch {
                throw WebArchiveError.invalidArchiveData
            }
        } else if let itemData = item as? Data {
            data = itemData
        } else {
            throw WebArchiveError.invalidArchiveData
        }

        return try processArchiveData(data)
    }

    // MARK: - Private Methods

    private func processArchiveData(_ data: Data) throws -> WebArchiveResult {
        guard let archive = try? PropertyListSerialization.propertyList(
            from: data,
            format: nil
        ) as? [String: Any] else {
            throw WebArchiveError.serializationFailed
        }

        var extractedURL: URL?
        var extractedHTML: String?
        var webArchiveImages: [[String: Any]] = []

        // Extract main resource
        if let mainResource = archive["WebMainResource"] as? [String: Any] {
            if let urlString = mainResource["WebResourceURL"] as? String,
               let webURL = URL(string: urlString) {
                extractedURL = webURL
            }
            if let htmlData = mainResource["WebResourceData"] as? Data,
               let html = String(data: htmlData, encoding: .utf8) {
                extractedHTML = html
            }
        }

        // Extract image subresources
        if let subresources = archive["WebSubresources"] as? [[String: Any]] {
            for resource in subresources {
                if let mimeType = resource["WebResourceMIMEType"] as? String,
                   mimeType.hasPrefix("image/"),
                   let resourceURL = resource["WebResourceURL"] as? String,
                   let resourceData = resource["WebResourceData"] as? Data {
                    webArchiveImages.append([
                        "url": resourceURL,
                        "data": resourceData,
                        "mimeType": mimeType
                    ])
                }
            }
        }

        return WebArchiveResult(url: extractedURL, html: extractedHTML, images: webArchiveImages)
    }
}
