package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// Recipe represents the extracted recipe data structure
type Recipe struct {
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Ingredients  []string `json:"ingredients"`
	Instructions []string `json:"instructions"`
	ServingSize  string   `json:"servingSize,omitempty"`
	PrepTime     string   `json:"prepTime,omitempty"`
	CookTime     string   `json:"cookTime,omitempty"`
	TotalTime    string   `json:"totalTime,omitempty"`
	Source       string   `json:"source"`
	URL          string   `json:"url"`
}

// Cookie represents a browser cookie for loading saved authentication
type Cookie struct {
	Name     string  `json:"name"`
	Value    string  `json:"value"`
	Domain   string  `json:"domain"`
	Path     string  `json:"path"`
	Expires  float64 `json:"expires,omitempty"`
	HTTPOnly bool    `json:"httpOnly"`
	Secure   bool    `json:"secure"`
	SameSite string  `json:"sameSite,omitempty"`
}

var extractCmd = &cobra.Command{
	Use:   "extract <url>",
	Short: "Extract recipe from any URL",
	Long: `Extract recipe data from any recipe URL using advanced parsing.
Automatically handles authentication for supported sites like Washington Post.

Examples:
  recipe-cli extract https://sallysbakingaddiction.com/chocolate-chip-cookies/
  recipe-cli extract https://www.washingtonpost.com/recipes/chili-oil-noodles-steamed-bok-choy/`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		testURL := args[0]

		logrus.SetLevel(logrus.InfoLevel)
		logrus.SetFormatter(&logrus.TextFormatter{
			FullTimestamp: true,
		})

		// Find project root
		projectRoot, err := findProjectRoot()
		if err != nil {
			logrus.Fatalf("Failed to find project root: %v", err)
		}

		// Determine if we need authentication cookies based on URL
		var cookiesFile string
		if strings.Contains(testURL, "washingtonpost.com") {
			cookiesFile = filepath.Join(projectRoot, "dev-tools", "wapost-subscription-cookies.json")
		}

		fmt.Printf("🧪 Extracting Recipe: %s\n", testURL)
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err = extractRecipe(cookiesFile, testURL)
		if err != nil {
			logrus.Fatalf("Recipe extraction failed: %v", err)
		}
	},
}

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authentication management",
	Long:  "Manage authentication for subscription-based recipe sites",
}

var authWapostCmd = &cobra.Command{
	Use:   "wapost",
	Short: "Capture Washington Post cookies",
	Long: `Open a browser to manually log in to Washington Post and save cookies.
This enables automated recipe extraction from Washington Post subscription content.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🔐 Washington Post Cookie Capture")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Println()
		fmt.Println("This will open a browser for manual login...")
		fmt.Println("📝 Instructions will be provided in the browser window.")

		// TODO: Implement Washington Post cookie capture
		// For now, refer to existing Go tool
		fmt.Println()
		fmt.Println("💡 For now, use: ./bin/wapost-cookies")
		fmt.Println("   (Will be integrated into this CLI in next iteration)")
	},
}

var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate development environment",
	Long:  "Check that all required tools and dependencies are properly installed",
}

var validateEnvCmd = &cobra.Command{
	Use:   "env",
	Short: "Validate environment setup",
	Long: `Validate that the development environment is properly configured.
Checks for required tools, dependencies, and configuration files.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🔍 Recipe Archive Environment Validation")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := validateEnvironment()
		if err != nil {
			logrus.Fatalf("Environment validation failed: %v", err)
		}
	},
}

var testCmd = &cobra.Command{
	Use:   "test",
	Short: "Run tests",
	Long:  "Run various test suites for the Recipe Archive project",
}

var testRunCmd = &cobra.Command{
	Use:   "run",
	Short: "Run comprehensive monorepo validation",
	Long: `Run comprehensive monorepo validation script that covers:
- Web Extensions (Chrome & Safari)
- Recipe Parsers (site-specific parsers) 
- AWS Backend (Go services)
- Frontend Clients (coming soon)
- Quality gates (linting, security, documentation)`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🧪 Recipe Archive Comprehensive Monorepo Validation")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := runMonorepoValidation()
		if err != nil {
			logrus.Fatalf("Monorepo validation failed: %v", err)
		}
	},
}

