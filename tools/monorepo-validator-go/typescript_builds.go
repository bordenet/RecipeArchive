package main

import (
	"os"
	"path/filepath"
	"sync"
)

// buildTypeScript migrates the TypeScript build logic from the shell script.
func buildTypeScript(projectRoot string) bool {
	var wg sync.WaitGroup
	results := make(chan bool, 2)

	wg.Add(2)

	go func() {
		defer wg.Done()
		_, err := runCommand(projectRoot, "npx", "tsc", "--project", "parsers/tsconfig.json", "--noEmit")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		awsBackendInfraPath := filepath.Join(projectRoot, "aws-backend", "infrastructure")
		if _, err := os.Stat(awsBackendInfraPath); os.IsNotExist(err) {
			results <- true
			return
		}
		_, err := runCommand(awsBackendInfraPath, "npx", "tsc", "--noEmit")
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
