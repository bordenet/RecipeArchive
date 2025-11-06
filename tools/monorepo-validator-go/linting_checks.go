package main

// runLintingChecks runs minimal ESLint validation on JavaScript files.
// This is a simplified version that only runs the root-level lint command.
func runLintingChecks(projectRoot string) bool {
	// Run ESLint on extensions JavaScript files
	_, err := runCommand(projectRoot, "npm", "run", "lint")
	return err == nil
}
