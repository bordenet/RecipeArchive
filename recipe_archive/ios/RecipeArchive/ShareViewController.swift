//
//  ShareViewController.swift
//  RecipeArchive
//
//  Created by Matt Bordenet on 10/25/25.
//

import UIKit

class ShareViewController: UIViewController {

    private var hasCompleted = false

    override func viewDidLoad() {
        super.viewDidLoad()

        // Make view transparent while processing
        view.backgroundColor = .clear

        // Set a timeout to ensure we don't hang
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
            if !(self?.hasCompleted ?? true) {
                self?.showErrorAndDismiss(message: "Timeout: Unable to extract URL from shared content")
            }
        }

        // Extract and process URL
        handleSharedContent()
    }

    private func handleSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showErrorAndDismiss(message: "No content to share")
            return
        }

        var extractedURL: URL?
        var extractedHTML: String?
        let dispatchGroup = DispatchGroup()

        // Debug: print all available type identifiers
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for attachment in attachments {
                print("DEBUG: Available type identifiers:")
                if let registeredTypeIdentifiers = attachment.registeredTypeIdentifiers as? [String] {
                    for typeId in registeredTypeIdentifiers {
                        print("  - \(typeId)")
                    }
                }

                // Extract URL
                if attachment.hasItemConformingToTypeIdentifier("public.url") {
                    dispatchGroup.enter()
                    print("DEBUG: Loading public.url")
                    attachment.loadItem(forTypeIdentifier: "public.url", options: [NSExtensionItem.ExtensionJavaScriptPreprocessingResultsKey: URL.self]) { (item, error) in
                        defer { dispatchGroup.leave() }

                        if let url = item as? URL {
                            print("DEBUG: Got URL: \(url)")
                            extractedURL = url
                        } else if let urlString = item as? String, let url = URL(string: urlString) {
                            print("DEBUG: Got URL from string: \(url)")
                            extractedURL = url
                        }
                    }
                }

                // Extract HTML (for full recipe content, including paywalled sites)
                if attachment.hasItemConformingToTypeIdentifier("public.html") {
                    dispatchGroup.enter()
                    print("DEBUG: Loading public.html")
                    attachment.loadItem(forTypeIdentifier: "public.html", options: [NSExtensionItem.ExtensionJavaScriptPreprocessingResultsKey: String.self]) { (item, error) in
                        defer { dispatchGroup.leave() }

                        if let data = item as? Data, let html = String(data: data, encoding: .utf8) {
                            print("DEBUG: Got HTML (\(html.count) chars)")
                            extractedHTML = html
                        } else if let html = item as? String {
                            print("DEBUG: Got HTML string (\(html.count) chars)")
                            extractedHTML = html
                        }
                    }
                }
            }
        }

        // Wait for all extractions to complete
        dispatchGroup.notify(queue: .main) { [weak self] in
            guard let self = self, !self.hasCompleted else { return }

            // Must have at least a URL
            guard let url = extractedURL else {
                print("DEBUG: No URL extracted")
                self.showErrorAndDismiss(message: "No URL found. Please share a web page.")
                return
            }

            // Validate URL
            guard self.isValidWebURL(url) else {
                print("DEBUG: Invalid URL scheme")
                self.showErrorAndDismiss(message: "Invalid URL. Please share a web page (http:// or https://)")
                return
            }

            print("DEBUG: Processing URL: \(url.absoluteString), HTML: \(extractedHTML != nil ? "yes" : "no")")

            // Save both URL and HTML to App Group
            self.saveToAppGroup(url: url, html: extractedHTML)
            self.showSuccessAndDismiss(url: url)
        }
    }

    private func showSuccessAndDismiss(url: URL) {
        let alert = UIAlertController(
            title: "Recipe Saved",
            message: "Open RecipeArchive to parse this recipe:\n\(url.absoluteString)",
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.dismissExtension()
        })

        present(alert, animated: true)
    }

    private func isValidWebURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else {
            return false
        }
        return scheme == "http" || scheme == "https"
    }

    private func saveToAppGroup(url: URL, html: String?) {
        let defaults = UserDefaults(suiteName: "group.com.recipearchive.RecipeArchive")
        defaults?.set(url.absoluteString, forKey: "shared_url")
        defaults?.set(Date(), forKey: "shared_url_timestamp")

        // Save HTML if available (for paywalled sites and full recipe parsing)
        if let html = html {
            defaults?.set(html, forKey: "shared_html")
            print("DEBUG: Saved HTML to App Group (\(html.count) chars)")
        } else {
            defaults?.removeObject(forKey: "shared_html")
            print("DEBUG: No HTML available, saved URL only")
        }

        defaults?.synchronize()
    }


    private func dismissExtension() {
        guard !hasCompleted else { return }
        hasCompleted = true
        print("DEBUG: Dismissing extension")
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func showErrorAndDismiss(message: String) {
        let alert = UIAlertController(
            title: "Cannot Share Recipe",
            message: message,
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.dismissExtension()
        })

        present(alert, animated: true)
    }
}
