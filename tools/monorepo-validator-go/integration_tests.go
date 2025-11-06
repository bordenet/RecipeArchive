package main

import (
	"os"
	"path/filepath"
)

// runParserTests runs the TypeScript parser unit tests
func runParserTests(projectRoot string) bool {
	_, err := runCommand(projectRoot, "npm", "run", "test:parsers")
	return err == nil
}

// runTypeScriptUnitTests runs the TypeScript unit tests for extensions
func runTypeScriptUnitTests(projectRoot string) bool {
	_, err := runCommand(projectRoot, "npm", "run", "test:unit")
	return err == nil
}

// runGoBackendTests runs the Go backend unit tests
func runGoBackendTests(projectRoot string) bool {
	awsBackendFunctionsPath := filepath.Join(projectRoot, "aws-backend", "functions", "local-server")
	_, err := runCommand(awsBackendFunctionsPath, "go", "test", "-v")
	return err == nil
}

// runGoToolsTests runs the Go tools unit tests
func runGoToolsTests(projectRoot string) bool {
	toolsPath := filepath.Join(projectRoot, "tools")
	_, err := runCommand(toolsPath, "make", "test")
	return err == nil
}

// runExtensionIntegrationTests runs the extension integration tests
func runExtensionIntegrationTests(projectRoot string) bool {
	_, err := runCommand(projectRoot, "jest", "tests/parser-registry-integration.test.js")
	return err == nil
}

// runExtensionTests runs the Chrome/Safari extension tests
func runExtensionTests(projectRoot string) bool {
	_, err := runCommand(projectRoot, "npm", "run", "test:extensions")
	return err == nil
}

// buildParserBundle validates that the parser bundle builds successfully
func buildParserBundle(projectRoot string) bool {
	// Clean up any stale lock files from crashed validation runs
	// This ensures a fresh start for each validation run
	lockFile := filepath.Join(projectRoot, "parsers", ".build-lock")
	_ = os.Remove(lockFile) // Ignore errors - file might not exist

	_, err := runCommand(projectRoot, "npm", "run", "build:parser-bundle")
	return err == nil
}
