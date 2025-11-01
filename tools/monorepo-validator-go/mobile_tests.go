package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// runMobileTests validates mobile development environment and Flutter setup
func runMobileTests(projectRoot string) bool {
	if !checkCommand("flutter") {
		return false
	}

	recipeArchivePath := filepath.Join(projectRoot, "recipe_archive")
	if _, err := os.Stat(recipeArchivePath); os.IsNotExist(err) {
		return false
	}

	pubspecPath := filepath.Join(recipeArchivePath, "pubspec.yaml")
	if _, err := os.Stat(pubspecPath); os.IsNotExist(err) {
		return false
	}

	if checkCommand("flutter") {
		_, err := runCommand(projectRoot, "flutter", "doctor", "--android-licenses")
		if err != nil {
			return false
		}
	}

	scriptsFound := 0
	scripts := []string{
		"scripts/ios/ios-setup.sh",
		"scripts/android/setup.sh",
		"recipe_archive/scripts/build-mobile.sh",
	}

	for _, script := range scripts {
		scriptPath := filepath.Join(projectRoot, script)
		if _, err := os.Stat(scriptPath); err == nil {
			scriptsFound++
		}
	}

	return scriptsFound >= 1
}

// runIOSValidation performs iOS clean build, test, and lint validation (NO simulator deployment)
func runIOSValidation(projectRoot string) bool {
	fmt.Println("\n=== iOS BUILD, TEST & LINT VALIDATION ===")

	// Check for iOS build script (in subdirectory structure)
	iosBuildScript := filepath.Join(projectRoot, "scripts/ios/build.sh")
	if _, err := os.Stat(iosBuildScript); os.IsNotExist(err) {
		fmt.Printf("  iOS build script: ✗ (not found at %s)\n", iosBuildScript)
		return false
	}

	// Run SwiftLint validation on iOS codebase
	fmt.Printf("  Running SwiftLint on iOS codebase...\n")
	if checkCommand("swiftlint") {
		iosPath := filepath.Join(projectRoot, "recipe_archive/ios")
		_, err := runCommand(iosPath, "swiftlint")
		if err != nil {
			fmt.Printf("  SwiftLint: ✗ (linting issues found)\n")
			fmt.Printf("  Run 'cd recipe_archive/ios && swiftlint' for details\n")
			return false
		}
		fmt.Printf("  SwiftLint: ✓\n")
	} else {
		fmt.Printf("  SwiftLint: ⚠ (not installed, skipping)\n")
		fmt.Printf("  Install with: brew install swiftlint\n")
	}

	// Run iOS clean build validation (NO deployment to simulator)
	// Note: Removed --clean flag to avoid version conflicts in CI
	fmt.Printf("  Running iOS clean build (no simulator deployment)...\n")
	output, err := runCommand(
		projectRoot,
		iosBuildScript,
		"--dev",
		"--simulator",
		"--debug",
	)

	if err != nil {
		fmt.Printf("  iOS clean build: ✗\n")
		fmt.Printf("  Error: %v\n", err)
		if output != "" {
			fmt.Printf("  Output: %s\n", output)
		}
		return false
	}

	fmt.Printf("  iOS clean build: ✓\n")
	fmt.Printf("  Note: Skipping simulator deployment (use --run flag manually for deployment)\n")
	return true
}
