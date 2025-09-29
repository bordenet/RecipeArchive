package main

import (
	"os"
	"path/filepath"
)

// checkFrontendStatus migrates the frontend status check logic from the shell script.
func checkFrontendStatus(projectRoot string) bool {
	recipeArchivePath := filepath.Join(projectRoot, "recipe_archive")
	pubspecPath := filepath.Join(recipeArchivePath, "pubspec.yaml")

	if _, err := os.Stat(recipeArchivePath); os.IsNotExist(err) {
		return false
	} else if err != nil {
		return false
	}

	if _, err := os.Stat(pubspecPath); os.IsNotExist(err) {
		return false
	} else if err != nil {
		return false
	}

	return true
}
