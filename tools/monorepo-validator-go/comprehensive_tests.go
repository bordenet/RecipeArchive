package main

import (
	"os"
	"path/filepath"
)

// runComprehensiveTests migrates the comprehensive tests logic from the shell script.
func runComprehensiveTests(projectRoot string) bool {
	recipeArchivePath := filepath.Join(projectRoot, "recipe_archive")
	if _, err := os.Stat(recipeArchivePath); os.IsNotExist(err) {
		return true
	}
	if !checkCommand("flutter") {
		return true
	}
	_, err := runCommand(recipeArchivePath, "flutter", "test")
	return err == nil
}
