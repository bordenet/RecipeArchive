package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/fatih/color"
)

// handleDelete processes the delete operation with user confirmation
func handleDelete(extensions, flutter, all bool, since, bucket string) {
	// Color helpers
	red := color.New(color.FgRed, color.Bold).SprintFunc()
	yellow := color.New(color.FgYellow).SprintFunc()
	cyan := color.New(color.FgCyan).SprintFunc()
	green := color.New(color.FgGreen).SprintFunc()

	fmt.Printf("\n%s\n", red("⚠️  DIAGNOSTIC DATA DELETION"))
	fmt.Printf("%s\n\n", strings.Repeat("━", 80))

	// Parse time window
	duration, err := parseDuration(since)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Invalid time window: %v\n", err)
		os.Exit(1)
	}

	// Initialize AWS client
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to load AWS config: %v\n", err)
		os.Exit(1)
	}

	s3Client := s3.NewFromConfig(cfg)
	ctx := context.Background()

	// Determine what to delete
	deleteExtensions := extensions || all
	deleteFlutter := flutter || all

	if !deleteExtensions && !deleteFlutter {
		fmt.Fprintf(os.Stderr, "❌ Please specify at least one data source: -extensions, -flutter, or -all\n")
		fmt.Fprintf(os.Stderr, "💡 Note: Lambda diagnostics are in CloudWatch Logs and cannot be deleted via this tool\n")
		os.Exit(1)
	}

	// Collect files to delete
	var filesToDelete []string
	cutoffTime := time.Now().Add(-duration)

	if deleteExtensions {
		fmt.Printf("🔍 Scanning web extension diagnostics...\n")
		files, err := listS3Files(ctx, s3Client, bucket, "web-extension-errors/", cutoffTime)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to scan extension diagnostics: %v\n", err)
			os.Exit(1)
		}
		filesToDelete = append(filesToDelete, files...)
		fmt.Printf("   Found %s extension diagnostic files\n", cyan(len(files)))
	}

	if deleteFlutter {
		fmt.Printf("🔍 Scanning Flutter app diagnostics...\n")
		files, err := listS3Files(ctx, s3Client, bucket, "flutter-console-errors/", cutoffTime)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to scan Flutter diagnostics: %v\n", err)
			os.Exit(1)
		}
		filesToDelete = append(filesToDelete, files...)
		fmt.Printf("   Found %s Flutter diagnostic files\n", cyan(len(files)))
	}

	if len(filesToDelete) == 0 {
		fmt.Printf("\n%s\n", green("✨ No diagnostic files found in the specified time window"))
		return
	}

	// Display summary
	fmt.Printf("\n%s\n", yellow("📋 DELETION SUMMARY"))
	fmt.Printf("   Total files to delete: %s\n", red(len(filesToDelete)))
	fmt.Printf("   Time window: %s\n", cyan(since))
	fmt.Printf("   Bucket: %s\n", cyan(bucket))

	if deleteExtensions {
		fmt.Printf("   Sources: %s\n", yellow("Web Extensions"))
	}
	if deleteFlutter {
		if deleteExtensions {
			fmt.Printf("            %s\n", yellow("Flutter Apps"))
		} else {
			fmt.Printf("   Sources: %s\n", yellow("Flutter Apps"))
		}
	}

	// Show sample of files to be deleted (first 10)
	fmt.Printf("\n%s\n", yellow("📝 Sample files (first 10):"))
	sampleCount := 10
	if len(filesToDelete) < sampleCount {
		sampleCount = len(filesToDelete)
	}
	for i := 0; i < sampleCount; i++ {
		fmt.Printf("   %d. %s\n", i+1, filesToDelete[i])
	}
	if len(filesToDelete) > 10 {
		fmt.Printf("   ... and %d more files\n", len(filesToDelete)-10)
	}

	// Confirmation prompt
	fmt.Printf("\n%s\n", red("⚠️  WARNING: This action CANNOT be undone!"))
	fmt.Printf("%s\n", yellow("All diagnostic data will be permanently deleted from S3."))
	fmt.Printf("\nType %s to confirm deletion: ", cyan("DELETE"))

	reader := bufio.NewReader(os.Stdin)
	confirmation, err := reader.ReadString('\n')
	if err != nil {
		fmt.Fprintf(os.Stderr, "\n❌ Failed to read confirmation: %v\n", err)
		os.Exit(1)
	}

	confirmation = strings.TrimSpace(confirmation)

	if confirmation != "DELETE" {
		fmt.Printf("\n%s\n", yellow("❌ Deletion cancelled (confirmation did not match)"))
		fmt.Printf("You entered: %q\n", confirmation)
		fmt.Printf("Required: %q\n", "DELETE")
		os.Exit(0)
	}

	// Perform deletion
	fmt.Printf("\n🗑️  Deleting diagnostic files...\n")

	deletedCount := 0
	failedCount := 0

	for i, key := range filesToDelete {
		_, err := s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})

		if err != nil {
			fmt.Fprintf(os.Stderr, "⚠️  Failed to delete %s: %v\n", key, err)
			failedCount++
		} else {
			deletedCount++
			// Show progress every 10 files
			if (i+1)%10 == 0 || i == len(filesToDelete)-1 {
				fmt.Printf("   Progress: %d/%d files deleted\n", deletedCount, len(filesToDelete))
			}
		}
	}

	// Summary
	fmt.Printf("\n%s\n", strings.Repeat("━", 80))
	if failedCount == 0 {
		fmt.Printf("%s %s\n", green("✅ Deletion complete!"), cyan(fmt.Sprintf("Deleted %d files", deletedCount)))
	} else {
		fmt.Printf("%s\n", yellow("⚠️  Deletion completed with errors"))
		fmt.Printf("   Successfully deleted: %s\n", green(deletedCount))
		fmt.Printf("   Failed to delete: %s\n", red(failedCount))
	}
	fmt.Printf("\n")
}

// listS3Files returns a list of S3 keys matching the prefix and time criteria
func listS3Files(ctx context.Context, client *s3.Client, bucket, prefix string, cutoffTime time.Time) ([]string, error) {
	var files []string

	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(prefix),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list objects: %w", err)
		}

		for _, obj := range page.Contents {
			if obj.Key == nil || strings.HasSuffix(*obj.Key, "/") {
				continue
			}

			// Check if object is within time window
			if obj.LastModified != nil && obj.LastModified.Before(cutoffTime) {
				continue
			}

			files = append(files, *obj.Key)
		}
	}

	return files, nil
}

// listS3FilesWithMetadata returns detailed info about S3 files (for potential future use)
func listS3FilesWithMetadata(ctx context.Context, client *s3.Client, bucket, prefix string, cutoffTime time.Time) ([]types.Object, error) {
	var objects []types.Object

	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(prefix),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list objects: %w", err)
		}

		for _, obj := range page.Contents {
			if obj.Key == nil || strings.HasSuffix(*obj.Key, "/") {
				continue
			}

			// Check if object is within time window
			if obj.LastModified != nil && obj.LastModified.Before(cutoffTime) {
				continue
			}

			objects = append(objects, obj)
		}
	}

	return objects, nil
}
