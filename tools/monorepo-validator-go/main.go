package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
)

func printUsage() {
	fmt.Printf(`🔧 RECIPEARCHIVE MONOREPO VALIDATOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 USAGE: ./monorepo-validator-go [options]

🎯 VALIDATION TIERS:
┌─────────────┬──────────┬─────────────────────────────────────────────────────────────┐
│ FLAG        │ TIME     │ DESCRIPTION & BEST USE CASE                                │
├─────────────┼──────────┼─────────────────────────────────────────────────────────────┤
│ -p1         │ 30-60s   │ 🚀 P1/Essential: Prerequisites + core builds + security    │
│             │          │    Best for: Quick commits, development workflow           │
├─────────────┼──────────┼─────────────────────────────────────────────────────────────┤
│ -med        │ 2-3min   │ 📊 Medium/Standard [DEFAULT]: P1 + integration tests       │
│             │          │    Best for: Pull requests, pre-deployment validation     │
├─────────────┼──────────┼─────────────────────────────────────────────────────────────┤
│ -all        │ 5-10min  │ 🔍 All/Comprehensive: Medium + AWS + mobile + extensions   │
│             │          │    Best for: Release validation, comprehensive audits     │
└─────────────┴──────────┴─────────────────────────────────────────────────────────────┘

🏗️  SPECIALIZED VALIDATIONS:
┌──────────────────┬──────────┬─────────────────────────────────────────────────────────┐
│ FLAG             │ TIME     │ DESCRIPTION & BEST USE CASE                            │
├──────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ -infra           │ 2-3min   │ ☁️  AWS Infrastructure: Multi-tenant + S3 + diagnostics │
│                  │          │    Best for: Infrastructure validation, AWS connectivity│
├──────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ -mobile          │ 3-5min   │ 📱 Mobile + Web: iOS/Android/Web builds + lint         │
│                  │          │    Best for: Mobile development, app store preparation │
├──────────────────┼──────────┼─────────────────────────────────────────────────────────┤
│ -tools           │ 2-4min   │ 🔧 Go Tools: Build, test, lint, and run all Go tools  │
│                  │          │    Best for: Tools development, CLI validation         │
└──────────────────┴──────────┴─────────────────────────────────────────────────────────┘

🔧 EXECUTION OPTIONS:
┌─────────────┬─────────────────────────────────────────────────────────────────────┐
│ FLAG        │ DESCRIPTION                                                         │
├─────────────┼─────────────────────────────────────────────────────────────────────┤
│ -sequential │ 🔄 Run validations sequentially (default: parallel)               │
├─────────────┼─────────────────────────────────────────────────────────────────────┤
│ -verbose    │ 📝 Enable detailed output and progress logging                     │
└─────────────┴─────────────────────────────────────────────────────────────────────┘

🌟 COMMON EXAMPLES:
┌─────────────────────────────────────────┬─────────────────────────────────────────┐
│ COMMAND                                 │ USE CASE                                │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ ./monorepo-validator-go                 │ Standard validation (medium tier)      │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ ./monorepo-validator-go -p1             │ Quick commit validation                 │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ ./monorepo-validator-go -all            │ Pre-release comprehensive check        │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ ./monorepo-validator-go -infra          │ AWS infrastructure troubleshooting     │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ ./monorepo-validator-go -mobile         │ Mobile development validation          │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ ./monorepo-validator-go -all -verbose   │ Full validation with detailed logs     │
└─────────────────────────────────────────┴─────────────────────────────────────────┘

🚀 INTEGRATION WORKFLOW:
┌─────────────────────────┬─────────────────────────────────────────────────────────────┐
│ CONTEXT                 │ RECOMMENDED TIER                                           │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Husky pre-commit hook   │ -p1 (fast feedback)                                       │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ GitHub Actions CI       │ -med (standard validation)                                │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Release pipeline        │ -all (comprehensive validation)                           │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ AWS troubleshooting     │ -infra (infrastructure focus)                             │
├─────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Mobile development      │ -mobile (platform-specific validation)                   │
└─────────────────────────┴─────────────────────────────────────────────────────────────┘

🔒 ALWAYS ENABLED: Security scanning • Code linting • Dependency validation

`)
}

