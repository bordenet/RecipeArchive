//
//  WebViewContentLoader.swift
//  RecipeArchive
//
//  Loads web pages off-screen and extracts HTML + images
//

import WebKit
import UIKit

/// Loads web content using an off-screen WKWebView and extracts HTML and images
@MainActor
public final class WebViewContentLoader: NSObject {

    // MARK: - Properties

    private var webView: WKWebView?
    private let url: URL
    private let completion: (String?, [String: Data]?) -> Void
    private var hasCompleted = false
    private var loadTimeout: Timer?
    private var imageData: [String: Data] = [:]

    private let timeout: TimeInterval = 30.0
    private let minImageSize: CGFloat = 200.0

    // MARK: - Initialization

    /// Initializes the loader and begins loading the URL
    /// - Parameters:
    ///   - url: The URL to load
    ///   - completion: Called with HTML content and image data when loading completes
    public init(url: URL, completion: @escaping (String?, [String: Data]?) -> Void) {
        self.url = url
        self.completion = completion
        super.init()

        setupWebView()
        startLoading()
    }

    // MARK: - Private Methods - Setup

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent() // Don't save cookies/data
        config.setURLSchemeHandler(self, forURLScheme: "recipe-image")

        webView = WKWebView(frame: .zero, configuration: config)
        webView?.navigationDelegate = self

        // Set timeout
        loadTimeout = Timer.scheduledTimer(
            withTimeInterval: timeout,
            repeats: false
        ) { [weak self] _ in
            self?.handleTimeout()
        }
    }

    private func startLoading() {
        webView?.load(URLRequest(url: url))
    }

    // MARK: - Private Methods - Completion

    private func completeWithSuccess(html: String) {
        guard !hasCompleted else { return }
        hasCompleted = true
        loadTimeout?.invalidate()
        webView = nil
        completion(html, imageData.isEmpty ? nil : imageData)
    }

    private func completeWithError() {
        guard !hasCompleted else { return }
        hasCompleted = true
        loadTimeout?.invalidate()
        webView = nil
        completion(nil, nil)
    }

    private func handleTimeout() {
        completeWithError()
    }
}

// MARK: - WKNavigationDelegate

extension WebViewContentLoader: WKNavigationDelegate {

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        extractContentFromPage()
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        completeWithError()
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        completeWithError()
    }

    // MARK: - Private Methods - Content Extraction

    private func extractContentFromPage() {
        let script = """
        (function() {
            let images = document.querySelectorAll('img');
            let imageUrls = [];
            images.forEach(img => {
                if (img.src && (img.src.startsWith('http://') || img.src.startsWith('https://'))) {
                    // Filter out very small images
                    if (img.width >= \(minImageSize) || img.height >= \(minImageSize)) {
                        imageUrls.push(img.src);
                    }
                }
            });
            return {
                html: document.documentElement.outerHTML,
                images: imageUrls
            };
        })();
        """

        webView?.evaluateJavaScript(script) { [weak self] result, error in
            guard let self = self, !self.hasCompleted else { return }

            if let result = result as? [String: Any],
               let html = result["html"] as? String,
               let imageUrls = result["images"] as? [String] {
                self.downloadImages(imageUrls) {
                    self.completeWithSuccess(html: html)
                }
            } else {
                self.completeWithError()
            }
        }
    }

    private func downloadImages(_ imageUrls: [String], completion: @escaping () -> Void) {
        let group = DispatchGroup()

        for imageUrlString in imageUrls {
            guard let imageUrl = URL(string: imageUrlString) else { continue }

            group.enter()
            URLSession.shared.dataTask(with: imageUrl) { [weak self] data, response, error in
                defer { group.leave() }
                if let data = data {
                    self?.imageData[imageUrlString] = data
                }
            }.resume()
        }

        group.notify(queue: .main, execute: completion)
    }
}

// MARK: - WKURLSchemeHandler

extension WebViewContentLoader: WKURLSchemeHandler {

    public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let imageUrl = URL(string: String(url.path.dropFirst())) else {
            urlSchemeTask.didFailWithError(NSError(domain: "", code: -1))
            return
        }

        let task = URLSession.shared.dataTask(with: imageUrl) { [weak self] data, response, error in
            if let error = error {
                urlSchemeTask.didFailWithError(error)
                return
            }

            guard let data = data, let response = response else {
                urlSchemeTask.didFailWithError(NSError(domain: "", code: -1))
                return
            }

            // Store image data
            self?.imageData[imageUrl.absoluteString] = data

            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }
        task.resume()
    }

    public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // No-op: Tasks are handled asynchronously
    }
}
