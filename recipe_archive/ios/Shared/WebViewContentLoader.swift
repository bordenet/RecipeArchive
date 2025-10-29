import WebKit
import UIKit

@MainActor
public class WebViewContentLoader: NSObject, WKNavigationDelegate, WKURLSchemeHandler {
    @MainActor private var webView: WKWebView?
    private let url: URL
    private let completion: @MainActor (String?, [String: Data]?) -> Void
    @MainActor private var hasCompleted = false
    @MainActor private var loadTimeout: Timer?
    @MainActor private var imageData: [String: Data] = [:]
    
    public init(url: URL, completion: @escaping (String?, [String: Data]?) -> Void) {
        self.url = url
        self.completion = completion
        super.init()
        
        // Create web view configuration
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent() // Don't save cookies/data
        config.setURLSchemeHandler(self, forURLScheme: "recipe-image")
        
        // Create off-screen web view
        webView = WKWebView(frame: .zero, configuration: config)
        webView?.navigationDelegate = self
        
                // Set timeout
        loadTimeout = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            self.handleTimeout()
        }
        
        // Start loading
        webView?.load(URLRequest(url: url))
    }
    
    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Get the HTML content and process images once page is loaded
        webView.evaluateJavaScript("""
            function getRecipeImages() {
                let images = document.querySelectorAll('img');
                let imageUrls = [];
                images.forEach(img => {
                    if (img.src && (img.src.startsWith('http://') || img.src.startsWith('https://'))) {
                        // Filter out very small images
                        if (img.width >= 200 || img.height >= 200) {
                            imageUrls.push(img.src);
                        }
                    }
                });
                return {
                    html: document.documentElement.outerHTML,
                    images: imageUrls
                };
            }
            getRecipeImages();
        """) { [weak self] result, error in
            guard let self = self, !self.hasCompleted else { return }
            
            if let result = result as? [String: Any],
               let html = result["html"] as? String,
               let imageUrls = result["images"] as? [String] {
                // Queue image downloads
                let group = DispatchGroup()
                for imageUrl in imageUrls {
                    guard let url = URL(string: imageUrl) else { continue }
                    
                    group.enter()
                    URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
                        defer { group.leave() }
                        if let data = data {
                            self?.imageData[imageUrl] = data
                        }
                    }.resume()
                }
                
                // Complete when all images are downloaded
                group.notify(queue: .main) { [weak self] in
                    self?.completeWithSuccess(html: html)
                }
            } else {
                self.completeWithError()
            }
        }
    }
    
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        completeWithError()
    }
    
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        completeWithError()
    }
    
    private func handleTimeout() {
        completeWithError()
    }
    
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
    
    // MARK: - WKURLSchemeHandler
    
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
            
            guard let data = data,
                  let response = response else {
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
        // Implementation not needed for this use case
    }
}