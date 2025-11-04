package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// fetchHTMLFromURL attempts to fetch HTML content from a URL
//
// SECURITY & USAGE NOTES:
// This function is REQUIRED as a fallback for:
// 1. Web app manual URL input - public (non-paywalled) recipes only
// 2. Legacy URL-only share intents - DEPRECATED but still supported
//
// This is NOT used by:
// - Browser extensions (Chrome/Safari) - extract HTML client-side via content scripts
// - iOS app - WKWebView extracts HTML client-side with authenticated session
// - Android app - WebView extracts HTML client-side with authenticated session
//
// Limitations (BEST-EFFORT only):
// - Paywalled sites (403/401) → saves as bookmark with 🔖 prefix
// - Bot-protected sites → may return empty or error page
// - JavaScript-rendered content → may return incomplete HTML
//
// Attack Surface: PUBLIC endpoint, rate-limited by API Gateway, no SSRF risk (URL validation enforced)
// Future: Consider deprecating once all clients use client-side HTML extraction
func fetchHTMLFromURL(ctx context.Context, urlStr string) (string, error) {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 15 * time.Second, // Longer timeout for slow sites
	}

	// Create request with context for cancellation
	req, err := http.NewRequestWithContext(ctx, "GET", urlStr, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Set user agent to impersonate Chrome desktop browser (bypasses paywalls/bot detection)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	// Make the request
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			logger.Warn("failed to close response body",
				"error", closeErr,
			)
		}
	}()

	// Check for paywalls / auth required
	if resp.StatusCode == 403 {
		return "", fmt.Errorf("paywall detected (403 Forbidden) - requires authentication")
	}
	if resp.StatusCode == 401 {
		return "", fmt.Errorf("authentication required (401 Unauthorized)")
	}

	// Check for other errors
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if we got actual content
	if len(body) == 0 {
		return "", fmt.Errorf("empty response body")
	}

	return string(body), nil
}

// getDomainFromURL extracts the domain from a URL for display purposes
func getDomainFromURL(urlStr string) string {
	u, err := url.Parse(urlStr)
	if err != nil {
		return urlStr
	}
	// Remove www. prefix
	domain := strings.TrimPrefix(u.Host, "www.")
	return domain
}
