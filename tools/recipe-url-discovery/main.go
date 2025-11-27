package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/gemini-cli/recipe-url-discovery/discoverers"
	"github.com/gemini-cli/recipe-url-discovery/updater"
	"github.com/gemini-cli/recipe-url-discovery/validators"
	"gopkg.in/yaml.v3"
)

var logger *slog.Logger

func init() {
	// Text handler for CLI tools (human-readable)
	logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
}

// Config structs from config.yaml
type Config struct {
	Sites          map[string]SiteConfig `yaml:"sites"`
	QualityScoring QualityScoring        `yaml:"qualityScoring"`
	RateLimiting   RateLimiting          `yaml:"rateLimiting"`
}

type SiteConfig struct {
	Domain          string `yaml:"domain"`
	SitemapURL      string `yaml:"sitemapUrl"`
	ParserName      string `yaml:"parserName"`
	MinIngredients  int    `yaml:"minIngredients"`
	MinInstructions int    `yaml:"minInstructions"`
	CurrentTestURL  string `yaml:"currentTestUrl"`
	Status          string `yaml:"status"`
	Issue           string `yaml:"issue,omitempty"`
}

type QualityScoring struct {
	HasTitle               int `yaml:"hasTitle"`
	HasIngredients         int `yaml:"hasIngredients"`
	HasInstructions        int `yaml:"hasInstructions"`
	HasImage               int `yaml:"hasImage"`
	HasTimings             int `yaml:"hasTimings"`
	IngredientCountWeight  int `yaml:"ingredientCountWeight"`
	InstructionCountWeight int `yaml:"instructionCountWeight"`
	MinQualityScore        int `yaml:"minQualityScore"`
}

type RateLimiting struct {
	RequestsPerSecond int    `yaml:"requestsPerSecond"`
	DelayBetweenSites int    `yaml:"delayBetweenSites"`
	RespectRobotsTxt  bool   `yaml:"respectRobotsTxt"`
	UserAgent         string `yaml:"userAgent"`
}