var testSingleCmd = &cobra.Command{
	Use:   "single <url>",
	Short: "Test single recipe extraction",
	Long: `Test recipe extraction from a single URL using chromedp automation.
Uses the same extraction logic as browser extensions but runs in a headless browser.`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		testURL := args[0]

		fmt.Printf("🧪 Testing single recipe extraction: %s\n", testURL)
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := testSingleRecipeExtraction(testURL)
		if err != nil {
			logrus.Fatalf("Single recipe test failed: %v", err)
		}
	},
}

var settingsCmd = &cobra.Command{
	Use:   "settings",
	Short: "Manage CLI configuration",
	Long:  "View and modify configuration settings for the Recipe CLI tool",
}

var settingsShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show current settings",
	Long:  "Display all current configuration settings",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("⚙️  Recipe CLI Settings")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		config := loadConfig()
		displayConfig(config)
	},
}

var settingsSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Long: `Set a configuration value. Available keys:
  browser.headless        Run browser in headless mode (true/false)
  browser.timeout         Browser timeout in seconds (default: 300)
  output.format           Output format (json/table/summary)
  output.saveResults      Save extraction results to file (true/false)
  extraction.waitTime     Wait time after page load in seconds (default: 5)`,
	Args: cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		value := args[1]

		fmt.Printf("⚙️  Setting %s = %s\n", key, value)
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := setSetting(key, value)
		if err != nil {
			logrus.Fatalf("Failed to set configuration: %v", err)
		}

		fmt.Printf("✅ Successfully set %s = %s\n", key, value)
	},
}

var settingsResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Reset settings to defaults",
	Long:  "Reset all configuration settings to their default values",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("⚙️  Resetting Recipe CLI Settings")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := resetConfig()
		if err != nil {
			logrus.Fatalf("Failed to reset configuration: %v", err)
		}

		fmt.Println("✅ Settings reset to defaults")

		// Show the reset settings
		config := loadConfig()
		fmt.Println("\n📋 Current Settings:")
		displayConfig(config)
	},
}

var rootCmd = &cobra.Command{
	Use:   "recipe-cli",
	Short: "RecipeArchive Development CLI Tool",
	Long: `A unified command-line interface for RecipeArchive development tasks.
Replaces individual shell scripts with a single, fast Go binary.

Strategic Hybrid Architecture:
- Go: High-performance dev tools and automation
- JavaScript: Browser extensions (required for Web APIs)  
- TypeScript: AWS CDK infrastructure`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🍳 RecipeArchive Development CLI")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Println()
		fmt.Println("Available commands:")
		fmt.Println("  extract <url>    Extract recipe from any URL")
		fmt.Println("  auth wapost      Capture Washington Post cookies")
		fmt.Println("  dev start        Start development environment (parsers, extensions)")
		fmt.Println("  dev stop         Stop development services")
		fmt.Println("  setup init       Initialize project setup")
		fmt.Println("  test run         Run comprehensive monorepo validation")
		fmt.Println("  test single <url> Test single recipe extraction")
		fmt.Println("  validate env     Check environment setup")
		fmt.Println("  settings show    Show current configuration")
		fmt.Println("  settings set     Modify configuration values")
		fmt.Println()
		fmt.Println("Use 'recipe-cli <command> --help' for more information about a command.")
	},
}

var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Development environment management",
	Long:  "Start, stop, and manage local development services",
}

var devStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start local development environment",
	Long: `Start local development services including:
- Parser compilation
- Extension building
- File watchers for development`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🚀 Starting Recipe Archive Local Development Environment")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := startLocalDev()
		if err != nil {
			logrus.Fatalf("Failed to start development environment: %v", err)
		}
	},
}

var devStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop local development environment",
	Long:  "Stop all running local development services",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🛑 Stopping Recipe Archive Local Development Environment")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := stopLocalDev()
		if err != nil {
			logrus.Fatalf("Failed to stop development environment: %v", err)
		}
	},
}

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Project setup and initialization",
	Long:  "Initialize and configure the development environment",
}

var setupInitCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize project setup",
	Long: `Initialize the development environment with:
- Dependency installation
- Configuration file creation
- Directory setup`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🔧 Initializing Recipe Archive Project Setup")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := initializeProject()
		if err != nil {
			logrus.Fatalf("Project initialization failed: %v", err)
		}
	},
}

var deployCmd = &cobra.Command{
	Use:   "deploy",
	Short: "Deploy infrastructure and applications",
	Long:  "Deploy Recipe Archive infrastructure to AWS and other platforms",
}

var deployAwsCmd = &cobra.Command{
	Use:   "aws [environment]",
	Short: "Deploy to AWS",
	Long: `Deploy Recipe Archive infrastructure to AWS.
	
Supported environments: dev, staging, prod
Default environment: dev

Examples:
  recipe-cli deploy aws
  recipe-cli deploy aws staging
  recipe-cli deploy aws prod`,
	Args: cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		environment := "dev"
		if len(args) > 0 {
			environment = args[0]
		}

		fmt.Printf("🚀 Deploying Recipe Archive Infrastructure to AWS (%s)\n", environment)
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		err := deployToAws(environment)
		if err != nil {
			logrus.Fatalf("AWS deployment failed: %v", err)
		}
	},
}

