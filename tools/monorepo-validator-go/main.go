package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
)

// Global file object for original stdout for dashboard output
// This is created from duplicated file descriptor at startup
var originalStdout *os.File

func init() {
	// Duplicate stdout file descriptor before any redirections
	// This ensures dashboard output always goes to the real terminal
	stdoutFd, _ := syscall.Dup(int(os.Stdout.Fd()))
	originalStdout = os.NewFile(uintptr(stdoutFd), "/dev/stdout")
}

func printUsage() {
	fmt.Printf(`NAME
    validate-monorepo - RecipeArchive monorepo validation tool

SYNOPSIS
    validate-monorepo [OPTIONS]

DESCRIPTION
    A high-performance parallel validation system for the RecipeArchive monorepo.
    Validates builds, tests, linting, security, and infrastructure across all
    components: Go backend, TypeScript parsers, mobile apps, and AWS resources.

    Security scanning, code linting, and dependency validation always enabled.

OPTIONS
  Validation Tiers:
    -p1          Phase 1 (30-60s): Prerequisites + core builds + security
                 Use for: Quick commits, development workflow

    -med         Medium [DEFAULT] (2-3min): P1 + integration tests + quality
                 Use for: Pull requests, pre-deployment validation

    -all         All/Comprehensive (5-10min): Everything including AWS + mobile
                 Use for: Release validation, comprehensive audits

  Specialized Validations:
    -infra       Infrastructure (2-3min): AWS multi-tenant + S3 + diagnostics
                 Use for: Infrastructure validation, AWS connectivity checks

    -mobile      Mobile (3-5min): iOS/Android/Web builds + lint
                 Use for: Mobile development, app store preparation

    -tools       Go Tools (2-4min): Build, test, lint all Go tools
                 Use for: Tools development, CLI validation

  Execution Options:
    -sequential  Run validations sequentially instead of parallel
    -verbose     Enable detailed output and progress logging
    -help        Display this help message

EXAMPLES
    validate-monorepo
        Run standard validation (medium tier)

    validate-monorepo -p1
        Quick validation for commits

    validate-monorepo -all
        Comprehensive pre-release check

    validate-monorepo -infra
        AWS infrastructure troubleshooting

    validate-monorepo -mobile -verbose
        Mobile validation with detailed logging

INTEGRATION
    Husky pre-commit:   validate-monorepo -p1
    GitHub Actions CI:  validate-monorepo -med
    Release pipeline:   validate-monorepo -all
    AWS deployment:     validate-monorepo -infra
    Mobile development: validate-monorepo -mobile

EXIT STATUS
    0    All validations passed
    1    One or more validations failed

AUDIT LOGS
    Detailed logs saved to: .validation-logs/

`)
}

