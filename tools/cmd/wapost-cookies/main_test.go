package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindProjectRoot(t *testing.T) {
	// Test that we can find the project root
	root, err := findProjectRoot()
	if err != nil {
		t.Fatalf("Failed to find project root: %v", err)
	}

	// Check that the root contains expected files
	packageJSON := filepath.Join(root, "package.json")
	if _, err := os.Stat(packageJSON); os.IsNotExist(err) {
		t.Errorf("Expected package.json at %s", packageJSON)
	}

	// Check that the root contains expected directories
	expectedDirs := []string{"extensions", "aws-backend", "tools"}
	for _, dir := range expectedDirs {
		dirPath := filepath.Join(root, dir)
		if _, err := os.Stat(dirPath); os.IsNotExist(err) {
			t.Errorf("Expected directory %s at %s", dir, dirPath)
		}
	}
}

func TestCookieFilePathGeneration(t *testing.T) {
	root, err := findProjectRoot()
	if err != nil {
		t.Fatalf("Failed to find project root: %v", err)
	}

	expected := filepath.Join(root, "config", "wapost-subscription-cookies.json")
	cookiesFile := filepath.Join(root, "config", "wapost-subscription-cookies.json")

	if cookiesFile != expected {
		t.Errorf("Expected cookies file path %s, got %s", expected, cookiesFile)
	}
}
