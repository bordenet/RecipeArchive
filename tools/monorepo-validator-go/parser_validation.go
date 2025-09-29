package main

import (
	"path/filepath"
	"sync"
)

// validateParsers migrates the parser validation logic from the shell script.
func validateParsers(projectRoot string) bool {
	var wg sync.WaitGroup
	results := make(chan bool, 2)

	wg.Add(2)

	go func() {
		defer wg.Done()
		parserTestPath := filepath.Join(projectRoot, "tests", "parser-validation")
		_, err := runCommand(parserTestPath, "node", "test-parser-integration.cjs")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		extensionTestPath := filepath.Join(projectRoot, "tests", "extension-validation")
		_, err := runCommand(extensionTestPath, "node", "test-extension-url-patterns.js")
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