func main() {
	// Custom help handling
	helpFlag := flag.Bool("help", false, "Show help message")

	// Define command-line flags
	infraFlag := flag.Bool("infra", false, "Run only AWS infrastructure validations")
	allFlag := flag.Bool("all", false, "Run all validations including infrastructure and mobile")
	p1Flag := flag.Bool("p1", false, "Run Phase 1 validations (prerequisites, dependencies, builds)")
	medFlag := flag.Bool("med", false, "Run medium scope validations (p1 + tests + linting)")
	mobileFlag := flag.Bool("mobile", false, "Run mobile app validations (Android/iOS build readiness)")
	toolsFlag := flag.Bool("tools", false, "Run Go tools build, test, and execution validation")
	sequentialFlag := flag.Bool("sequential", false, "Run validations sequentially (default is parallel)")
	verboseFlag := flag.Bool("verbose", false, "Enable verbose output")

	// Set custom usage function
	flag.Usage = printUsage
	flag.Parse()

	// Handle help flag
	if *helpFlag {
		printUsage()
		os.Exit(0)
	}

	// Set up signal handling for clean exits
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	// Initialize the Validator
	validator := NewValidator()

	if *verboseFlag {
		fmt.Println("🔧 RecipeArchive Monorepo Validator")
		fmt.Println("====================================")
	}

	// Get projectRoot from environment or find git root
	projectRoot := os.Getenv("PROJECT_ROOT")
	if projectRoot == "" {
		var err error
		projectRoot, err = findGitRoot()
		if err != nil {
			fmt.Printf("❌ Error finding project root: %v\n", err)
			os.Exit(1)
		}
	}

	if *verboseFlag {
		fmt.Printf("📁 Project root: %s\n\n", projectRoot)
	}

	// Set up graceful shutdown
	go func() {
		<-c
		fmt.Printf("\n\n🛑 Interrupted! Cleaning up...\n")
		validator.PrintSummary()
		os.Exit(1)
	}()

	// Always run prerequisites first
	if !validator.RunValidation("Prerequisite Checks", validatePrerequisites, projectRoot) {
		cleanExit(validator, 1)
	}

	// Determine which validations to run based on flags
	var validations []ValidationTask

	if *infraFlag {
		validations = getInfraValidations()
	} else if *p1Flag {
		validations = getP1Validations()
	} else if *medFlag {
		validations = getMediumValidations()
	} else if *mobileFlag {
		validations = getMobileValidations()
	} else if *toolsFlag {
		validations = getToolsValidations()
	} else if *allFlag {
		validations = getAllValidations()
	} else {
		// Default: run medium validations
		validations = getMediumValidations()
	}

	// Run validations (parallel by default for multiple validations)
	useParallel := len(validations) > 1 && !*sequentialFlag

	if *verboseFlag && useParallel {
		fmt.Printf("🚀 Running %d validations in parallel for faster execution\n\n", len(validations))
	}

	if useParallel {
		runValidationsParallel(validator, validations, projectRoot, *verboseFlag)
	} else {
		runValidationsSequential(validator, validations, projectRoot)
	}

	// Print the summary and exit
	cleanExit(validator, getExitCode(validator))
}

// ValidationTask represents a validation function with metadata
type ValidationTask struct {
	Name     string
	Function func(string) bool
	Parallel bool // Whether this task can run in parallel with others
}

// cleanExit ensures terminal is always left in a good state
func cleanExit(validator *Validator, exitCode int) {
	validator.PrintSummary()
	if exitCode != 0 {
		fmt.Printf("\n💥 Validation failed with exit code %d\n", exitCode)
	} else {
		fmt.Printf("\n✅ All validations passed!\n")
	}
	os.Exit(exitCode)
}

// getExitCode determines exit code based on validation results
func getExitCode(validator *Validator) int {
	for _, result := range validator.Results {
		if !result.Success {
			return 1
		}
	}
	return 0
}

// runValidationsSequential runs validations one after another
func runValidationsSequential(validator *Validator, validations []ValidationTask, projectRoot string) {
	for _, validation := range validations {
		if !validator.RunValidation(validation.Name, validation.Function, projectRoot) {
			return // Stop on first failure
		}
	}
}

// runValidationsParallel runs parallelizable validations concurrently with clean output
func runValidationsParallel(validator *Validator, validations []ValidationTask, projectRoot string, _ bool) {
	// Separate parallel and sequential validations
	var parallelValidations []ValidationTask
	var sequentialValidations []ValidationTask

	for _, validation := range validations {
		if validation.Parallel {
			parallelValidations = append(parallelValidations, validation)
		} else {
			sequentialValidations = append(sequentialValidations, validation)
		}
	}

	// Run sequential validations first (dependencies, prerequisites)
	for _, validation := range sequentialValidations {
		if !validator.RunValidation(validation.Name, validation.Function, projectRoot) {
			return // Stop on first failure
		}
	}

	// Run parallel validations concurrently if any exist
	if len(parallelValidations) > 0 {
		var wg sync.WaitGroup
		resultChan := make(chan ValidationResult, len(parallelValidations))

		for _, validation := range parallelValidations {
			wg.Add(1)
			go func(v ValidationTask) {
				defer wg.Done()

				// Run validation and capture result without printing
				result := validator.RunValidationSilent(v.Name, v.Function, projectRoot)
				resultChan <- result
			}(validation)
		}

		// Wait for all parallel validations to complete
		wg.Wait()
		close(resultChan)

		// Process results in order and print them cleanly
		for result := range resultChan {
			validator.AddResult(result)
		}
	}
}

