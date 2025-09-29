package main

import (
	"os"
	"path/filepath"
	"sync"
)

// runLintingChecks migrates the linting checks logic from the shell script.
func runLintingChecks(projectRoot string) bool {
	var wg sync.WaitGroup
	results := make(chan bool, 6)

	wg.Add(6)

	go func() {
		defer wg.Done()
		_, err := runCommand(projectRoot, "npm", "run", "lint")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		chromeExtensionPath := filepath.Join(projectRoot, "extensions", "chrome")
		_, err := runCommand(chromeExtensionPath, "npm", "run", "lint")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		safariExtensionPath := filepath.Join(projectRoot, "extensions", "safari")
		_, err := runCommand(safariExtensionPath, "npm", "run", "lint")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		_, err := runCommand(projectRoot, "npm", "run", "lint:scoping")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		recipeArchivePath := filepath.Join(projectRoot, "recipe_archive")
		if _, err := os.Stat(recipeArchivePath); os.IsNotExist(err) {
			results <- true
			return
		}
		if !checkCommand("flutter") {
			results <- true
			return
		}
		_, err := runCommand(recipeArchivePath, "flutter", "analyze")
		results <- err == nil
	}()

	go func() {
		defer wg.Done()
		if !checkCommand("aws") {
			results <- true
			return
		}
		_, err := runCommand(projectRoot, "aws", "s3", "ls", "s3://recipe-storage-0ea7007d57f67ecb-990537043943/flutter-console-errors/", "--recursive")
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
