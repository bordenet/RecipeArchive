package updater

import (
    "fmt"
    "os"
    "regexp"
    "strings"
)

// CatalogUpdater updates the E2E test catalog with new URLs
type CatalogUpdater struct {
    testFilePath string
}

// NewCatalogUpdater creates a new catalog updater
func NewCatalogUpdater(testFilePath string) *CatalogUpdater {
    return &CatalogUpdater{
        testFilePath: testFilePath,
    }
}

// UpdateURL updates a specific site's URL in the test catalog
func (u *CatalogUpdater) UpdateURL(siteName, oldURL, newURL string) error {
	// Create a backup
	backupPath := u.testFilePath + ".bak"
	input, err := os.ReadFile(u.testFilePath)
	if err != nil {
		return fmt.Errorf("failed to read test file: %w", err)
	}

	if err := os.WriteFile(backupPath, input, 0644); err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	lines := strings.Split(string(input), "\n")
	var siteBlockIndex = -1

	for i, line := range lines {
		if strings.Contains(line, fmt.Sprintf(`site: "%s"`, siteName)) {
			siteBlockIndex = i
			break
		}
	}

	if siteBlockIndex != -1 {
		urlPattern := regexp.MustCompile(`url: "(.+)"`)
		for i := siteBlockIndex; i < len(lines) && i < siteBlockIndex+5; i++ {
			if urlPattern.MatchString(lines[i]) {
				lines[i] = urlPattern.ReplaceAllString(lines[i], fmt.Sprintf(`url: "%s"`, newURL))
				break
			}
		}
	}

	// Write back to file
	content := strings.Join(lines, "\n")
	if err := os.WriteFile(u.testFilePath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write test file: %w", err)
	}

	fmt.Printf("✅ Updated %s: %s -> %s\n", siteName, oldURL, newURL)
	return nil
}

// UpdateMultipleURLs updates multiple sites at once
func (u *CatalogUpdater) UpdateMultipleURLs(updates map[string]string) error {
    for siteName, newURL := range updates {
        // Note: We don't have oldURL here, so we need to find it differently
        // This is a simplified version - you'll need to enhance this
        if err := u.UpdateURL(siteName, "", newURL); err != nil {
            return err
        }
    }
    return nil
}
