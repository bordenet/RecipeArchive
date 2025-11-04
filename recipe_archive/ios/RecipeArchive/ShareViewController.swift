//
//  ShareViewController.swift
//  RecipeArchive
//
//  Share Extension view controller for capturing recipes from Safari
//

import UIKit
import WebKit
import os
@_exported import Shared

/// View controller for the Share Extension
final class ShareViewController: UIViewController {

    // MARK: - Properties

    private var hasCompleted = false
    private var contentLoader: WebViewContentLoader?

    private let contentExtractor = ContentExtractor()
    private let recipeQueueService = RecipeQueueService()
    private let timeout: TimeInterval = 10.0

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        AppLogger.shareExtension.info("Share Extension launched")
        setupAndProcess()
    }

    // MARK: - Setup

    private func setupAndProcess() {
        AppLogger.shareExtension.debug("Setting up Share Extension with \(self.timeout)s timeout")

        // Set timeout to prevent hanging
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            guard let self = self, !self.hasCompleted else { return }
            AppLogger.shareExtension.warning("Share Extension timed out after \(self.timeout)s")
            self.handleError(.timeout)
        }

        // Process shared content
        DispatchQueue.main.async { [weak self] in
            self?.processSharedContent()
        }
    }

    // MARK: - Content Processing

    private func processSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            AppLogger.shareExtension.error("No extension items found in shared content")
            handleError(.noExtensionItems)
            return
        }

        AppLogger.shareExtension.debug("Processing \(extensionItems.count) extension items")
        contentExtractor.extractContent(from: extensionItems) { [weak self] result in
            guard let self = self, !self.hasCompleted else { return }

            switch result {
            case .success(let content):
                AppLogger.shareExtension.info("Successfully extracted content from URL: \(content.url.absoluteString, privacy: .public)")
                self.handleExtractedContent(content)
            case .failure(let error):
                AppLogger.shareExtension.error("Content extraction failed: \(error.localizedDescription)")
                self.handleError(error)
            }
        }
    }

    private func handleExtractedContent(_ content: ExtractedContent) {
        // If no HTML was extracted, try loading via WKWebView
        if content.html == nil {
            AppLogger.shareExtension.info("No HTML extracted, falling back to WebView loading")
            loadContentViaWebView(url: content.url, existingImages: content.images)
        } else {
            AppLogger.shareExtension.debug("HTML extracted (\(content.html!.count) bytes), enqueueing recipe")
            enqueueRecipe(url: content.url, html: content.html, images: content.images)
        }
    }

    private func loadContentViaWebView(url: URL, existingImages: [[String: Any]]) {
        AppLogger.shareExtension.debug("Starting WebView content loading for URL: \(url.absoluteString, privacy: .public)")

        let loader = WebViewContentLoader(url: url) { [weak self] html, imageData in
            guard let self = self else { return }

            var allImages = existingImages

            // Convert image data to expected format
            if let imageData = imageData {
                AppLogger.shareExtension.debug("WebView loaded \(imageData.count) images")
                for (imageUrl, data) in imageData {
                    allImages.append([
                        "url": imageUrl,
                        "data": data,
                        "mimeType": self.inferMimeType(from: imageUrl)
                    ])
                }
            }

            self.enqueueRecipe(url: url, html: html, images: allImages)
        }

        // Retain loader to prevent deallocation
        self.contentLoader = loader
    }

    private func enqueueRecipe(url: URL, html: String?, images: [[String: Any]]) {
        AppLogger.shareExtension.info("Enqueueing recipe. URL: \(url.absoluteString, privacy: .public), HTML: \(html != nil ? "\(html!.count) bytes" : "none"), Images: \(images.count)")

        do {
            try recipeQueueService.enqueue(url: url, html: html, images: images)
            AppLogger.shareExtension.info("Successfully enqueued recipe")
            showSuccessAndDismiss(url: url)
        } catch {
            AppLogger.shareExtension.error("Failed to enqueue recipe: \(error.localizedDescription)")
            handleError(.extractionFailed(error.localizedDescription))
        }
    }

    // MARK: - UI

    private func showSuccessAndDismiss(url: URL) {
        let alert = UIAlertController(
            title: "Recipe Queued",
            message: "Recipe added to queue. Share more recipes, then open RecipeArchive to process all.",
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.dismissExtension()
        })

        present(alert, animated: true)
    }

    private func handleError(_ error: ContentExtractionError) {
        let alert = UIAlertController(
            title: "Cannot Share Recipe",
            message: error.localizedDescription,
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.dismissExtension()
        })

        present(alert, animated: true)
    }

    private func dismissExtension() {
        guard !hasCompleted else { return }
        hasCompleted = true
        AppLogger.shareExtension.debug("Dismissing Share Extension")
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    // MARK: - Helpers

    private func inferMimeType(from url: String) -> String {
        let lowercasedURL = url.lowercased()
        if lowercasedURL.hasSuffix(".jpg") || lowercasedURL.hasSuffix(".jpeg") {
            return "image/jpeg"
        } else if lowercasedURL.hasSuffix(".png") {
            return "image/png"
        } else if lowercasedURL.hasSuffix(".gif") {
            return "image/gif"
        } else if lowercasedURL.hasSuffix(".webp") {
            return "image/webp"
        }
        return "image/jpeg" // Default
    }
}