func main() {
	// CLI flags
	discoverAll := flag.Bool("discover-all", false, "Discover recipes for all sites")
	site := flag.String("site", "", "Discover recipes for specific site (e.g., 'epicurious')")
	validateCatalog := flag.Bool("validate-catalog", false, "Validate existing test URLs")
	updateTests := flag.Bool("update-tests", false, "Update E2E test catalog with best URLs")
	maxURLs := flag.Int("max-urls", 50, "Maximum URLs to test per site")

	flag.Parse()

	// Get project root (tool is in tools/recipe-url-discovery)
	projectRoot, err := filepath.Abs("../..")
	if err != nil {
		logger.Error("failed to get project root", "error", err)
		os.Exit(1)
	}

	parserBundlePath := filepath.Join(projectRoot, "extensions/chrome/typescript-parser-bundle.js")
	testFilePath := filepath.Join(projectRoot, "tests/e2e/parser-regression-suite.test.js")
	configPath := filepath.Join(".", "config.yaml")

	// Load config
	config, err := loadConfig(configPath)
	if err != nil {
		logger.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Create components
	discoverer := discoverers.NewSitemapDiscoverer(config.RateLimiting.UserAgent)
	validator := validators.NewRecipeValidator(parserBundlePath)
	catalogUpdater := updater.NewCatalogUpdater(testFilePath)

	if *validateCatalog {
		fmt.Println("✅ Validating existing test catalog URLs...")
		validateExistingCatalog(config, validator)
	} else if *site != "" {
		fmt.Printf("🔍 Discovering recipes for %s...\n", *site)
		discoverForSite(*site, config, discoverer, validator, *maxURLs)
	} else if *discoverAll {
		fmt.Println("🔍 Discovering recipes for all sites...")
		discoverAllSites(config, discoverer, validator, *maxURLs)
	} else if *updateTests {
		fmt.Println("📝 Updating E2E test catalog...")
		updateTestCatalog(config, catalogUpdater)
	} else {
		flag.Usage()
		os.Exit(1)
	}
}

func discoverForSite(siteName string, config *Config, discoverer *discoverers.SitemapDiscoverer,
	validator *validators.RecipeValidator, maxURLs int) {
	siteConfig, ok := config.Sites[siteName]
	if !ok {
		logger.Error("site not found in config", "site", siteName)
		os.Exit(1)
	}

	fmt.Printf("📡 Fetching sitemap from %s...\n", siteConfig.SitemapURL)
	urls, err := discoverer.DiscoverURLs(siteConfig.SitemapURL, siteConfig.Domain)
	if err != nil {
		logger.Error("failed to discover URLs", "error", err)
		os.Exit(1)
	}

	fmt.Printf("Found %d potential recipe URLs\n", len(urls))

	if len(urls) > maxURLs {
		urls = urls[:maxURLs]
		fmt.Printf("Limiting to %d URLs for testing\n", maxURLs)
	}

	// Validate each URL
	var bestResult *validators.ValidationResult
	for i, url := range urls {
		fmt.Printf("Testing %d/%d: %s\n", i+1, len(urls), url)

		result, err := validator.ValidateURL(url, siteConfig.MinIngredients, siteConfig.MinInstructions)
		if err != nil {
			fmt.Printf("  ❌ Error: %v\n", err)
			continue
		}

		if result.IsValid {
			fmt.Printf("  ✅ Valid! Score: %d, Ingredients: %d, Instructions: %d\n",
				result.QualityScore,
				len(result.Recipe.Ingredients),
				len(result.Recipe.Instructions))

			if bestResult == nil || result.QualityScore > bestResult.QualityScore {
				bestResult = result
			}
		} else {
			fmt.Printf("  ❌ Invalid: %s\n", result.ErrorMessage)
		}
	}

	if bestResult != nil {
		fmt.Printf("\n🎯 Best URL found:\n")
		fmt.Printf("  URL: %s\n", bestResult.URL)
		fmt.Printf("  Title: %s\n", bestResult.Recipe.Title)
		fmt.Printf("  Quality Score: %d/100\n", bestResult.QualityScore)
		fmt.Printf("  Ingredients: %d\n", len(bestResult.Recipe.Ingredients))
		fmt.Printf("  Instructions: %d\n", len(bestResult.Recipe.Instructions))

		// Save to cache
		saveToCacheFile(siteName, bestResult)
	} else {
		fmt.Printf("\n❌ No valid URLs found for %s\n", siteName)
	}
}

func discoverAllSites(config *Config, discoverer *discoverers.SitemapDiscoverer, validator *validators.RecipeValidator, maxURLs int) {
	for siteName := range config.Sites {
		discoverForSite(siteName, config, discoverer, validator, maxURLs)
	}
}

func validateExistingCatalog(config *Config, validator *validators.RecipeValidator) {
	for siteName, siteConfig := range config.Sites {
		fmt.Printf("Validating %s: %s\n", siteName, siteConfig.CurrentTestURL)
		result, err := validator.ValidateURL(siteConfig.CurrentTestURL, siteConfig.MinIngredients, siteConfig.MinInstructions)
		if err != nil {
			fmt.Printf("  ❌ Error: %v\n", err)
			continue
		}
		if result.IsValid {
			fmt.Printf("  ✅ Valid!\n")
		} else {
			fmt.Printf("  ❌ Invalid: %s\n", result.ErrorMessage)
		}
	}
}

func updateTestCatalog(config *Config, catalogUpdater *updater.CatalogUpdater) {
	for siteName, siteConfig := range config.Sites {
		if siteConfig.Status == "failing" {
			cachePath := filepath.Join("cache", fmt.Sprintf("%s.json", siteName))
			if _, err := os.Stat(cachePath); os.IsNotExist(err) {
				logger.Info("no cache file found, skipping update - run discovery first", "site", siteName)
				continue
			}

			data, err := os.ReadFile(cachePath)
			if err != nil {
				logger.Error("failed to read cache file", "site", siteName, "error", err)
				continue
			}

			var result validators.ValidationResult
			if err := json.Unmarshal(data, &result); err != nil {
				logger.Error("failed to parse cache file", "site", siteName, "error", err)
				continue
			}

			if result.IsValid {
				if err := catalogUpdater.UpdateURL(siteName, siteConfig.CurrentTestURL, result.URL); err != nil {
					logger.Error("failed to update test catalog", "site", siteName, "error", err)
				}
			} else {
				logger.Info("cached result not valid, skipping update", "site", siteName)
			}
		}
	}
}

func loadConfig(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config YAML: %w", err)
	}

	return &config, nil
}

func saveToCacheFile(siteName string, result *validators.ValidationResult) {
	// Create cache directory if it doesn't exist
	if _, err := os.Stat("cache"); os.IsNotExist(err) {
		_ = os.Mkdir("cache", 0755)
	}

	filePath := filepath.Join("cache", fmt.Sprintf("%s.json", siteName))
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		logger.Error("failed to marshal cache data", "site", siteName, "error", err)
		return
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		logger.Error("failed to write cache file", "site", siteName, "error", err)
	}
}
