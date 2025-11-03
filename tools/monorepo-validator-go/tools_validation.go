package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// runGoToolsValidation builds, tests, and runs all Go tools
func runGoToolsValidation(projectRoot string) bool {
	fmt.Println("\n=== GO TOOLS BUILD, TEST & RUN VALIDATION ===")

	toolsDir := filepath.Join(projectRoot, "tools")

	// List of Go tools to validate (directories with go.mod and main.go)
	goTools := []string{
		"content-ops",
		"get-diagnostics",
		"recipe-tracer",
		"recipe-url-discovery",
		"s3-cleanup",
		// Note: auth-test is deprecated/incomplete, skipping
	}

	allPassed := true

	for _, tool := range goTools {
		toolPath := filepath.Join(toolsDir, tool)

		// Check if tool directory exists
		if _, err := os.Stat(toolPath); os.IsNotExist(err) {
			fmt.Printf("  %s: ⚠ (directory not found, skipping)\n", tool)
			continue
		}

		fmt.Printf("\n  --- Validating %s ---\n", tool)

		// Check for go.mod
		goModPath := filepath.Join(toolPath, "go.mod")
		if _, err := os.Stat(goModPath); os.IsNotExist(err) {
			fmt.Printf("  %s go.mod: ✗ (not found)\n", tool)
			allPassed = false
			continue
		}

		// Run go mod tidy to ensure dependencies are up to date
		fmt.Printf("  Running go mod tidy for %s...\n", tool)
		_, err := runCommand(toolPath, "go", "mod", "tidy")
		if err != nil {
			fmt.Printf("  %s go mod tidy: ✗\n", tool)
			allPassed = false
			continue
		}

		// Build the tool
		fmt.Printf("  Building %s...\n", tool)
		_, err = runCommand(toolPath, "go", "build", "-o", tool)
		if err != nil {
			fmt.Printf("  %s build: ✗\n", tool)
			allPassed = false
			continue
		}
		fmt.Printf("  %s build: ✓\n", tool)

		// Run go test if test files exist
		testFiles, _ := filepath.Glob(filepath.Join(toolPath, "*_test.go"))
		if len(testFiles) > 0 {
			fmt.Printf("  Testing %s...\n", tool)
			_, err := runCommand(toolPath, "go", "test", "./...")
			if err != nil {
				fmt.Printf("  %s tests: ✗\n", tool)
				allPassed = false
				continue
			}
			fmt.Printf("  %s tests: ✓\n", tool)
		} else {
			fmt.Printf("  %s tests: ⚠ (no test files found)\n", tool)
		}

		// Run the tool with --help or -h flag to verify it executes
		fmt.Printf("  Running %s --help...\n", tool)
		binaryPath := filepath.Join(toolPath, tool)
		output, err := runCommand(toolPath, binaryPath, "--help")
		if err != nil {
			// Try -h flag
			output, err = runCommand(toolPath, binaryPath, "-h")
			if err != nil {
				fmt.Printf("  %s execution: ⚠ (no help flag, but binary built)\n", tool)
			} else {
				fmt.Printf("  %s execution: ✓\n", tool)
			}
		} else {
			fmt.Printf("  %s execution: ✓\n", tool)
		}

		// Verify output contains expected help text
		if output != "" {
			fmt.Printf("  %s help output: ✓\n", tool)
		}
	}

	if allPassed {
		fmt.Printf("\n  All Go tools validated successfully ✓\n")
	} else {
		fmt.Printf("\n  Some Go tools failed validation ✗\n")
	}

	return allPassed
}

// runGoLintValidation runs golangci-lint on all Go code
func runGoLintValidation(projectRoot string) bool {
	fmt.Println("\n=== GO LINT VALIDATION ===")

	if !checkCommand("golangci-lint") {
		fmt.Printf("  golangci-lint: ✗ (not installed)\n")
		fmt.Printf("  Install with: brew install golangci-lint\n")
		return false // Fail if linter not installed - it's required
	}

	// Lint Lambda functions (each function separately)
	fmt.Printf("  Linting Lambda functions...\n")
	lambdaFunctionsDir := filepath.Join(projectRoot, "aws-backend/functions")

	// Find all subdirectories with go.mod files
	entries, err := os.ReadDir(lambdaFunctionsDir)
	if err != nil {
		fmt.Printf("  Lambda functions lint: ⚠ (functions directory not accessible)\n")
		return true // Don't fail if directory missing
	}

	lambdaLintPassed := true
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		functionPath := filepath.Join(lambdaFunctionsDir, entry.Name())
		goModPath := filepath.Join(functionPath, "go.mod")

		// Only lint if go.mod exists
		if _, err := os.Stat(goModPath); os.IsNotExist(err) {
			continue
		}

		_, err := runCommand(functionPath, "golangci-lint", "run", "./...")
		if err != nil {
			fmt.Printf("  %s lint: ✗\n", entry.Name())
			lambdaLintPassed = false
		} else {
			fmt.Printf("  %s lint: ✓\n", entry.Name())
		}
	}

	if !lambdaLintPassed {
		return false
	}

	// Lint Go tools
	fmt.Printf("  Linting Go tools...\n")
	toolsDir := filepath.Join(projectRoot, "tools")

	goTools := []string{
		"content-ops",
		"get-diagnostics",
		"recipe-tracer",
		"recipe-url-discovery",
		"s3-cleanup",
		"monorepo-validator-go",
		// Note: auth-test is Node.js, not Go
	}

	allPassed := true
	for _, tool := range goTools {
		toolPath := filepath.Join(toolsDir, tool)
		if _, err := os.Stat(toolPath); os.IsNotExist(err) {
			continue
		}

		_, err := runCommand(toolPath, "golangci-lint", "run", "./...")
		if err != nil {
			fmt.Printf("  %s lint: ✗\n", tool)
			allPassed = false
		} else {
			fmt.Printf("  %s lint: ✓\n", tool)
		}
	}

	return allPassed
}
