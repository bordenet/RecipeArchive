package main

import (
	"path/filepath"
	"sync"
)

// DEPRECATED: Use granular test functions below instead
// run_integration_tests migrates the integration tests logic from the shell script.
func runIntegrationTests(projectRoot string) bool {
	var wg sync.WaitGroup
	results := make(chan bool, 4)

	wg.Add(4)

	go func() {
		defer wg.Done()
		_, err := runCommand(projectRoot, "npm", "run", "test:parsers")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		awsBackendFunctionsPath := filepath.Join(projectRoot, "aws-backend", "functions", "local-server")
		_, err := runCommand(awsBackendFunctionsPath, "go", "test", "-v")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		toolsPath := filepath.Join(projectRoot, "tools")
		_, err := runCommand(toolsPath, "make", "test")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		_, err := runCommand(projectRoot, "jest", "tests/parser-registry-integration.test.js")
		results <- err == nil
	}()

	wg.Wait()
	close(results)

	allPassed := true
	for result := range results {
		if !result {
			allPassed = false
		}
	}

	return allPassed
}

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
	_, err := runCommand(projectRoot, "npm", "run", "build:parser-bundle")
	return err == nil
}
