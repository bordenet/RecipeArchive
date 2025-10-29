import WebKit
import UIKit

@MainActor
public class WebViewContentLoader: NSObject, WKNavigationDelegate {
    private var webView: WKWebView?
    private let url: URL
    private let completion: (String?) -> Void
    private var hasCompleted = false
    private var loadTimeout: Timer?
    
    public init(url: URL, completion: @escaping (String?) -> Void) {
        self.url = url
        self.completion = completion
        super.init()
        
        // Create web view configuration
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent() // Don't save cookies/data
        
        // Create off-screen web view
        webView = WKWebView(frame: .zero, configuration: config)
        webView?.navigationDelegate = self
        
                // Set timeout
        loadTimeout = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            Task { @MainActor [weak self] in
                await self?.handleTimeout()
            }
        }
        
        // Start loading
        webView?.load(URLRequest(url: url))
    }
    
    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Get the HTML content once page is loaded
        webView.evaluateJavaScript("""
            document.documentElement.outerHTML
        """) { [weak self] result, error in
            guard let self = self, !self.hasCompleted else { return }
            
            if let html = result as? String {
                self.completeWithSuccess(html: html)
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
        completion(html)
    }
    
    private func completeWithError() {
        guard !hasCompleted else { return }
        hasCompleted = true
        loadTimeout?.invalidate()
        webView = nil
        completion(nil)
    }
}