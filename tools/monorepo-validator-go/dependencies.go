package main

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

// runCommand executes a shell command and returns its combined output.
// If the command fails, it prints detailed error information.
func runCommand(dir string, name string, arg ...string) (string, error) {
	cmd := exec.Command(name, arg...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("\n%s[ERROR] Command failed in %s: %s %s%s\n", ColorRed, dir, name, strings.Join(arg, " "), ColorReset)
		fmt.Printf("%s--- Output ---%s\n%s\n", ColorYellow, ColorReset, string(out))
	}
	return string(out), err
}

// installNPMDependencies runs 'npm install' in the given directory.
func installNPMDependencies(dir string) bool {
	fmt.Printf("  Installing npm dependencies in %s... ", dir)
	cmd := exec.Command("npm", "install")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("✗\n    Error: %v\n    Output: %s\n", err, string(out))
		return false
	}
	// fmt.Println("✓")
	return true
}

// installDependencies migrates the dependency installation logic from the shell script.
func installDependencies(projectRoot string) bool {
	var wg sync.WaitGroup
	results := make(chan bool, 3)

	wg.Add(3)

	go func() {
		defer wg.Done()
		results <- installNPMDependencies(projectRoot)
	}()

	go func() {
		defer wg.Done()
		awsBackendInfraPath := filepath.Join(projectRoot, "aws-backend", "infrastructure")
		results <- installNPMDependencies(awsBackendInfraPath)
	}()

	go func() {
		defer wg.Done()
		safariTestPath := filepath.Join(projectRoot, "extensions", "tests", "safari")
		results <- installNPMDependencies(safariTestPath)
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
