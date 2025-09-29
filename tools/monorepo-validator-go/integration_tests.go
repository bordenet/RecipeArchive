package main

import (
	"path/filepath"
	"sync"
)

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
