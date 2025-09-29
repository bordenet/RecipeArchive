package main

import (
	"os"
	"path/filepath"
)

// runMobileTests validates mobile development environment and Flutter setup
func runMobileTests(projectRoot string) bool {
	if !checkCommand("flutter") {
		return false
	}

	recipeArchivePath := filepath.Join(projectRoot, "recipe_archive")
	if _, err := os.Stat(recipeArchivePath); os.IsNotExist(err) {
		return false
	}

	pubspecPath := filepath.Join(recipeArchivePath, "pubspec.yaml")
	if _, err := os.Stat(pubspecPath); os.IsNotExist(err) {
		return false
	}

	if checkCommand("flutter") {
		_, err := runCommand(projectRoot, "flutter", "doctor", "--android-licenses")
		if err != nil {
			return false
		}
	}

	scriptsFound := 0
	scripts := []string{
		"scripts/ios-setup.sh",
		"scripts/android-setup.sh",
		"recipe_archive/scripts/build-mobile.sh",
	}

	for _, script := range scripts {
		scriptPath := filepath.Join(projectRoot, script)
		if _, err := os.Stat(scriptPath); err == nil {
			scriptsFound++
		}
	}

	return scriptsFound >= 2
}