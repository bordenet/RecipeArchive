//
//  WebViewContentLoader.swift
//  RecipeArchive
//
//  Loads web pages off-screen and extracts HTML + images
//

import WebKit
import UIKit
import os

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
        AppLogger.webView.debug("Setting up WebView for URL: \(self.url.absoluteString, privacy: .public)")

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
        AppLogger.webView.info("Starting WebView load for URL: \(self.url.absoluteString, privacy: .public)")
        webView?.load(URLRequest(url: url))
    }

    // MARK: - Private Methods - Completion

    private func completeWithSuccess(html: String) {
        guard !hasCompleted else { return }
        hasCompleted = true
        loadTimeout?.invalidate()
        webView = nil

        AppLogger.webView.info("WebView load completed successfully. HTML length: \(html.count) bytes, Images: \(self.imageData.count)")
        completion(html, imageData.isEmpty ? nil : imageData)
    }

    private func completeWithError() {
        guard !hasCompleted else { return }
        hasCompleted = true
        loadTimeout?.invalidate()
        webView = nil

        AppLogger.webView.error("WebView load failed for URL: \(self.url.absoluteString, privacy: .public)")
        completion(nil, nil)
    }

    private func handleTimeout() {
        AppLogger.webView.warning("WebView load timed out after \(self.timeout) seconds for URL: \(self.url.absoluteString, privacy: .public)")
        completeWithError()
    }
}

// MARK: - WKNavigationDelegate

extension WebViewContentLoader: WKNavigationDelegate {

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        AppLogger.webView.debug("WebView navigation finished, extracting content")
        extractContentFromPage()
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        AppLogger.webView.error("WebView navigation failed: \(error.localizedDescription)")
        completeWithError()
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        AppLogger.webView.error("WebView provisional navigation failed: \(error.localizedDescription)")
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

            if let error = error {
                AppLogger.webView.error("JavaScript evaluation failed: \(error.localizedDescription)")
                self.completeWithError()
                return
            }

            if let result = result as? [String: Any],
               let html = result["html"] as? String,
               let imageUrls = result["images"] as? [String] {
                AppLogger.webView.debug("Extracted HTML (\(html.count) bytes) and \(imageUrls.count) image URLs")
                self.downloadImages(imageUrls) {
                    self.completeWithSuccess(html: html)
                }
            } else {
                AppLogger.webView.warning("Failed to extract HTML or images from page")
                self.completeWithError()
            }
        }
    }

    private func downloadImages(_ imageUrls: [String], completion: @escaping () -> Void) {
        guard !imageUrls.isEmpty else {
            AppLogger.webView.debug("No images to download")
            completion()
            return
        }

        AppLogger.webView.info("Starting download of \(imageUrls.count) images")
        let group = DispatchGroup()

        for imageUrlString in imageUrls {
            guard let imageUrl = URL(string: imageUrlString) else {
                AppLogger.webView.warning("Invalid image URL: \(imageUrlString, privacy: .public)")
                continue
            }

            group.enter()
            URLSession.shared.dataTask(with: imageUrl) { [weak self] data, response, error in
                defer { group.leave() }

                if let error = error {
                    AppLogger.webView.warning("Failed to download image: \(error.localizedDescription)")
                    return
                }

                if let data = data {
                    AppLogger.webView.debug("Downloaded image (\(data.count) bytes) from: \(imageUrlString, privacy: .public)")
                    self?.imageData[imageUrlString] = data
                }
            }.resume()
        }

        group.notify(queue: .main) {
            AppLogger.webView.info("Image download completed. Successfully downloaded: \(self.imageData.count) images")
            completion()
        }
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
