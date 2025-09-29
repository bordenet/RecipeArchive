package main

import ()

// runBasicQualityChecks migrates the basic quality checks logic from the shell script.
func runBasicQualityChecks(projectRoot string) bool {
	_, err := runCommand(projectRoot, "npm", "run", "docs:organize")
	return err == nil
}
