//
//  ShareViewController.swift
//  RecipeArchive
//
//  Share Extension view controller for capturing recipes from Safari
//

import UIKit
import WebKit
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
        setupAndProcess()
    }

    // MARK: - Setup

    private func setupAndProcess() {
        // Set timeout to prevent hanging
        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            guard let self = self, !self.hasCompleted else { return }
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
            handleError(.noExtensionItems)
            return
        }

        contentExtractor.extractContent(from: extensionItems) { [weak self] result in
            guard let self = self, !self.hasCompleted else { return }

            switch result {
            case .success(let content):
                self.handleExtractedContent(content)
            case .failure(let error):
                self.handleError(error)
            }
        }
    }

    private func handleExtractedContent(_ content: ExtractedContent) {
        // If no HTML was extracted, try loading via WKWebView
        if content.html == nil {
            loadContentViaWebView(url: content.url, existingImages: content.images)
        } else {
            enqueueRecipe(url: content.url, html: content.html, images: content.images)
        }
    }

    private func loadContentViaWebView(url: URL, existingImages: [[String: Any]]) {
        let loader = WebViewContentLoader(url: url) { [weak self] html, imageData in
            guard let self = self else { return }

            var allImages = existingImages

            // Convert image data to expected format
            if let imageData = imageData {
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
        do {
            try recipeQueueService.enqueue(url: url, html: html, images: images)
            showSuccessAndDismiss(url: url)
        } catch {
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
