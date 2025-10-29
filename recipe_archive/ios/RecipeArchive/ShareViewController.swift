//
//  ShareViewController.swift
//  RecipeArchive
//
//  Created by Matt Bordenet on 10/25/25.
//

import UIKit
import WebKit
@_exported import Shared // Import our shared framework // This makes WebViewContentLoader available

class ShareViewController: UIViewController {

    private var hasCompleted = false
    private var contentLoader: WebViewContentLoader?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
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

    private func processSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showErrorAndDismiss(message: "No content to share")
            return
        }

        extractContent(from: extensionItems) { [weak self] url, html, images in
            guard let self = self, !self.hasCompleted else { return }

            guard let url = url else {
                self.showErrorAndDismiss(message: "No URL found. Please share a web page.")
                return
            }

            guard self.isValidWebURL(url) else {
                self.showErrorAndDismiss(message: "Invalid URL. Please share a web page (http:// or https://)")
                return
            }

            self.saveToAppGroup(url: url, html: html, images: images)
            self.showSuccessAndDismiss(url: url)
        }
    }

    private func extractContent(from extensionItems: [NSExtensionItem], completion: @escaping (URL?, String?, [[String: Any]]) -> Void) {
        var extractedURL: URL?
        var extractedHTML: String?
        var webArchiveImages: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for attachment in attachments {
                // Extract URL
                let urlTypes = ["public.url", "public.file-url", "public.text", "public.plain-text"]
                for urlType in urlTypes where attachment.hasItemConformingToTypeIdentifier(urlType) {
                    dispatchGroup.enter()
                    attachment.loadItem(forTypeIdentifier: urlType, options: nil) { item, _ in
                        defer { dispatchGroup.leave() }
                        if let url = self.url(from: item) {
                            if extractedURL == nil {
                                extractedURL = url
                            }
                        }
                    }
                }

                // Extract Web Archive
                if attachment.hasItemConformingToTypeIdentifier("com.apple.webarchive") {
                    dispatchGroup.enter()
                    attachment.loadItem(forTypeIdentifier: "com.apple.webarchive", options: nil) { item, error in
                        defer { dispatchGroup.leave() }
                        guard error == nil, let item = item else { return }
                        self.processWebArchive(item: item) { url, html, images in
                            if extractedURL == nil {
                                extractedURL = url
                            }
                            if extractedHTML == nil {
                                extractedHTML = html
                            }
                            webArchiveImages.append(contentsOf: images)
                        }
                    }
                }

                // Extract HTML
                if attachment.hasItemConformingToTypeIdentifier("public.html") {
                    dispatchGroup.enter()
                    attachment.loadItem(forTypeIdentifier: "public.html", options: nil) { item, _ in
                        defer { dispatchGroup.leave() }
                        if let data = item as? Data, let html = String(data: data, encoding: .utf8) {
                            extractedHTML = html
                        } else if let html = item as? String {
                            extractedHTML = html
                        }
                    }
                }
            }
        }

        dispatchGroup.notify(queue: .main) {
            completion(extractedURL, extractedHTML, webArchiveImages)
        }
    }

    private func url(from item: Any?) -> URL? {
        if let url = item as? URL {
            return url
        }
        if let nsurl = item as? NSURL {
            return nsurl as URL
        }
        if let urlString = item as? String, let url = URL(string: urlString), isValidWebURL(url) {
            return url
        }
        if let data = item as? Data, let urlString = String(data: data, encoding: .utf8), let url = URL(string: urlString), isValidWebURL(url) {
            return url
        }
        if let description = (item as? CustomStringConvertible)?.description, let url = URL(string: description), isValidWebURL(url) {
            return url
        }
        return nil
    }

    private func processWebArchive(item: Any, completion: @escaping (URL?, String?, [[String: Any]]) -> Void) {
        var extractedURL: URL?
        var extractedHTML: String?
        var webArchiveImages: [[String: Any]] = []

        let processArchiveData: (Data) -> Void = { data in
            guard let archive = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else { return }

            if let mainResource = archive["WebMainResource"] as? [String: Any] {
                if let urlString = mainResource["WebResourceURL"] as? String, let webURL = URL(string: urlString) {
                    extractedURL = webURL
                }
                if let htmlData = mainResource["WebResourceData"] as? Data, let html = String(data: htmlData, encoding: .utf8) {
                    extractedHTML = html
                }
            }

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
        }

        if let url = item as? URL, let data = try? Data(contentsOf: url) {
            processArchiveData(data)
        } else if let data = item as? Data {
            processArchiveData(data)
        }

        completion(extractedURL, extractedHTML, webArchiveImages)
    }

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

    private func isValidWebURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }

    private func saveToAppGroup(url: URL, html: String?, images: [[String: Any]]) {
        // If no HTML content was shared directly, try to load it via WKWebView
        if html == nil {
            let contentLoader = WebViewContentLoader(url: url) { [weak self] loadedHtml in
                self?.saveToAppGroup(url: url, html: loadedHtml, images: images)
            }
            // Store the loader as a property to prevent deallocation
            self.contentLoader = contentLoader
            return
        }

        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.recipearchive.shared") else {
            return
        }

        let queueURL = containerURL.appendingPathComponent("recipe_queue")
        try? FileManager.default.createDirectory(at: queueURL, withIntermediateDirectories: true, attributes: nil)

        let timestamp = Date().timeIntervalSince1970
        let uuid = UUID().uuidString.prefix(8)
        let filename = "recipe_\(Int(timestamp))_\(uuid).json"
        let fileURL = queueURL.appendingPathComponent(filename)

        var payload: [String: Any] = [
            "url": url.absoluteString,
            "timestamp": timestamp
        ]
        if let html = html {
            payload["html"] = html
        }

        if !images.isEmpty {
            var serializableImages: [[String: Any]] = []
            for image in images {
                if let imageURL = image["url"] as? String,
                   let imageData = image["data"] as? Data,
                   let mimeType = image["mimeType"] as? String {
                    serializableImages.append([
                        "url": imageURL,
                        "data": imageData.base64EncodedString(),
                        "mimeType": mimeType
                    ])
                }
            }
            payload["images"] = serializableImages
        }

        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
            return
        }

        do {
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            print("ERROR ShareViewController: Failed to queue recipe: \(error)")
        }
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
