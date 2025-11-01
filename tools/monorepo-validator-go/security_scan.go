package main

// runSecurityScan migrates the security scan logic from the shell script.
func runSecurityScan(projectRoot string) bool {
	if !checkCommand("trufflehog") {
		return true
	}
	_, err := runCommand(projectRoot, "trufflehog", "git", "file://.", "--only-verified", "--since-commit", "HEAD~4", "--no-update")
	return err == nil
}