func main() {
	// MAX OUT CPU/MEMORY USAGE - This is the only thing that matters when running
	runtime.GOMAXPROCS(runtime.NumCPU())                       // Use ALL available CPUs
	_ = syscall.Setpriority(syscall.PRIO_PROCESS, 0, -20) // Highest priority (requires root or sudo)

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

	// Determine which validations to run based on flags
	// Always include prerequisites as first section
	var validations []ValidationTask

	// Add prerequisites first
	validations = append(validations, ValidationTask{"Prerequisite Checks", validatePrerequisites, false, "Prerequisites"})

	// Add other validations based on flags
	if *infraFlag {
		validations = append(validations, getInfraValidations()...)
	} else if *p1Flag {
		validations = append(validations, getP1Validations()...)
	} else if *medFlag {
		validations = append(validations, getMediumValidations()...)
	} else if *mobileFlag {
		validations = append(validations, getMobileValidations()...)
	} else if *toolsFlag {
		validations = append(validations, getToolsValidations()...)
	} else if *allFlag {
		validations = append(validations, getAllValidations()...)
	} else {
		// Default: run medium validations
		validations = append(validations, getMediumValidations()...)
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
	Parallel bool   // Whether this task can run in parallel with others
	Section  string // Which progress section this belongs to (Prerequisites, Dependencies, P1, Infra, Mobile, Tools)
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

// runValidationsParallel runs parallelizable validations concurrently with dashboard UI
func runValidationsParallel(validator *Validator, validations []ValidationTask, projectRoot string, _ bool) {
	// Group validations by section
	sectionTasks := make(map[string][]ValidationTask)
	sectionOrder := []string{}
	seenSections := make(map[string]bool)

	for _, validation := range validations {
		section := validation.Section
		if section == "" {
			section = "Other"
		}

		if !seenSections[section] {
			sectionOrder = append(sectionOrder, section)
			seenSections[section] = true
		}

		sectionTasks[section] = append(sectionTasks[section], validation)
	}

	// Create progress dashboard
	dashboard := NewProgressDashboard()
	for _, section := range sectionOrder {
		tasks := sectionTasks[section]
		dashboard.AddSection(section, len(tasks))
	}

	// Print initial dashboard
	_, _ = fmt.Fprintln(originalStdout)
	_, _ = fmt.Fprintln(originalStdout, dashboard.View())

	// Result channels
	type TaskResult struct {
		Section string
		Result  ValidationResult
	}
	resultChan := make(chan TaskResult, len(validations))

	// Run Prerequisites and Dependencies FIRST (sequentially, in order)
	// These are setup steps that everything else depends on
	var wg sync.WaitGroup
	for _, section := range []string{"Prerequisites", "Dependencies"} {
		if tasks, exists := sectionTasks[section]; exists {
			for _, validation := range tasks {
				result := validator.RunValidationSilent(validation.Name, validation.Function, projectRoot)
				// Don't increment dashboard here - let the monitoring goroutine do it
				// Just send the result through the channel
				resultChan <- TaskResult{Section: section, Result: result}
			}
		}
	}

	// Now launch remaining validations in parallel
	for section, tasks := range sectionTasks {
		// Skip Prerequisites and Dependencies - already done
		if section == "Prerequisites" || section == "Dependencies" {
			continue
		}
		for _, validation := range tasks {
			wg.Add(1)
			go func(sec string, v ValidationTask) {
				defer wg.Done()
				result := validator.RunValidationSilent(v.Name, v.Function, projectRoot)
				resultChan <- TaskResult{Section: sec, Result: result}
			}(section, validation)
		}
	}

	// Progress monitoring - update on every task completion
	progressDone := make(chan struct{})
	dashboardLines := len(dashboard.Order) + 2 // Fixed: track initial dashboard size

	go func() {
		defer close(progressDone)

		for taskResult := range resultChan {
			dashboard.IncrementSection(taskResult.Section, taskResult.Result.Success)
			validator.AddResult(taskResult.Result)

			// FIXED: Safe redraw - move up exactly dashboardLines, clear, and redraw
			_, _ = fmt.Fprintf(originalStdout, "\033[%dA", dashboardLines) // Move up to dashboard start
			_, _ = fmt.Fprint(originalStdout, "\033[J")                    // Clear from cursor to end
			_, _ = fmt.Fprintln(originalStdout, dashboard.View())          // Print updated dashboard
			// Note: Errors will be printed at the end to avoid complexity of tracking cursor position
		}
	}()

	// Wait for all validations to complete
	wg.Wait()
	close(resultChan)
	<-progressDone // Wait for ALL results to be processed

	// FIXED: Final dashboard render - move up only by dashboard lines
	_, _ = fmt.Fprintf(originalStdout, "\033[%dA", dashboardLines) // Move to dashboard start
	_, _ = fmt.Fprint(originalStdout, "\033[J")                    // Clear everything below
	_, _ = fmt.Fprintln(originalStdout, dashboard.View())          // Print final dashboard

	// Print all errors in final summary
	hasErrors := false
	for _, result := range validator.Results {
		if !result.Success {
			hasErrors = true
			break
		}
	}

	if hasErrors {
		_, _ = fmt.Fprintln(originalStdout)
		_, _ = fmt.Fprintln(originalStdout, sectionStyle.Render("Errors encountered:"))
		for _, result := range validator.Results {
			if !result.Success {
				_, _ = fmt.Fprintln(originalStdout, errorStyle.Render(fmt.Sprintf("  ✗ %s %s", result.Name, result.Message)))
				_, _ = fmt.Fprintf(originalStdout, "  📄 Log: %s\n", result.LogPath)
			}
		}
	}

	// Print final summary
	_, _ = fmt.Fprintln(originalStdout)
	totalSuccess := 0
	totalFailed := 0
	for _, result := range validator.Results {
		if result.Success {
			totalSuccess++
		} else {
			totalFailed++
		}
	}

	if totalFailed == 0 {
		_, _ = fmt.Fprintln(originalStdout, successStyle.Render(fmt.Sprintf("✅ ALL VALIDATIONS PASSED (%d/%d)", totalSuccess, len(validator.Results))))
	} else {
		_, _ = fmt.Fprintln(originalStdout, errorStyle.Render(fmt.Sprintf("❌ VALIDATION FAILED (%d passed, %d failed)", totalSuccess, totalFailed)))
	}

	// Show audit log location
	_, _ = fmt.Fprintf(originalStdout, "\n📁 Audit logs: %s\n", filepath.Join(projectRoot, ".validation-logs"))
	_, _ = fmt.Fprintln(originalStdout)
}

// getInfraValidations returns infrastructure-only validations
func getInfraValidations() []ValidationTask {
	return []ValidationTask{
		{"AWS Infrastructure Tests", runAwsInfrastructureTests, false, "Infra"},
		{"Validate Deployment Infrastructure", validateDeploymentInfrastructure, false, "Infra"},
	}
}

// getP1Validations returns Phase 1 validations (prerequisites, deps, builds)
func getP1Validations() []ValidationTask {
	return []ValidationTask{
		{"Install Dependencies", installDependencies, false, "Dependencies"},
		{"Build Go Binaries", buildGoBinaries, true, "P1"},
		{"Build TypeScript", buildTypeScript, true, "P1"},
		{"Build Script Syntax Check", runBuildScriptSyntaxValidation, true, "P1"}, // Fast syntax validation
	}
}

// getMediumValidations returns medium scope validations (p1 + tests + linting)
func getMediumValidations() []ValidationTask {
	validations := getP1Validations()
	validations = append(validations,
		// Granular test tasks for better progress visibility
		ValidationTask{"Build Parser Bundle", buildParserBundle, true, "Tests"},
		ValidationTask{"Parser Unit Tests", runParserTests, true, "Tests"},
		ValidationTask{"TypeScript Unit Tests", runTypeScriptUnitTests, true, "Tests"},
		ValidationTask{"Go Backend Tests", runGoBackendTests, true, "Tests"},
		ValidationTask{"Go Tools Tests", runGoToolsTests, true, "Tests"},
		ValidationTask{"Extension Integration Tests", runExtensionIntegrationTests, true, "Tests"},
		ValidationTask{"Extension Tests", runExtensionTests, true, "Tests"},
		ValidationTask{"Run Security Scan", runSecurityScan, true, "Security"},
		ValidationTask{"Run Quality Gate", runQualityGate, true, "Quality"},
		ValidationTask{"Run Linting Checks", runLintingChecks, true, "Linting"},
		ValidationTask{"Run Basic Quality Checks", runBasicQualityChecks, true, "Quality"},
	)
	return validations
}

// getMobileValidations returns mobile app validations only
func getMobileValidations() []ValidationTask {
	return []ValidationTask{
		{"Build Script Syntax Check", runBuildScriptSyntaxValidation, true, "Mobile"},
		{"Mobile App Validation", runMobileTests, false, "Mobile"},
		{"iOS Build & Lint Validation", runIOSValidation, true, "Mobile"},         // Parallel: Different build systems
		{"Android Build & Lint Validation", runAndroidValidation, true, "Mobile"}, // Parallel: Different build systems
		{"Web Build Validation", runWebValidation, true, "Mobile"},                // Parallel: Different build systems
		{"Web Extension Linting", runWebExtensionLinting, true, "Mobile"},
	}
}

// getToolsValidations returns Go tools build/test/run validations
func getToolsValidations() []ValidationTask {
	return []ValidationTask{
		{"Go Tools Build, Test & Run", runGoToolsValidation, false, "Tools"},
		{"Go Lint Validation", runGoLintValidation, false, "Tools"},
	}
}

// getAllValidations returns all validations including infrastructure, mobile, web, and tools
// IMPORTANT: Mobile builds run EARLY to catch compilation errors before optional tests
func getAllValidations() []ValidationTask {
	validations := getMediumValidations()
	validations = append(validations,
		// CRITICAL: Mobile platform builds FIRST - catch compilation errors early
		// Parallel: Different build systems (Xcode/Gradle/Flutter) in different dirs
		ValidationTask{"Mobile App Validation", runMobileTests, true, "Mobile"},
		ValidationTask{"iOS Build & Lint Validation", runIOSValidation, true, "Mobile"},         // Parallel: Uses Xcode in ios/
		ValidationTask{"Android Build & Lint Validation", runAndroidValidation, true, "Mobile"}, // Parallel: Uses Gradle in android/
		ValidationTask{"Web Build Validation", runWebValidation, true, "Mobile"},                // Parallel: Uses Flutter in recipe_archive/
		ValidationTask{"Web Extension Linting", runWebExtensionLinting, true, "Mobile"},         // Parallel: Uses npm in extensions/

		// Then comprehensive tests (may fail on network/AWS issues)
		ValidationTask{"Flutter Tests", runComprehensiveTests, true, "Tests"}, // Moved to Tests section for better visibility
		ValidationTask{"Validate Parsers", validateParsers, true, "Tests"},
		ValidationTask{"Validate Recipe Storage", validateRecipeStorage, true, "Tests"},
		ValidationTask{"Check Frontend Status", checkFrontendStatus, true, "Tests"},

		// Go tools validation (parallel: independent Go binaries)
		ValidationTask{"Go Tools Build, Test & Run", runGoToolsValidation, true, "Tools"},
		ValidationTask{"Go Lint Validation", runGoLintValidation, true, "Tools"},

		// Infrastructure tests (may fail on AWS connectivity)
		ValidationTask{"AWS Infrastructure Tests", runAwsInfrastructureTests, true, "Infra"},
		ValidationTask{"Validate Deployment Infrastructure", validateDeploymentInfrastructure, true, "Infra"},
		ValidationTask{"Validate Extension Downloads", validateExtensionDownloads, true, "Infra"},
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