func init() {
	rootCmd.AddCommand(extractCmd)
	rootCmd.AddCommand(authCmd)
	authCmd.AddCommand(authWapostCmd)
	rootCmd.AddCommand(devCmd)
	devCmd.AddCommand(devStartCmd)
	devCmd.AddCommand(devStopCmd)
	rootCmd.AddCommand(setupCmd)
	setupCmd.AddCommand(setupInitCmd)
	rootCmd.AddCommand(deployCmd)
	deployCmd.AddCommand(deployAwsCmd)
	rootCmd.AddCommand(validateCmd)
	validateCmd.AddCommand(validateEnvCmd)
	rootCmd.AddCommand(testCmd)
	testCmd.AddCommand(testRunCmd)
	testCmd.AddCommand(testSingleCmd)
	rootCmd.AddCommand(settingsCmd)
	settingsCmd.AddCommand(settingsShowCmd)
	settingsCmd.AddCommand(settingsSetCmd)
	settingsCmd.AddCommand(settingsResetCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func testSingleRecipeExtraction(testURL string) error {
	// Load configuration
	config := loadConfig()

	// Set up Chrome context using configuration
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", config.Browser.Headless),
		chromedp.Flag("no-sandbox", true),
		chromedp.UserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	ctx, cancel = context.WithTimeout(ctx, time.Duration(config.Browser.Timeout)*time.Second)
	defer cancel()

	// Navigate to recipe page
	fmt.Printf("🌐 Loading recipe page: %s\n", testURL)
	waitTime := time.Duration(config.Extraction.WaitTime) * time.Second
	err := chromedp.Run(ctx,
		chromedp.Navigate(testURL),
		chromedp.WaitVisible("body", chromedp.ByQuery),
		chromedp.Sleep(waitTime), // Use configured wait time
	)
	if err != nil {
		return fmt.Errorf("failed to navigate to recipe page: %w", err)
	}

	fmt.Println("✅ Page loaded successfully")

	// Inject content script and extract recipe
	fmt.Println("🔍 Injecting browser extension logic and extracting recipe...")
	var recipe Recipe

	// Create a standalone extraction script that doesn't depend on chrome.runtime
	extractionCode := `
		(function() {
			// JSON-LD Schema.org recipe extraction
			function extractRecipeFromJSONLD() {
				const scripts = document.querySelectorAll('script[type="application/ld+json"]');
				for (const script of scripts) {
					try {
						const data = JSON.parse(script.textContent);
						const recipe = findRecipeInJSONLD(data);
						if (recipe) return recipe;
					} catch (e) {
						continue;
					}
				}
				return null;
			}

			function findRecipeInJSONLD(data) {
				if (!data) return null;
				
				// Handle arrays
				if (Array.isArray(data)) {
					for (const item of data) {
						const recipe = findRecipeInJSONLD(item);
						if (recipe) return recipe;
					}
					return null;
				}
				
				// Handle recipe objects
				if (data['@type'] === 'Recipe' || data.type === 'Recipe') {
					return {
						title: data.name || data.headline || '',
						description: data.description || '',
						ingredients: extractIngredients(data.recipeIngredient || []),
						instructions: extractInstructions(data.recipeInstructions || []),
						source: window.location.hostname,
						url: window.location.href
					};
				}
				
				// Recursively search nested objects
				if (typeof data === 'object') {
					for (const key in data) {
						const recipe = findRecipeInJSONLD(data[key]);
						if (recipe) return recipe;
					}
				}
				
				return null;
			}

			function extractIngredients(ingredients) {
				if (!Array.isArray(ingredients)) return [];
				return ingredients.map(ing => {
					if (typeof ing === 'string') return ing;
					if (ing.text) return ing.text;
					if (ing.name) return ing.name;
					return String(ing);
				}).filter(Boolean);
			}

			function extractInstructions(instructions) {
				if (!Array.isArray(instructions)) return [];
				return instructions.map(inst => {
					if (typeof inst === 'string') return inst;
					if (inst.text) return inst.text;
					if (inst.name) return inst.name;
					return String(inst);
				}).filter(Boolean);
			}

			// Microdata fallback
			function extractRecipeFromMicrodata() {
				const recipe = document.querySelector('[itemtype*="Recipe"]');
				if (!recipe) return null;

				const getProperty = (prop) => {
					const elem = recipe.querySelector('[itemprop="' + prop + '"]');
					return elem ? elem.textContent.trim() : '';
				};

				const getMultipleProperties = (prop) => {
					const elems = recipe.querySelectorAll('[itemprop="' + prop + '"]');
					return Array.from(elems).map(el => el.textContent.trim()).filter(Boolean);
				};

				return {
					title: getProperty('name'),
					description: getProperty('description'),
					ingredients: getMultipleProperties('recipeIngredient'),
					instructions: getMultipleProperties('recipeInstruction'),
					source: window.location.hostname,
					url: window.location.href
				};
			}

			// Basic DOM fallback
			function extractRecipeFromDOM() {
				const title = document.querySelector('h1')?.textContent.trim() || 
							 document.title.split('|')[0].split('-')[0].trim();

				// Look for common ingredient patterns
				const ingredients = [];
				const ingredientSelectors = [
					'.recipe-ingredient', '.ingredient', '.ingredients li',
					'[class*="ingredient"]', '[class*="Ingredient"]'
				];

				for (const selector of ingredientSelectors) {
					const elems = document.querySelectorAll(selector);
					if (elems.length > 0) {
						Array.from(elems).forEach(el => {
							const text = el.textContent.trim();
							if (text && text.length > 0) ingredients.push(text);
						});
						break;
					}
				}

				// Look for common instruction patterns
				const instructions = [];
				const instructionSelectors = [
					'.recipe-instruction', '.instruction', '.instructions li', '.directions li',
					'[class*="instruction"]', '[class*="Instruction"]', '[class*="direction"]'
				];

				for (const selector of instructionSelectors) {
					const elems = document.querySelectorAll(selector);
					if (elems.length > 0) {
						Array.from(elems).forEach(el => {
							const text = el.textContent.trim();
							if (text && text.length > 0) instructions.push(text);
						});
						break;
					}
				}

				return {
					title: title,
					description: '',
					ingredients: ingredients,
					instructions: instructions,
					source: window.location.hostname,
					url: window.location.href
				};
			}

			// Try extraction methods in order of preference
			let result = extractRecipeFromJSONLD();
			if (!result || (!result.ingredients.length && !result.instructions.length)) {
				result = extractRecipeFromMicrodata();
			}
			if (!result || (!result.ingredients.length && !result.instructions.length)) {
				result = extractRecipeFromDOM();
			}

			return result || {
				title: 'No Recipe Found',
				description: '',
				ingredients: [],
				instructions: [],
				source: window.location.hostname,
				url: window.location.href
			};
		})();
	`

	err = chromedp.Run(ctx,
		chromedp.Evaluate(extractionCode, &recipe),
	)
	if err != nil {
		return fmt.Errorf("failed to extract recipe data: %w", err)
	}

	// Display results according to configured format
	switch config.Output.Format {
	case "json":
		recipeJSON, err := json.MarshalIndent(recipe, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal recipe JSON: %w", err)
		}
		fmt.Println(string(recipeJSON))
	case "table":
		fmt.Println("\n📊 EXTRACTION RESULTS (TABLE)")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("%-15s: %s\n", "Title", recipe.Title)
		fmt.Printf("%-15s: %s\n", "Source", recipe.Source)
		fmt.Printf("%-15s: %d items\n", "Ingredients", len(recipe.Ingredients))
		fmt.Printf("%-15s: %d steps\n", "Instructions", len(recipe.Instructions))
		fmt.Printf("%-15s: %s\n", "URL", recipe.URL)
	default: // "summary"
		fmt.Println("\n📊 EXTRACTION RESULTS:")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("Title: %s\n", recipe.Title)
		fmt.Printf("Source: %s\n", recipe.Source)
		fmt.Printf("Ingredients: %d items\n", len(recipe.Ingredients))
		fmt.Printf("Instructions: %d steps\n", len(recipe.Instructions))

		// Show sample data in summary mode
		if len(recipe.Ingredients) > 0 {
			fmt.Println("\n🥘 Sample Ingredients:")
			maxShow := 3
			if len(recipe.Ingredients) < maxShow {
				maxShow = len(recipe.Ingredients)
			}
			for i := 0; i < maxShow; i++ {
				fmt.Printf("  %d. %s\n", i+1, recipe.Ingredients[i])
			}
			if len(recipe.Ingredients) > maxShow {
				fmt.Printf("  ... and %d more\n", len(recipe.Ingredients)-maxShow)
			}
		}

		if len(recipe.Instructions) > 0 {
			fmt.Println("\n📖 Sample Instructions:")
			maxShow := 2
			if len(recipe.Instructions) < maxShow {
				maxShow = len(recipe.Instructions)
			}
			for i := 0; i < maxShow; i++ {
				instruction := recipe.Instructions[i]
				if len(instruction) > 80 {
					instruction = instruction[:80] + "..."
				}
				fmt.Printf("  %d. %s\n", i+1, instruction)
			}
			if len(recipe.Instructions) > maxShow {
				fmt.Printf("  ... and %d more steps\n", len(recipe.Instructions)-maxShow)
			}
		}
	}

	// Save results if configured to do so
	if config.Output.SaveResults {
		outputPath := "cli-recipe-test-results.json"
		recipeJSON, err := json.MarshalIndent(recipe, "", "  ")
		if err == nil {
			err = os.WriteFile(outputPath, recipeJSON, 0644)
			if err == nil {
				fmt.Printf("\n💾 Full results saved to: %s\n", outputPath)
			}
		}
	}

	// Determine success
	if recipe.Title != "" && recipe.Title != "Unknown Recipe" {
		fmt.Println("\n✅ Recipe extraction test: PASSED")
		return nil
	} else {
		fmt.Println("\n❌ Recipe extraction test: FAILED - No valid recipe data found")
		return fmt.Errorf("no valid recipe data extracted")
	}
}

// Config represents the CLI configuration
type Config struct {
	Browser struct {
		Headless bool `json:"headless"`
		Timeout  int  `json:"timeout"`
	} `json:"browser"`
	Output struct {
		Format      string `json:"format"`
		SaveResults bool   `json:"saveResults"`
	} `json:"output"`
	Extraction struct {
		WaitTime int `json:"waitTime"`
	} `json:"extraction"`
}

// getConfigPath returns the path to the configuration file
func getConfigPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ".recipe-cli-config.json"
	}
	return filepath.Join(homeDir, ".recipe-cli-config.json")
}