// getInfraValidations returns infrastructure-only validations
func getInfraValidations() []ValidationTask {
	return []ValidationTask{
		{"AWS Infrastructure Tests", runAwsInfrastructureTests, false},
		{"Validate Deployment Infrastructure", validateDeploymentInfrastructure, false},
	}
}

// getP1Validations returns Phase 1 validations (prerequisites, deps, builds)
func getP1Validations() []ValidationTask {
	return []ValidationTask{
		{"Install Dependencies", installDependencies, false},
		{"Build Go Binaries", buildGoBinaries, true},
		{"Build TypeScript", buildTypeScript, true},
		{"Build Script Syntax Check", runBuildScriptSyntaxValidation, true}, // Fast syntax validation
	}
}

// getMediumValidations returns medium scope validations (p1 + tests + linting)
func getMediumValidations() []ValidationTask {
	validations := getP1Validations()
	validations = append(validations,
		ValidationTask{"Run Integration Tests", runIntegrationTests, true},
		ValidationTask{"Run Security Scan", runSecurityScan, true},
		ValidationTask{"Run Quality Gate", runQualityGate, true},
		ValidationTask{"Run Linting Checks", runLintingChecks, true},
		ValidationTask{"Run Basic Quality Checks", runBasicQualityChecks, true},
	)
	return validations
}

// getMobileValidations returns mobile app validations only
func getMobileValidations() []ValidationTask {
	return []ValidationTask{
		{"Build Script Syntax Check", runBuildScriptSyntaxValidation, true},
		{"Mobile App Validation", runMobileTests, false},
		{"iOS Build & Lint Validation", runIOSValidation, true},         // Parallel: Different build systems
		{"Android Build & Lint Validation", runAndroidValidation, true}, // Parallel: Different build systems
		{"Web Build Validation", runWebValidation, true},                // Parallel: Different build systems
		{"Web Extension Linting", runWebExtensionLinting, true},
	}
}

// getToolsValidations returns Go tools build/test/run validations
func getToolsValidations() []ValidationTask {
	return []ValidationTask{
		{"Go Tools Build, Test & Run", runGoToolsValidation, false},
		{"Go Lint Validation", runGoLintValidation, false},
	}
}

// getAllValidations returns all validations including infrastructure, mobile, web, and tools
// IMPORTANT: Mobile builds run EARLY to catch compilation errors before optional tests
func getAllValidations() []ValidationTask {
	validations := getMediumValidations()
	validations = append(validations,
		// CRITICAL: Mobile platform builds FIRST - catch compilation errors early
		// Parallel: Different build systems (Xcode/Gradle/Flutter) in different dirs
		ValidationTask{"Mobile App Validation", runMobileTests, true},
		ValidationTask{"iOS Build & Lint Validation", runIOSValidation, true},         // Parallel: Uses Xcode in ios/
		ValidationTask{"Android Build & Lint Validation", runAndroidValidation, true}, // Parallel: Uses Gradle in android/
		ValidationTask{"Web Build Validation", runWebValidation, true},                // Parallel: Uses Flutter in recipe_archive/
		ValidationTask{"Web Extension Linting", runWebExtensionLinting, true},         // Parallel: Uses npm in extensions/

		// Then comprehensive tests (may fail on network/AWS issues)
		ValidationTask{"Run Comprehensive Tests", runComprehensiveTests, true},
		ValidationTask{"Validate Parsers", validateParsers, true},
		ValidationTask{"Validate Recipe Storage", validateRecipeStorage, true},
		ValidationTask{"Check Frontend Status", checkFrontendStatus, true},

		// Go tools validation (parallel: independent Go binaries)
		ValidationTask{"Go Tools Build, Test & Run", runGoToolsValidation, true},
		ValidationTask{"Go Lint Validation", runGoLintValidation, true},

		// Infrastructure tests (may fail on AWS connectivity)
		ValidationTask{"AWS Infrastructure Tests", runAwsInfrastructureTests, true},
		ValidationTask{"Validate Deployment Infrastructure", validateDeploymentInfrastructure, true},
		ValidationTask{"Validate Extension Downloads", validateExtensionDownloads, true},
	)
	return validations
}

// findGitRoot finds the root of the git repository
func findGitRoot() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	// Walk up the directory tree looking for .git
	dir := cwd
	for {
		gitPath := filepath.Join(dir, ".git")
		if _, err := os.Stat(gitPath); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached the root of the filesystem
			break
		}
		dir = parent
	}

	// Fallback to current directory if no .git found
	return cwd, nil
}
