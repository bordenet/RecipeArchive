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
        print("DEBUG ShareViewController: init(nibName:bundle:) called!")
        setupAndProcess()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        print("DEBUG ShareViewController: init(coder:) called!")
        setupAndProcess()
    }

    private func setupAndProcess() {
        print("DEBUG ShareViewController: setupAndProcess() called!")
        print("DEBUG ShareViewController: extensionContext = \(String(describing: extensionContext))")

        // Set a timeout to ensure we don't hang
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
            if !(self?.hasCompleted ?? true) {
                print("DEBUG ShareViewController: Timeout reached!")
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
        print("DEBUG ShareViewController: viewDidLoad() called!")

        // Make view transparent while processing
        view.backgroundColor = .clear
    }

    private func processSharedContent() {
        print("DEBUG ShareViewController: processSharedContent() called!")
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

                // Extract URL - try multiple type identifiers (iPad/Mac may use different ones)
                let urlTypes = ["public.url", "public.file-url", "public.text", "public.plain-text"]
                print("DEBUG: Checking for URL in \(urlTypes.count) type identifiers...")
                for urlType in urlTypes {
                    let hasType = attachment.hasItemConformingToTypeIdentifier(urlType)
                    print("DEBUG:   \(urlType): \(hasType ? "YES" : "NO")")

                    if hasType {
                        dispatchGroup.enter()
                        print("DEBUG: Loading \(urlType)...")

                        // Specify we expect a URL class (fixes macOS Catalyst issue)
                        let options: [AnyHashable: Any] = [NSItemProviderPreferredImageSizeKey: NSValue(cgSize: CGSize.zero)]

                        attachment.loadItem(forTypeIdentifier: urlType, options: options, completionHandler: { (item, error) in
                            defer { dispatchGroup.leave() }

                            if let error = error {
                                print("DEBUG: Error loading \(urlType): \(error)")
                                return
                            }

                            guard let item = item else {
                                print("DEBUG: Loaded \(urlType) but item is nil!")
                                return
                            }

                            print("DEBUG: Loaded \(urlType), item type: \(type(of: item))")

                            if let url = item as? URL {
                                print("DEBUG: Got URL from \(urlType): \(url)")
                                if extractedURL == nil {
                                    extractedURL = url
                                }
                            } else if let nsurl = item as? NSURL {
                                print("DEBUG: Got NSURL from \(urlType): \(nsurl)")
                                if extractedURL == nil {
                                    extractedURL = nsurl as URL
                                }
                            } else if let urlString = item as? String {
                                print("DEBUG: Got string from \(urlType): \(urlString)")
                                if extractedURL == nil, let url = URL(string: urlString), url.scheme == "http" || url.scheme == "https" {
                                    print("DEBUG: Converted to URL: \(url)")
                                    extractedURL = url
                                }
                            } else if let data = item as? Data {
                                print("DEBUG: Got Data from \(urlType), trying to convert to string...")
                                if let urlString = String(data: data, encoding: .utf8) {
                                    print("DEBUG: Converted Data to string: \(urlString)")
                                    if extractedURL == nil, let url = URL(string: urlString), url.scheme == "http" || url.scheme == "https" {
                                        print("DEBUG: Converted Data to URL: \(url)")
                                        extractedURL = url
                                    }
                                }
                            } else {
                                print("DEBUG: Got unexpected type from \(urlType): \(type(of: item))")
                                // Try converting to string as last resort
                                if let description = (item as? CustomStringConvertible)?.description,
                                   let url = URL(string: description),
                                   url.scheme == "http" || url.scheme == "https" {
                                    print("DEBUG: Converted description to URL: \(url)")
                                    if extractedURL == nil {
                                        extractedURL = url
                                    }
                                }
                            }
                        })
                    }
                }

                // Extract HTML (for full recipe content, including paywalled sites)
                let hasHTML = attachment.hasItemConformingToTypeIdentifier("public.html")
                print("DEBUG: public.html: \(hasHTML ? "YES" : "NO")")

                if hasHTML {
                    dispatchGroup.enter()
                    print("DEBUG: Loading public.html...")
                    attachment.loadItem(forTypeIdentifier: "public.html", options: nil) { (item, error) in
                        defer { dispatchGroup.leave() }

                        if let error = error {
                            print("DEBUG: Error loading public.html: \(error)")
                            return
                        }

                        print("DEBUG: Loaded public.html, item type: \(type(of: item))")

                        if let data = item as? Data, let html = String(data: data, encoding: .utf8) {
                            print("DEBUG: Got HTML (\(html.count) chars)")
                            extractedHTML = html
                        } else if let html = item as? String {
                            print("DEBUG: Got HTML string (\(html.count) chars)")
                            extractedHTML = html
                        } else {
                            print("DEBUG: Got unexpected type for public.html: \(type(of: item))")
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
            print("DEBUG ShareExt: ERROR - Could not get container URL for App Group!")
            return
        }

        print("DEBUG ShareExt: App Group container path: \(containerURL.path)")

        // Ensure container directory exists
        do {
            try FileManager.default.createDirectory(at: containerURL, withIntermediateDirectories: true, attributes: nil)
            print("DEBUG ShareExt: Container directory verified/created")
        } catch {
            print("DEBUG ShareExt: Error creating container directory: \(error)")
        }

        // Use file-based sharing for macOS Catalyst reliability
        let fileURL = containerURL.appendingPathComponent("shared_recipe.json")

        var payload: [String: Any] = [
            "url": url.absoluteString,
            "timestamp": Date().timeIntervalSince1970
        ]
        if let html = html {
            payload["html"] = html
        }

        // Serialize JSON once, outside the do-catch blocks
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
            print("DEBUG ShareExt: Failed to serialize JSON")
            return
        }

        do {
            // Write directly without atomic option to avoid temp file issues on Catalyst
            try data.write(to: fileURL, options: [])
            print("DEBUG ShareExt: Saved to file: \(fileURL.path)")
            print("DEBUG ShareExt: File size: \(data.count) bytes")
        } catch {
            print("DEBUG ShareExt: Error saving to file: \(error)")
        }
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
