//
//  ShareViewController.swift
//  RecipeArchive
//
//  Created by Matt Bordenet on 10/25/25.
//

import UIKit
import Social

class ShareViewController: SLComposeServiceViewController {

    private var extractedURL: URL?

    override func viewDidLoad() {
        super.viewDidLoad()

        // Extract URL from shared content
        extractURL()
    }

    override func isContentValid() -> Bool {
        // Validate that we have a valid web URL
        guard let url = extractedURL else {
            return false
        }
        return isValidWebURL(url)
    }

    override func didSelectPost() {
        // Save URL to App Group for main app to process
        if let url = extractedURL {
            saveURLToAppGroup(url)
        }

        // Close the share extension
        self.extensionContext!.completeRequest(returningItems: [], completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        return []
    }

    // MARK: - URL Extraction

    private func extractURL() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showErrorAndDismiss(message: "No content to share")
            return
        }

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for attachment in attachments {
                // Try to get URL from different representations
                if attachment.hasItemConformingToTypeIdentifier("public.url") {
                    attachment.loadItem(forTypeIdentifier: "public.url", options: nil) { [weak self] (item, error) in
                        if let url = item as? URL {
                            DispatchQueue.main.async {
                                self?.extractedURL = url
                                self?.validateContent()
                            }
                        }
                    }
                    return
                }

                // Fallback: try to get URL from web page
                if attachment.hasItemConformingToTypeIdentifier("public.html") {
                    attachment.loadItem(forTypeIdentifier: "public.html", options: nil) { [weak self] (item, error) in
                        // Extract URL from HTML content if needed
                        // For now, we'll rely on public.url
                        if error != nil {
                            DispatchQueue.main.async {
                                self?.showErrorAndDismiss(message: "Could not extract URL from page")
                            }
                        }
                    }
                }
            }
        }
    }

    internal override func validateContent() {
        if !isContentValid() {
            showErrorAndDismiss(message: "Invalid URL. Please share a web page (http:// or https://)")
        }
    }

    // MARK: - URL Validation

    private func isValidWebURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else {
            return false
        }

        // Only allow HTTP and HTTPS
        return scheme == "http" || scheme == "https"
    }

    // MARK: - App Group Communication

    private func saveURLToAppGroup(_ url: URL) {
        let defaults = UserDefaults(suiteName: "group.com.recipearchive.shared")
        defaults?.set(url.absoluteString, forKey: "shared_url")
        defaults?.set(Date(), forKey: "shared_url_timestamp")
        defaults?.synchronize()
    }

    // MARK: - Error Handling

    private func showErrorAndDismiss(message: String) {
        let alert = UIAlertController(
            title: "Cannot Share Recipe",
            message: message,
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.cancel()
        })

        present(alert, animated: true)
    }
}
