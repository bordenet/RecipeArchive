package discoverers

import (
	"compress/gzip"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// SitemapURL represents a URL from a sitemap
type SitemapURL struct {
    Loc        string    `xml:"loc"`
    LastMod    string    `xml:"lastmod"`
    ChangeFreq string    `xml:"changefreq"`
    Priority   float64   `xml:"priority"`
}

// Sitemap represents the root sitemap structure
type Sitemap struct {
	XMLName xml.Name     `xml:"urlset"`
	URLs    []SitemapURL `xml:"url"`
}

// SitemapIndex represents a sitemap index file
type SitemapIndex struct {
	XMLName  xml.Name `xml:"sitemapindex"`
	Sitemaps []struct {
		Loc string `xml:"loc"`
	} `xml:"sitemap"`
}

// SitemapDiscoverer fetches URLs from sitemap.xml files
type SitemapDiscoverer struct {
	userAgent string
	client    *http.Client
}

// NewSitemapDiscoverer creates a new sitemap discoverer
func NewSitemapDiscoverer(userAgent string) *SitemapDiscoverer {
	return &SitemapDiscoverer{
		userAgent: userAgent,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// DiscoverURLs fetches and parses a sitemap, returning recipe URLs
func (d *SitemapDiscoverer) DiscoverURLs(sitemapURL string, domain string) ([]string, error) {
	var allRecipeURLs []string
	visitedSitemaps := make(map[string]bool)

	var discover func(string) error
	discover = func(currentSitemapURL string) error {
		if visitedSitemaps[currentSitemapURL] {
			return nil
		}
		visitedSitemaps[currentSitemapURL] = true

		req, err := http.NewRequest("GET", currentSitemapURL, nil)
		if err != nil {
			return fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("User-Agent", d.userAgent)

		// Respect rate limits
		time.Sleep(1 * time.Second)

		resp, err := d.client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to fetch sitemap: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("sitemap returned status %d", resp.StatusCode)
		}

		var bodyReader io.Reader = resp.Body
		if strings.HasSuffix(currentSitemapURL, ".gz") {
			gzReader, err := gzip.NewReader(resp.Body)
			if err != nil {
				return fmt.Errorf("failed to create gzip reader: %w", err)
			}
			defer gzReader.Close()
			bodyReader = gzReader
		}

		body, err := io.ReadAll(bodyReader)
		if err != nil {
			return fmt.Errorf("failed to read sitemap body: %w", err)
		}

		// Check if it's a sitemap index
		var sitemapIndex SitemapIndex
		if err := xml.Unmarshal(body, &sitemapIndex); err == nil && len(sitemapIndex.Sitemaps) > 0 {
			for _, sitemapEntry := range sitemapIndex.Sitemaps {
				if err := discover(sitemapEntry.Loc); err != nil {
					return err
				}
				if len(allRecipeURLs) >= 1000 {
					return nil // Stop if we have enough URLs
				}
			}
			return nil
		}

		// Assume it's a regular sitemap
		var sitemap Sitemap
		if err := xml.Unmarshal(body, &sitemap); err != nil {
			return fmt.Errorf("failed to parse sitemap XML: %w", err)
		}

		// Filter for recipe URLs
		for _, url := range sitemap.URLs {
			if containsRecipeIndicator(url.Loc) {
				allRecipeURLs = append(allRecipeURLs, url.Loc)
				if len(allRecipeURLs) >= 1000 {
					return nil // Stop if we have enough URLs
				}
			}
		}
		return nil
	}

	err := discover(sitemapURL)
	return allRecipeURLs, err
}

// containsRecipeIndicator checks if URL likely points to a recipe
func containsRecipeIndicator(url string) bool {
    // Common patterns in recipe URLs
    indicators := []string{
        "/recipe/",
        "/recipes/",
        "-recipe",
        "/dish/",
        "/food/",
    }

    for _, indicator := range indicators {
        if contains(url, indicator) {
            return true
        }
    }

    return false
}

func contains(s, substr string) bool {
    return strings.Contains(s, substr)
}