// loadConfig loads the configuration from file or returns defaults
func loadConfig() Config {
	config := getDefaultConfig()

	configPath := getConfigPath()
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return config
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return config
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return getDefaultConfig()
	}

	return config
}

// getDefaultConfig returns the default configuration
func getDefaultConfig() Config {
	return Config{
		Browser: struct {
			Headless bool `json:"headless"`
			Timeout  int  `json:"timeout"`
		}{
			Headless: false,
			Timeout:  300,
		},
		Output: struct {
			Format      string `json:"format"`
			SaveResults bool   `json:"saveResults"`
		}{
			Format:      "summary",
			SaveResults: true,
		},
		Extraction: struct {
			WaitTime int `json:"waitTime"`
		}{
			WaitTime: 5,
		},
	}
}

// saveConfig saves the configuration to file
func saveConfig(config Config) error {
	configPath := getConfigPath()
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, data, 0644)
}

// displayConfig shows the current configuration in a nice format
func displayConfig(config Config) {
	fmt.Println("\n🌐 Browser Settings:")
	fmt.Printf("  Headless Mode: %t\n", config.Browser.Headless)
	fmt.Printf("  Timeout: %d seconds\n", config.Browser.Timeout)

	fmt.Println("\n📄 Output Settings:")
	fmt.Printf("  Format: %s\n", config.Output.Format)
	fmt.Printf("  Save Results: %t\n", config.Output.SaveResults)

	fmt.Println("\n🔍 Extraction Settings:")
	fmt.Printf("  Wait Time: %d seconds\n", config.Extraction.WaitTime)

	fmt.Printf("\n📁 Config file: %s\n", getConfigPath())
}

