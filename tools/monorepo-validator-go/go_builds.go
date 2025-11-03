package main

import (
	"path/filepath"
	"sync"
)

// buildGoBinaries migrates the Go binary build logic from the shell script.
func buildGoBinaries(projectRoot string) bool {
	var wg sync.WaitGroup
	results := make(chan bool, 3)

	wg.Add(3)

	go func() {
		defer wg.Done()
		awsBackendPath := filepath.Join(projectRoot, "aws-backend")
		_, err := runCommand(awsBackendPath, "make", "build")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		toolsPath := filepath.Join(projectRoot, "tools")
		_, err := runCommand(toolsPath, "make", "build")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		contentOpsPath := filepath.Join(projectRoot, "tools", "content-ops")
		_, err := runCommand(contentOpsPath, "go", "build", "-o", "content-ops", ".")
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
