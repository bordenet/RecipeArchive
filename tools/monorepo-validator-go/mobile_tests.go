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
		"scripts/ios-setup.sh",
		"scripts/android-setup.sh",
		"recipe_archive/scripts/build-mobile.sh",
	}

	for _, script := range scripts {
		scriptPath := filepath.Join(projectRoot, script)
		if _, err := os.Stat(scriptPath); err == nil {
			scriptsFound++
		}
	}

	return scriptsFound >= 2
}

// runIOSValidation performs iOS build and deploy validation
func runIOSValidation(projectRoot string) bool {
	fmt.Println("\n=== iOS BUILD & DEPLOY VALIDATION ===")

	// Check for iOS build script
	iosBuildScript := filepath.Join(projectRoot, "scripts/ios-build-and-deploy.sh")
	if _, err := os.Stat(iosBuildScript); os.IsNotExist(err) {
		fmt.Printf("  iOS build script: ✗ (not found at %s)\n", iosBuildScript)
		return false
	}

	// Run iOS build and deploy validation
	fmt.Printf("  Running iOS build and deploy to simulator...\n")
	output, err := runCommand(
		projectRoot,
		iosBuildScript,
		"--target", "simulator",
		"--config", "debug",
		"--device-target", "iphone-17-pro",
	)

	if err != nil {
		fmt.Printf("  iOS build and deploy: ✗\n")
		fmt.Printf("  Error: %v\n", err)
		if output != "" {
			fmt.Printf("  Output: %s\n", output)
		}
		return false
	}

	fmt.Printf("  iOS build and deploy: ✓\n")
	return true
}