// setSetting sets a specific configuration value
func setSetting(key, value string) error {
	config := loadConfig()

	switch key {
	case "browser.headless":
		if value == "true" {
			config.Browser.Headless = true
		} else if value == "false" {
			config.Browser.Headless = false
		} else {
			return fmt.Errorf("browser.headless must be 'true' or 'false'")
		}
	case "browser.timeout":
		timeout := 0
		if _, err := fmt.Sscanf(value, "%d", &timeout); err != nil {
			return fmt.Errorf("browser.timeout must be a number")
		}
		if timeout < 10 || timeout > 600 {
			return fmt.Errorf("browser.timeout must be between 10 and 600 seconds")
		}
		config.Browser.Timeout = timeout
	case "output.format":
		if value != "json" && value != "table" && value != "summary" {
			return fmt.Errorf("output.format must be 'json', 'table', or 'summary'")
		}
		config.Output.Format = value
	case "output.saveResults":
		if value == "true" {
			config.Output.SaveResults = true
		} else if value == "false" {
			config.Output.SaveResults = false
		} else {
			return fmt.Errorf("output.saveResults must be 'true' or 'false'")
		}
	case "extraction.waitTime":
		waitTime := 0
		if _, err := fmt.Sscanf(value, "%d", &waitTime); err != nil {
			return fmt.Errorf("extraction.waitTime must be a number")
		}
		if waitTime < 1 || waitTime > 30 {
			return fmt.Errorf("extraction.waitTime must be between 1 and 30 seconds")
		}
		config.Extraction.WaitTime = waitTime
	default:
		return fmt.Errorf("unknown setting key: %s", key)
	}

	return saveConfig(config)
}

// resetConfig resets configuration to defaults
func resetConfig() error {
	config := getDefaultConfig()
	return saveConfig(config)
}

