package main

import (
	"fmt"
	"os/exec"
)

// checkCommand checks if a command is available in the system's PATH.
func checkCommand(commandName string) bool {
	_, err := exec.LookPath(commandName)
	return err == nil
}

// validatePrerequisites checks for the presence of required tools.
func validatePrerequisites(projectRoot string) bool {
	fmt.Println("\n=== PREREQUISITES ===")

	var allPassed = true

	// Check for Node.js
	if checkCommand("node") {
		fmt.Println("  Node.js: ✓")
	} else {
		fmt.Println("  Node.js: ✗ (Not installed)")
		allPassed = false
	}

	// Check for npm
	if checkCommand("npm") {
		fmt.Println("  npm: ✓")
	} else {
		fmt.Println("  npm: ✗ (Not installed)")
		allPassed = false
	}

	// Check for Go
	if checkCommand("go") {
		fmt.Println("  Go: ✓")
	} else {
		fmt.Println("  Go: ✗ (Not installed)")
		allPassed = false
	}

	// Check for Make
	if checkCommand("make") {
		fmt.Println("  Make: ✓")
	} else {
		fmt.Println("  Make: ✗ (Not installed)")
		allPassed = false
	}

	// Check for ESLint
	if checkCommand("eslint") {
		fmt.Println("  ESLint: ✓")
	} else {
		// Additional check for local eslint in node_modules/.bin
		_, err := exec.LookPath("node_modules/.bin/eslint")
		if err == nil {
			fmt.Println("  ESLint: ✓ (Local install)")
		} else {
			fmt.Println("  ESLint: ✗ (Not available)")
			allPassed = false
		}
	}

	// Check for TruffleHog
	if checkCommand("trufflehog") {
		fmt.Println("  TruffleHog: ✓")
	} else {
		fmt.Println("  TruffleHog: ✗ (Not installed. Install with: brew install trufflehog or go install github.com/trufflesecurity/trufflehog/v3@latest)")
		allPassed = false
	}

	// Flutter check (optional, similar to shell script's warning)
	// For now, we'll just check if the command exists, not if the directory exists.
	if checkCommand("flutter") {
		fmt.Println("  Flutter: ✓")
	} else {
		fmt.Println("  Flutter: ⚠ (Not installed. Web app validation will be skipped)")
	}

	return allPassed
}
