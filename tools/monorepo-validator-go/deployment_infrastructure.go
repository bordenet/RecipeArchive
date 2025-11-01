package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// validateDeploymentInfrastructure migrates the deployment infrastructure validation logic from the shell script.
func validateDeploymentInfrastructure(projectRoot string) bool {
	fmt.Println("\n=== DEPLOYMENT INFRASTRUCTURE ===")

	var wg sync.WaitGroup
	results := make(chan bool, 7)

	wg.Add(7)

	go func() {
		defer wg.Done()
		fmt.Print("  AWS CLI configuration... ")
		if !checkCommand("aws") {
			fmt.Println("✗ (AWS CLI not installed. Run 'aws configure' first.)")
			results <- false
		} else {
			out, err := runCommand(projectRoot, "aws", "sts", "get-caller-identity")
			if err != nil {
				fmt.Printf("✗\n    Error: %v\n    Output: %s\n", err, out)
				fmt.Println("    AWS CLI not configured. Run 'aws configure' first.")
				results <- false
			} else {
				//				fmt.Println("✓")
				results <- true
			}
		}
	}()

	go func() {
		defer wg.Done()
		fmt.Print("  Flutter build prerequisites... ")
		if !checkCommand("flutter") {
			fmt.Println("✗ (Flutter not installed. Required for web app deployment.)")
			results <- false
		} else {
			// fmt.Println("✓")
			results <- true
		}
	}()

	go func() {
		defer wg.Done()
		fmt.Print("  S3 bucket configuration validation... ")
		bucketName := "recipearchive-web-app-prod-990537043943"
		_, err := runCommand(projectRoot, "aws", "s3", "ls", "s3://"+bucketName)
		if err != nil {
			fmt.Println("⚠ (S3 bucket doesn't exist - will be created during deployment)")
			results <- true
		} else {
			_, err = runCommand(projectRoot, "aws", "s3api", "get-bucket-website", "--bucket", bucketName)
			if err != nil {
				fmt.Println("⚠ (S3 bucket exists but website hosting not configured)")
				fmt.Println("    Will be auto-configured during deployment")
				results <- true
			} else {
				// fmt.Println("✓")
				results <- true
			}
		}
	}()

	go func() {
		defer wg.Done()
		fmt.Print("  CloudFront distribution status... ")
		distributionID := "E1D19F7SLOJM5H"
		_, err := runCommand(projectRoot, "aws", "cloudfront", "get-distribution", "--id", distributionID)
		if err != nil {
			fmt.Printf("✗\n    Error: %v\n", err)
			fmt.Printf("    CloudFront distribution %s not found\n", distributionID)
			results <- false
		} else {
			//fmt.Println("✓")
			results <- true
		}
	}()

	go func() {
		defer wg.Done()
		fmt.Print("  API Gateway CORS configuration... ")
		envFilePath := filepath.Join(projectRoot, ".env")
		apiGatewayID := os.Getenv("API_GATEWAY_ID")

		if _, err := os.Stat(envFilePath); os.IsNotExist(err) || apiGatewayID == "" {
			fmt.Println("⚠ (API Gateway ID not configured in .env - skipping detailed check)")
			results <- true
		} else if err != nil {
			fmt.Printf("✗\n    Error checking .env file: %v\n", err)
			results <- false
		} else {
			fmt.Println("✓ (API Gateway ID found, detailed CORS check skipped)")
			results <- true
		}
	}()

	go func() {
		defer wg.Done()
		fmt.Print("  Flutter build compatibility test... ")
		recipeArchivePath := filepath.Join(projectRoot, "recipe_archive")
		if _, err := os.Stat(recipeArchivePath); os.IsNotExist(err) {
			fmt.Println("✗ (recipe_archive directory not found)")
			results <- false
		} else if err != nil {
			fmt.Printf("✗\n    Error checking recipe_archive directory: %v\n", err)
			results <- false
		} else {
			pubspecPath := filepath.Join(recipeArchivePath, "pubspec.yaml")
			if _, err := os.Stat(pubspecPath); os.IsNotExist(err) {
				fmt.Println("✗ (pubspec.yaml not found in recipe_archive directory)")
				results <- false
			} else if err != nil {
				fmt.Printf("✗\n    Error checking pubspec.yaml: %v\n", err)
				results <- false
			} else {
				if !checkCommand("flutter") {
					fmt.Println("✗ (Flutter not installed)")
					results <- false
				} else {
					out, err := runCommand(recipeArchivePath, "flutter", "doctor", "--version")
					if err != nil {
						fmt.Printf("✗\n    Error: %v\n    Output: %s\n", err, out)
						fmt.Println("    Flutter doctor failed - check Flutter installation")
						results <- false
					} else {
						// fmt.Println("✓")
						results <- true
					}
				}
			}
		}
	}()

	go func() {
		defer wg.Done()
		fmt.Print("  Deploy script validation... ")
		deployScriptPath := filepath.Join(projectRoot, "scripts", "web", "deploy.sh")

		if _, err := os.Stat(deployScriptPath); os.IsNotExist(err) {
			fmt.Println("✗ (Deploy script missing or not executable)")
			results <- false
		} else if err != nil {
			fmt.Printf("✗\n    Error checking deploy script: %v\n", err)
			results <- false
		} else {
			if info, _ := os.Stat(deployScriptPath); info.Mode().Perm()&0111 == 0 {
				fmt.Println("✗ (Deploy script not executable)")
				results <- false
			} else {
				// fmt.Println("✓")
				results <- true
			}
		}
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

// validateAPIEndpoints checks for the presence and configuration of critical API endpoints
func validateAPIEndpoints(projectRoot string, apiGatewayID string) bool {
	// Define critical path parts that should exist
	requiredPathParts := []struct {
		pathPart    string
		description string
	}{
		{"recipes", "Recipe management endpoint"},
		{"invitations", "Admin invitations endpoint"},
		{"{invitationId}", "Individual invitation endpoint"},
		{"summary", "Analytics summary endpoint"},
		{"events", "Analytics events endpoint"},
	}

	allValid := true

	for _, endpoint := range requiredPathParts {
		// Check if the resource exists in API Gateway
		out, err := runCommand(projectRoot, "aws", "apigateway", "get-resources",
			"--rest-api-id", apiGatewayID,
			"--query", fmt.Sprintf("items[?pathPart=='%s'].id", endpoint.pathPart),
			"--output", "text")

		if err != nil || strings.TrimSpace(out) == "" || strings.TrimSpace(out) == "None" {
			fmt.Printf("\n    ⚠ %s (%s) - resource not found", endpoint.description, endpoint.pathPart)
			allValid = false
		}
	}

	// Check for CORS configuration on recipes endpoint
	recipesResourceID := getResourceID(projectRoot, apiGatewayID, "recipes")
	if recipesResourceID != "" {
		_, err := runCommand(projectRoot, "aws", "apigateway", "get-method",
			"--rest-api-id", apiGatewayID,
			"--resource-id", recipesResourceID,
			"--http-method", "OPTIONS",
			"--query", "httpMethod",
			"--output", "text")

		if err != nil {
			fmt.Printf("\n    ⚠ CORS not configured for recipes endpoint")
			allValid = false
		}
	} else {
		fmt.Printf("\n    ⚠ Recipes resource not found")
		allValid = false
	}

	return allValid
}

// getLastPathSegment extracts the last path segment for API Gateway resource lookup
func getLastPathSegment(path string) string {
	if path == "/" {
		return ""
	}
	// Remove leading slash and split by slash
	path = strings.TrimPrefix(path, "/")
	parts := strings.Split(path, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return path
}

// getResourceID gets the resource ID for a given path part
func getResourceID(projectRoot string, apiGatewayID string, pathPart string) string {
	out, err := runCommand(projectRoot, "aws", "apigateway", "get-resources",
		"--rest-api-id", apiGatewayID,
		"--query", fmt.Sprintf("items[?pathPart=='%s'].id", pathPart),
		"--output", "text")

	if err != nil {
		return ""
	}
	out = strings.TrimSpace(out)
	if out == "" || out == "None" {
		return ""
	}
	return out
}