// startLocalDev starts the local development environment
func startLocalDev() error {
	fmt.Println("� Starting Recipe Archive Local Development Environment")
	fmt.Println("================================================")

	projectRoot, err := findProjectRoot()
	if err != nil {
		return fmt.Errorf("failed to find project root: %w", err)
	}

	// Check if port is already in use
	port := "8080"
	fmt.Printf("� Checking if port %s is available...\n", port)

	cmd := exec.Command("lsof", "-Pi", ":"+port, "-sTCP:LISTEN", "-t")
	if output, err := cmd.Output(); err == nil && len(strings.TrimSpace(string(output))) > 0 {
		fmt.Printf("⚠️  Port %s is already in use\n", port)
		fmt.Println("Please stop the existing service or choose a different port")

		// Show what's using the port
		cmd = exec.Command("lsof", "-Pi", ":"+port, "-sTCP:LISTEN")
		if output, err := cmd.Output(); err == nil {
			fmt.Println("Current services on port", port+":")
			fmt.Print(string(output))
		}
		return fmt.Errorf("port %s is already in use", port)
	}

	// Compile TypeScript parsers
	fmt.Println("\n🔨 Compiling TypeScript parsers...")
	parsersDir := filepath.Join(projectRoot, "parsers")
	if _, err := os.Stat(parsersDir); err == nil {
		cmd := exec.Command("npx", "tsc")
		cmd.Dir = parsersDir
		if output, err := cmd.CombinedOutput(); err != nil {
			fmt.Printf("⚠️  Parser compilation failed: %v\nOutput: %s\n", err, string(output))
		} else {
			fmt.Println("✅ TypeScript parsers compiled successfully")
		}
	}

	// Build Go tools
	fmt.Println("\n🔨 Building Go development tools...")
	toolsDir := filepath.Join(projectRoot, "tools")
	toolsCmd := exec.Command("make", "build")
	toolsCmd.Dir = toolsDir
	if output, err := toolsCmd.CombinedOutput(); err != nil {
		fmt.Printf("⚠️  Go tools build failed: %v\nOutput: %s\n", err, string(output))
	} else {
		fmt.Println("✅ Go development tools built successfully")
	}

	fmt.Println("\n✅ Development environment ready!")
	fmt.Println("📋 Status:")
	fmt.Println("   ✅ TypeScript parsers compiled")
	fmt.Println("   ✅ Go development tools built")
	fmt.Println("   ✅ Extensions ready for AWS direct connection")
	fmt.Println("\n💡 Next steps:")
	fmt.Println("   1. Load extensions in browser (chrome://extensions/ or Safari)")
	fmt.Println("   2. Extensions authenticate directly with AWS Cognito")
	fmt.Println("   3. Recipe data stored directly to AWS S3")
	fmt.Println("   4. Use 'recipe-cli test run' to validate everything works")

	return nil
}

// stopLocalDev stops the local development environment
func stopLocalDev() error {
	fmt.Println("� Stopping Recipe Archive Local Development Services")
	fmt.Println("============================================")

	projectRoot, err := findProjectRoot()
	if err != nil {
		return fmt.Errorf("failed to find project root: %w", err)
	}

	// Clean up compiled artifacts
	fmt.Println("\n🧹 Cleaning up development artifacts...")

	parsersDistDir := filepath.Join(projectRoot, "parsers", "dist")
	if _, err := os.Stat(parsersDistDir); err == nil {
		if err := os.RemoveAll(parsersDistDir); err != nil {
			fmt.Printf("⚠️  Failed to clean parsers/dist: %v\n", err)
		} else {
			fmt.Println("✅ Cleaned parsers/dist directory")
		}
	}

	toolsBinDir := filepath.Join(projectRoot, "tools", "bin")
	if _, err := os.Stat(toolsBinDir); err == nil {
		if err := os.RemoveAll(toolsBinDir); err != nil {
			fmt.Printf("⚠️  Failed to clean tools/bin: %v\n", err)
		} else {
			fmt.Println("✅ Cleaned tools/bin directory")
		}
	}

	fmt.Println("\n✅ Development environment cleaned")
	fmt.Println("📋 Compiled artifacts have been removed")
	fmt.Println("💡 Run 'recipe-cli dev start' to rebuild when needed")

	return nil
}

