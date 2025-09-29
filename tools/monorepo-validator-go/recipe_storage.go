package main

import (
	"os"
	"path/filepath"
)

// validateRecipeStorage migrates the recipe storage validation logic from the shell script.
func validateRecipeStorage(projectRoot string) bool {
	envFilePath := filepath.Join(projectRoot, ".env")
	if _, err := os.Stat(envFilePath); os.IsNotExist(err) {
		return true
	}

	recipeUserEmail := os.Getenv("RECIPE_USER_EMAIL")
	recipeUserPassword := os.Getenv("RECIPE_USER_PASSWORD")

	if recipeUserEmail == "" || recipeUserPassword == "" {
		return true
	}

	contentOpsDir := filepath.Join(projectRoot, "tools", "content-ops")
	contentOpsBinaryPath := filepath.Join(contentOpsDir, "content-ops")

	if _, err := os.Stat(contentOpsBinaryPath); os.IsNotExist(err) {
		_, buildErr := runCommand(contentOpsDir, "go", "build", "-o", "content-ops")
		if buildErr != nil {
			return false
		}
	}

	_, err := runCommand(contentOpsDir, contentOpsBinaryPath, "--user", recipeUserEmail, "--password", recipeUserPassword)
	return err == nil
}
