package main

import (
	"os"
	"path/filepath"
	"strings"
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

// findGoModDirectories finds all directories containing go.mod files
func findGoModDirectories(rootPath string) ([]string, error) {
	var dirs []string

	err := filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.Name() == "go.mod" {
			dirs = append(dirs, filepath.Dir(path))
		}

		return nil
	})

	return dirs, err
}

// hasGoSourceFiles checks if a directory contains .go source files
func hasGoSourceFiles(dir string) (bool, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false, err
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".go") {
			return true, nil
		}
	}

	return false, nil
}
