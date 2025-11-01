package main

// runQualityGate migrates the quality gate logic from the shell script.
func runQualityGate(projectRoot string) bool {
	_, err := runCommand(projectRoot, "npm", "run", "quality:gate")
	return err == nil
}
