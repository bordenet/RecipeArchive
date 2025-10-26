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

                // Try public.url first
                if attachment.hasItemConformingToTypeIdentifier("public.url") {
                    print("DEBUG: Loading public.url")
                    attachment.loadItem(forTypeIdentifier: "public.url", options: nil) { [weak self] (item, error) in
                        guard let self = self, !self.hasCompleted else { return }

                        if let error = error {
                            print("DEBUG: Error loading URL: \(error)")
                            DispatchQueue.main.async {
                                self.showErrorAndDismiss(message: "Error loading URL: \(error.localizedDescription)")
                            }
                            return
                        }

                        if let url = item as? URL {
                            print("DEBUG: Got URL: \(url)")
                            DispatchQueue.main.async {
                                self.processURL(url)
                            }
                        } else if let urlString = item as? String, let url = URL(string: urlString) {
                            print("DEBUG: Got URL from string: \(url)")
                            DispatchQueue.main.async {
                                self.processURL(url)
                            }
                        } else {
                            print("DEBUG: Item is not a URL: \(String(describing: item))")
                            DispatchQueue.main.async {
                                self.showErrorAndDismiss(message: "Could not extract URL from shared content")
                            }
                        }
                    }
                    return
                }
            }
        }

        // If we get here, no URL type was found
        print("DEBUG: No public.url found in any attachment")
        showErrorAndDismiss(message: "No URL found. Please share a web page.")
    }

    private func processURL(_ url: URL) {
        print("DEBUG: Processing URL: \(url.absoluteString)")

        // Validate URL scheme
        guard isValidWebURL(url) else {
            print("DEBUG: Invalid URL scheme")
            showErrorAndDismiss(message: "Invalid URL. Please share a web page (http:// or https://)")
            return
        }

        print("DEBUG: URL is valid, saving to App Group")

        // Save to App Group
        saveURLToAppGroup(url)

        print("DEBUG: Saved successfully, showing success and dismissing")

        // Show success message before dismissing
        showSuccessAndDismiss(url: url)
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

    private func saveURLToAppGroup(_ url: URL) {
        let defaults = UserDefaults(suiteName: "group.com.recipearchive.shared")
        defaults?.set(url.absoluteString, forKey: "shared_url")
        defaults?.set(Date(), forKey: "shared_url_timestamp")
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
