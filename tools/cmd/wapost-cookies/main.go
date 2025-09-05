package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
	"github.com/sirupsen/logrus"
)

// Cookie represents a browser cookie
type Cookie struct {
	Name     string  `json:"name"`
	Value    string  `json:"value"`
	Domain   string  `json:"domain"`
	Path     string  `json:"path"`
	Expires  float64 `json:"expires,omitempty"`
	HTTPOnly bool    `json:"httpOnly"`
	Secure   bool    `json:"secure"`
	SameSite string  `json:"sameSite,omitempty"`
}

// AuthResult represents the authentication check result
type AuthResult struct {
	HasPaywall       bool   `json:"hasPaywall"`
	HasRecipeContent bool   `json:"hasRecipeContent"`
	Title            string `json:"title"`
	URL              string `json:"url"`
}

func main() {
	// Set up logging
	logrus.SetLevel(logrus.InfoLevel)
	logrus.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	// Find project root dynamically
	projectRoot, err := findProjectRoot()
	if err != nil {
		logrus.Fatalf("Failed to find project root: %v", err)
	}

	cookiesFile := filepath.Join(projectRoot, "config", "wapost-subscription-cookies.json")

	fmt.Println("🔐 Washington Post Cookie Capture (Go Edition)")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// Set up Chrome context
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false), // Keep browser visible
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.UserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	// Set timeout
	ctx, cancel = context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	err = captureWashingtonPostCookies(ctx, cookiesFile)
	if err != nil {
		logrus.Fatalf("Cookie capture failed: %v", err)
	}

	fmt.Println("\n✅ COOKIE CAPTURE COMPLETE!")
	fmt.Println("🎉 You can now close the browser window manually when ready.")
	fmt.Println("💡 The browser will stay open for your convenience.")
	fmt.Println("📝 Press Ctrl+C in this terminal when you're done.")

	// Keep the program running
	select {}
}

func captureWashingtonPostCookies(ctx context.Context, cookiesFile string) error {
	logrus.Info("🌐 Opening Washington Post login page...")

	// Navigate to login page
	err := chromedp.Run(ctx,
		chromedp.Navigate("https://www.washingtonpost.com/subscribe/signin/"),
		chromedp.WaitVisible("body", chromedp.ByQuery),
	)
	if err != nil {
		return fmt.Errorf("failed to navigate to login page: %w", err)
	}

	fmt.Println("\n📋 INSTRUCTIONS:")
	fmt.Println("1. ✅ Log in with your Washington Post subscription credentials in the browser window")
	fmt.Println("2. ✅ Navigate to any recipe page to verify access")
	fmt.Println("3. ✅ Press ENTER in this terminal when you're logged in and ready")
	fmt.Println("4. ✅ I will then save your authentication cookies for future use")

	// Wait for user confirmation
	fmt.Print("Press ENTER when you're logged in: ")
	reader := bufio.NewReader(os.Stdin)
	_, err = reader.ReadString('\n')
	if err != nil {
		return fmt.Errorf("failed to read user input: %w", err)
	}

	logrus.Info("🔍 Checking authentication status...")

	// Navigate to a test recipe page
	testURL := "https://www.washingtonpost.com/recipes/chili-oil-noodles-steamed-bok-choy/"
	var authResult AuthResult

	err = chromedp.Run(ctx,
		chromedp.Navigate(testURL),
		chromedp.WaitVisible("body", chromedp.ByQuery),
		chromedp.Sleep(2*time.Second),
		chromedp.Evaluate(`(() => {
			const content = document.body.textContent.toLowerCase();
			const paywall = content.includes('subscribe') && content.includes('already a subscriber');
			const authenticated = content.includes('ingredients') || content.includes('instructions') || content.includes('recipe');
			
			return {
				hasPaywall: paywall,
				hasRecipeContent: authenticated,
				title: document.title,
				url: window.location.href
			};
		})()`, &authResult),
	)
	if err != nil {
		return fmt.Errorf("failed to check authentication: %w", err)
	}

	fmt.Println("📊 Authentication check results:")
	fmt.Printf("   Has recipe content: %t\n", authResult.HasRecipeContent)
	fmt.Printf("   Has paywall: %t\n", authResult.HasPaywall)
	fmt.Printf("   Page title: %s\n", authResult.Title)

	if authResult.HasRecipeContent && !authResult.HasPaywall {
		logrus.Info("✅ Successfully authenticated! Saving cookies...")

		// Get all cookies
		var cookies []*Cookie
		err = chromedp.Run(ctx,
			chromedp.ActionFunc(func(ctx context.Context) error {
				chromeCookies, err := network.GetCookies().Do(ctx)
				if err != nil {
					return err
				}

				for _, cookie := range chromeCookies {
					cookies = append(cookies, &Cookie{
						Name:     cookie.Name,
						Value:    cookie.Value,
						Domain:   cookie.Domain,
						Path:     cookie.Path,
						Expires:  cookie.Expires,
						HTTPOnly: cookie.HTTPOnly,
						Secure:   cookie.Secure,
						SameSite: cookie.SameSite.String(),
					})
				}
				return nil
			}),
		)
		if err != nil {
			return fmt.Errorf("failed to get cookies: %w", err)
		}

		// Save cookies to file
		cookiesJSON, err := json.MarshalIndent(cookies, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal cookies: %w", err)
		}

		err = os.WriteFile(cookiesFile, cookiesJSON, 0644)
		if err != nil {
			return fmt.Errorf("failed to write cookies file: %w", err)
		}

		fmt.Printf("💾 Saved %d authentication cookies to: %s\n", len(cookies), cookiesFile)
		fmt.Println("🎉 Cookie capture complete! You can now run automated tests.")

		// Show important cookies (without values for security)
		importantCookies := make([]*Cookie, 0)
		for _, cookie := range cookies {
			if strings.Contains(cookie.Name, "wp_") ||
				strings.Contains(cookie.Name, "session") ||
				strings.Contains(cookie.Name, "auth") ||
				strings.Contains(cookie.Name, "user") {
				importantCookies = append(importantCookies, cookie)
			}
		}

		fmt.Printf("\n🔑 Captured %d authentication-related cookies:\n", len(importantCookies))
		for _, cookie := range importantCookies {
			fmt.Printf("   %s (%s)\n", cookie.Name, cookie.Domain)
		}

	} else {
		logrus.Error("❌ Authentication failed or paywall still present.")
		logrus.Error("   Please ensure you're properly logged in with your subscription.")
		return fmt.Errorf("authentication verification failed")
	}

	return nil
}

func findProjectRoot() (string, error) {
	// Start from current directory and walk up to find project root
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		// Check if this directory contains package.json (project root indicator)
		packageJSON := filepath.Join(dir, "package.json")
		if _, err := os.Stat(packageJSON); err == nil {
			return dir, nil
		}

		// Check if this directory contains go.mod (fallback for go modules)
		goMod := filepath.Join(dir, "go.mod")
		if _, err := os.Stat(goMod); err == nil {
			return filepath.Dir(dir), nil // Go up one level from tools directory
		}

		// Move up one directory
		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached filesystem root
			break
		}
		dir = parent
	}

	return "", fmt.Errorf("project root not found")
}
