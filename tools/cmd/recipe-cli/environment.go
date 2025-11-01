package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// findProjectRoot locates the project root directory
func findProjectRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		packageJSON := filepath.Join(dir, "package.json")
		if _, err := os.Stat(packageJSON); err == nil {
			return dir, nil
		}

		goMod := filepath.Join(dir, "go.mod")
		if _, err := os.Stat(goMod); err == nil {
			return filepath.Dir(dir), nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", fmt.Errorf("project root not found")
}

// validateEnvironment checks for required tools and dependencies
func validateEnvironment() error {
	fmt.Println("\n🔍 Checking development environment...")

	checks := []struct {
		name    string
		checker func() error
	}{
		{"Node.js", checkNodeJS},
		{"Go", checkGo},
		{"Git", checkGit},
		{"Project Structure", checkProjectStructure},
	}

	failed := 0
	for _, check := range checks {
		fmt.Printf("  Checking %s... ", check.name)
		if err := check.checker(); err != nil {
			fmt.Printf("❌ FAILED: %v\n", err)
			failed++
		} else {
			fmt.Printf("✅ OK\n")
		}
	}

	if failed > 0 {
		return fmt.Errorf("%d validation checks failed", failed)
	}

	fmt.Println("\n🎉 Environment validation complete! All checks passed.")
	return nil
}

// runMonorepoValidation executes the comprehensive monorepo validation script
func runMonorepoValidation() error {
	projectRoot, err := findProjectRoot()
	if err != nil {
		return fmt.Errorf("failed to find project root: %w", err)
	}

	fmt.Println("\n🔄 Running monorepo validation script...")

	validationScript := filepath.Join(projectRoot, "validate-monorepo.sh")
	if _, err := os.Stat(validationScript); os.IsNotExist(err) {
		return fmt.Errorf("monorepo validation script not found at: %s", validationScript)
	}

	cmd := exec.Command("bash", validationScript)
	cmd.Dir = projectRoot
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("monorepo validation failed: %w", err)
	}

	fmt.Println("\n🎉 Monorepo validation completed successfully!")
	return nil
}

// Helper functions for environment validation
func checkNodeJS() error {
	cmd := exec.Command("node", "--version")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("Node.js not found")
	}
	version := strings.TrimSpace(string(output))
	if !strings.HasPrefix(version, "v") {
		return fmt.Errorf("unexpected Node.js version format: %s", version)
	}
	return nil
}

func checkGo() error {
	cmd := exec.Command("go", "version")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("Go not found")
	}
	version := strings.TrimSpace(string(output))
	if !strings.Contains(version, "go version") {
		return fmt.Errorf("unexpected Go version format: %s", version)
	}
	return nil
}

func checkGit() error {
	cmd := exec.Command("git", "--version")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("Git not found")
	}
	version := strings.TrimSpace(string(output))
	if !strings.Contains(version, "git version") {
		return fmt.Errorf("unexpected Git version format: %s", version)
	}
	return nil
}

func checkProjectStructure() error {
	projectRoot, err := findProjectRoot()
	if err != nil {
		return fmt.Errorf("project root not found")
	}

	requiredFiles := []string{
		"package.json",
		"tools/go.mod",
		"extensions/chrome/manifest.json",
		"extensions/safari/manifest.json",
	}

	for _, file := range requiredFiles {
		fullPath := filepath.Join(projectRoot, file)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			return fmt.Errorf("missing required file: %s", file)
		}
	}

	return nil
}

func checkAwsCli() error {
	cmd := exec.Command("aws", "--version")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("AWS CLI not found or not configured")
	}
	version := strings.TrimSpace(string(output))
	if !strings.Contains(version, "aws-cli") {
		return fmt.Errorf("unexpected AWS CLI version format: %s", version)
	}
	return nil
}

func checkAwsCdk() error {
	cmd := exec.Command("cdk", "--version")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("AWS CDK not found")
	}
	version := strings.TrimSpace(string(output))
	if version == "" {
		return fmt.Errorf("CDK version check returned empty result")
	}
	return nil
}
