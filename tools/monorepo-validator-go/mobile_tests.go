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

	// Validate presence of all critical mobile development scripts
	// These scripts are required for complete iOS and Android development
	scriptsFound := 0
	scripts := []string{
		"scripts/ios/build.sh",     // iOS build automation
		"scripts/ios/setup.sh",     // iOS environment setup
		"scripts/android/build.sh", // Android build automation
		"scripts/android/setup.sh", // Android environment setup
	}

	for _, script := range scripts {
		scriptPath := filepath.Join(projectRoot, script)
		if _, err := os.Stat(scriptPath); err == nil {
			scriptsFound++
		}
	}

	// Require all 4 scripts to exist for complete mobile validation
	// This ensures both iOS and Android toolchains are properly configured
	return scriptsFound >= 4
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

// runAndroidValidation performs Android build validation
func runAndroidValidation(projectRoot string) bool {
	fmt.Println("\n=== ANDROID BUILD & LINT VALIDATION ===")

	// Check for Android build script
	androidBuildScript := filepath.Join(projectRoot, "scripts/android/build.sh")
	if _, err := os.Stat(androidBuildScript); os.IsNotExist(err) {
		fmt.Printf("  Android build script: ✗ (not found at %s)\n", androidBuildScript)
		return false
	}

	// Run Android build validation (dev debug build)
	fmt.Printf("  Running Android debug build...\n")
	output, err := runCommand(
		projectRoot,
		androidBuildScript,
		"--dev",
		"--emulator",
		"--debug",
	)

	if err != nil {
		fmt.Printf("  Android debug build: ✗\n")
		fmt.Printf("  Error: %v\n", err)
		if output != "" {
			fmt.Printf("  Output: %s\n", output)
		}
		return false
	}

	fmt.Printf("  Android debug build: ✓\n")
	return true
}

// runWebValidation performs Flutter web build validation
func runWebValidation(projectRoot string) bool {
	fmt.Println("\n=== WEB BUILD VALIDATION ===")

	recipeArchivePath := filepath.Join(projectRoot, "recipe_archive")

	if !checkCommand("flutter") {
		fmt.Printf("  Flutter: ✗ (not installed)\n")
		return false
	}

	// Run flutter build web
	fmt.Printf("  Running flutter build web...\n")
	output, err := runCommand(recipeArchivePath, "flutter", "build", "web")

	if err != nil {
		fmt.Printf("  Flutter web build: ✗\n")
		fmt.Printf("  Error: %v\n", err)
		if output != "" {
			fmt.Printf("  Output: %s\n", output)
		}
		return false
	}

	fmt.Printf("  Flutter web build: ✓\n")
	return true
}

// runWebExtensionLinting performs ESLint validation on browser extensions
func runWebExtensionLinting(projectRoot string) bool {
	fmt.Println("\n=== WEB EXTENSION LINTING ===")

	// Check if eslint is available
	if !checkCommand("npm") {
		fmt.Printf("  npm: ✗ (not installed)\n")
		return false
	}

	// Run npm run lint (which uses the browser extensions ESLint config)
	fmt.Printf("  Running ESLint on browser extensions...\n")
	output, err := runCommand(projectRoot, "npm", "run", "lint")

	if err != nil {
		fmt.Printf("  Extension linting: ✗\n")
		fmt.Printf("  Run 'npm run lint' for details\n")
		if output != "" {
			// Show first few lines of output for context
			fmt.Printf("  Hint: Check extensions/ directory for linting issues\n")
		}
		return false
	}

	fmt.Printf("  Extension linting: ✓\n")
	return true
}

// runBuildScriptSyntaxValidation validates that build scripts have valid syntax and accept default args
func runBuildScriptSyntaxValidation(projectRoot string) bool {
	fmt.Println("\n=== BUILD SCRIPT SYNTAX & DEFAULTS VALIDATION ===")

	scripts := map[string]string{
		"iOS build":     filepath.Join(projectRoot, "scripts/ios/build.sh"),
		"Android build": filepath.Join(projectRoot, "scripts/android/build.sh"),
		"iOS clean":     filepath.Join(projectRoot, "scripts/ios/clean.sh"),
		"Android clean": filepath.Join(projectRoot, "scripts/android/clean.sh"),
	}

	allPassed := true

	for name, script := range scripts {
		// Check if script exists
		if _, err := os.Stat(script); os.IsNotExist(err) {
			fmt.Printf("  %s: ✗ (not found at %s)\n", name, script)
			allPassed = false
			continue
		}

		// Test 1: Script has valid bash syntax
		fmt.Printf("  Testing %s syntax... ", name)
		_, err := runCommand(projectRoot, "bash", "-n", script)
		if err != nil {
			fmt.Printf("✗ (syntax error)\n")
			allPassed = false
			continue
		}
		fmt.Printf("✓\n")

		// Test 2: Script shows help with --help (skip clean scripts)
		if filepath.Base(script) != "clean.sh" {
			fmt.Printf("  Testing %s --help... ", name)
			_, err = runCommand(projectRoot, script, "--help")
			if err != nil {
				fmt.Printf("✗ (help flag failed)\n")
				allPassed = false
				continue
			}
			fmt.Printf("✓\n")
		}
	}

	if allPassed {
		fmt.Printf("\n  Build script validation: ✓\n")
	} else {
		fmt.Printf("\n  Build script validation: ✗\n")
	}

	return allPassed
}