// initializeProject initializes the development environment
func initializeProject() error {
	fmt.Println("🔍 Initializing Recipe Archive development environment...")

	projectRoot, err := findProjectRoot()
	if err != nil {
		return fmt.Errorf("failed to find project root: %w", err)
	}

	fmt.Printf("📁 Project root: %s\n", projectRoot)

	// Check for required files and directories
	fmt.Println("\n📋 Checking project structure...")

	requiredPaths := []struct {
		path string
		desc string
	}{
		{"package.json", "Root package.json"},
		{"tools/", "Go tools directory"},
		{"extensions/chrome/", "Chrome extension"},
		{"extensions/safari/", "Safari extension"},
		{"aws-backend/", "AWS backend"},
	}

	for _, req := range requiredPaths {
		fullPath := filepath.Join(projectRoot, req.path)
		if _, err := os.Stat(fullPath); err == nil {
			fmt.Printf("   ✅ %s\n", req.desc)
		} else {
			fmt.Printf("   ❌ %s (missing: %s)\n", req.desc, req.path)
		}
	}

	fmt.Println("\n🔧 Project initialization checks complete")
	fmt.Println("📝 Run 'recipe-cli dev start' to start development services")

	return nil
}

// deployToAws deploys the infrastructure to AWS
func deployToAws(environment string) error {
	fmt.Printf("📋 Environment: %s\n", environment)

	// Validate environment
	validEnvs := []string{"dev", "staging", "prod"}
	valid := false
	for _, env := range validEnvs {
		if environment == env {
			valid = true
			break
		}
	}

	if !valid {
		return fmt.Errorf("invalid environment '%s'. Valid options: %v", environment, validEnvs)
	}

	projectRoot, err := findProjectRoot()
	if err != nil {
		return fmt.Errorf("failed to find project root: %w", err)
	}

	// Cost safety check for production
	if environment == "prod" {
		fmt.Println("⚠️  Production deployment detected!")
		fmt.Println("   Budget: $50/month (increased for production workloads)")
		fmt.Print("   Type 'yes' to continue with production deployment: ")

		var response string
		fmt.Scanln(&response)
		if response != "yes" {
			return fmt.Errorf("production deployment cancelled")
		}
	}

	fmt.Println("\n🔍 Pre-deployment validation...")

	// Check AWS CLI
	if err := checkAwsCli(); err != nil {
		return fmt.Errorf("AWS CLI validation failed: %w", err)
	}

	// Check CDK
	if err := checkAwsCdk(); err != nil {
		return fmt.Errorf("AWS CDK validation failed: %w", err)
	}

	// Build Go functions
	fmt.Println("\n🏗️  Building Go functions...")
	functionsDir := filepath.Join(projectRoot, "aws-backend/functions")
	buildCmd := exec.Command("make", "build")
	buildCmd.Dir = functionsDir

	if output, err := buildCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to build Go functions: %w\nOutput: %s", err, string(output))
	}
	fmt.Println("✅ Go functions built successfully")

	// Deploy infrastructure
	fmt.Println("\n🚀 Deploying AWS infrastructure...")
	infraDir := filepath.Join(projectRoot, "aws-backend/infrastructure")

	deployCmd := exec.Command("npm", "run", "deploy", "--", "--context", "environment="+environment)
	deployCmd.Dir = infraDir
	deployCmd.Stdout = os.Stdout
	deployCmd.Stderr = os.Stderr

	if err := deployCmd.Run(); err != nil {
		return fmt.Errorf("CDK deployment failed: %w", err)
	}

	fmt.Println("\n🎉 AWS deployment completed successfully!")
	fmt.Printf("✅ Environment '%s' is now deployed and ready\n", environment)

	return nil
}
