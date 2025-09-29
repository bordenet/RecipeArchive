package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ExtensionVersions represents the S3 versions.json structure
type ExtensionVersions struct {
	LastUpdated string `json:"lastUpdated"`
	Extensions  struct {
		Chrome struct {
			Version     string `json:"version"`
			DownloadURL string `json:"downloadUrl"`
		} `json:"chrome"`
		Safari struct {
			Version     string `json:"version"`
			DownloadURL string `json:"downloadUrl"`
		} `json:"safari"`
	} `json:"extensions"`
}

// validateExtensionDownloads validates that extension files referenced in versions.json are downloadable
func validateExtensionDownloads(projectRoot string) bool {
	fmt.Printf("  Extension Downloads... ")

	// S3 versions.json URL
	versionsURL := "https://recipe-storage-0ea7007d57f67ecb-990537043943.s3.us-west-2.amazonaws.com/extensions/versions.json"

	// Fetch versions.json
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(versionsURL)
	if err != nil {
		fmt.Printf("❌ Failed to fetch versions.json: %v\n", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("❌ versions.json returned HTTP %d\n", resp.StatusCode)
		return false
	}

	// Parse versions.json
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("❌ Failed to read versions.json: %v\n", err)
		return false
	}

	var versions ExtensionVersions
	if err := json.Unmarshal(body, &versions); err != nil {
		fmt.Printf("❌ Failed to parse versions.json: %v\n", err)
		return false
	}

	// Validate Chrome extension download
	if !validateExtensionURL(versions.Extensions.Chrome.DownloadURL, "Chrome", versions.Extensions.Chrome.Version) {
		return false
	}

	// Validate Safari extension download
	if !validateExtensionURL(versions.Extensions.Safari.DownloadURL, "Safari", versions.Extensions.Safari.Version) {
		return false
	}

	return true
}

// validateExtensionURL checks if an extension download URL is accessible
func validateExtensionURL(url, platform, version string) bool {
	client := &http.Client{Timeout: 15 * time.Second}

	// Use HEAD request to check if file exists without downloading
	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		fmt.Printf("❌ Failed to create request for %s v%s: %v\n", platform, version, err)
		return false
	}

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ %s v%s download failed: %v\n", platform, version, err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("❌ %s v%s download returned HTTP %d\n", platform, version, resp.StatusCode)
		return false
	}

	// Check Content-Type is zip
	contentType := resp.Header.Get("Content-Type")
	if contentType != "application/zip" {
		fmt.Printf("⚠️  %s v%s has unexpected content type: %s\n", platform, version, contentType)
		// Don't fail for this - some S3 configs might not set the right content type
	}

	return true
}