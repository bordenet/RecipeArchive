//
//  ShareViewController.swift
//  RecipeArchive
//
//  Created by Matt Bordenet on 10/25/25.
//

import UIKit

class ShareViewController: UIViewController {

    private var hasCompleted = false

    override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
        setupAndProcess()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupAndProcess()
    }

    private func setupAndProcess() {
        // Set a timeout to ensure we don't hang
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
            if !(self?.hasCompleted ?? true) {
                self?.showErrorAndDismiss(message: "Timeout: Unable to extract URL from shared content")
            }
        }

        // Process shared content after view is loaded
        DispatchQueue.main.async { [weak self] in
            self?.processSharedContent()
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // Make view transparent while processing
        view.backgroundColor = .clear
    }

    private func processSharedContent() {
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

        // Extract URL and HTML from shared content
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for attachment in attachments {
                // Extract URL - try multiple type identifiers (iPad/Mac may use different ones)
                let urlTypes = ["public.url", "public.file-url", "public.text", "public.plain-text"]
                for urlType in urlTypes {
                    if attachment.hasItemConformingToTypeIdentifier(urlType) {
                        dispatchGroup.enter()

                        // Specify we expect a URL class (fixes macOS Catalyst issue)
                        let options: [AnyHashable: Any] = [NSItemProviderPreferredImageSizeKey: NSValue(cgSize: CGSize.zero)]

                        attachment.loadItem(forTypeIdentifier: urlType, options: options, completionHandler: { (item, error) in
                            defer { dispatchGroup.leave() }

                            guard error == nil, let item = item else { return }

                            if let url = item as? URL {
                                if extractedURL == nil {
                                    extractedURL = url
                                }
                            } else if let nsurl = item as? NSURL {
                                if extractedURL == nil {
                                    extractedURL = nsurl as URL
                                }
                            } else if let urlString = item as? String {
                                if extractedURL == nil, let url = URL(string: urlString), url.scheme == "http" || url.scheme == "https" {
                                    extractedURL = url
                                }
                            } else if let data = item as? Data {
                                if let urlString = String(data: data, encoding: .utf8) {
                                    if extractedURL == nil, let url = URL(string: urlString), url.scheme == "http" || url.scheme == "https" {
                                        extractedURL = url
                                    }
                                }
                            } else {
                                // Try converting to string as last resort
                                if let description = (item as? CustomStringConvertible)?.description,
                                   let url = URL(string: description),
                                   url.scheme == "http" || url.scheme == "https" {
                                    if extractedURL == nil {
                                        extractedURL = url
                                    }
                                }
                            }
                        })
                    }
                }

                // Extract HTML (for full recipe content, including paywalled sites)
                if attachment.hasItemConformingToTypeIdentifier("public.html") {
                    dispatchGroup.enter()
                    attachment.loadItem(forTypeIdentifier: "public.html", options: nil) { (item, error) in
                        defer { dispatchGroup.leave() }

                        guard error == nil else { return }

                        if let data = item as? Data, let html = String(data: data, encoding: .utf8) {
                            extractedHTML = html
                        } else if let html = item as? String {
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
                self.showErrorAndDismiss(message: "No URL found. Please share a web page.")
                return
            }

            // Validate URL
            guard self.isValidWebURL(url) else {
                self.showErrorAndDismiss(message: "Invalid URL. Please share a web page (http:// or https://)")
                return
            }

            // Save both URL and HTML to App Group
            self.saveToAppGroup(url: url, html: extractedHTML)
            self.showSuccessAndDismiss(url: url)
        }
    }

    private func showSuccessAndDismiss(url: URL) {
        // Share Extensions cannot open their container app directly
        // User must manually switch back to the app
        // The app will detect the shared URL via applicationWillEnterForeground
        let alert = UIAlertController(
            title: "Recipe Saved",
            message: "Switch back to RecipeArchive to parse this recipe",
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
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.recipearchive.shared") else {
            return
        }

        // Ensure container directory exists
        try? FileManager.default.createDirectory(at: containerURL, withIntermediateDirectories: true, attributes: nil)

        // Use file-based sharing for macOS Catalyst reliability
        let fileURL = containerURL.appendingPathComponent("shared_recipe.json")

        var payload: [String: Any] = [
            "url": url.absoluteString,
            "timestamp": Date().timeIntervalSince1970
        ]
        if let html = html {
            payload["html"] = html
        }

        // Serialize JSON and write to file
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
            return
        }

        // Write directly without atomic option to avoid temp file issues on Catalyst
        try? data.write(to: fileURL, options: [])
    }


    private func dismissExtension() {
        guard !hasCompleted else { return }
        hasCompleted = true
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
