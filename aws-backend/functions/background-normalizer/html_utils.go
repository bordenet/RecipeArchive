package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/net/html"
)

// findElementBySelectors finds the first element matching any of the selectors
func findElementBySelectors(doc *html.Node, selectors []string) string {
	for _, selector := range selectors {
		if result := findElementByPattern(doc, selector); result != "" {
			return result
		}
	}
	return ""
}

// findListBySelectors finds all elements matching any of the selectors
func findListBySelectors(doc *html.Node, selectors []string) []string {
	for _, selector := range selectors {
		if result := findListByPattern(doc, selector); len(result) > 0 {
			return result
		}
	}
	return []string{}
}

// findElementByPattern finds element by CSS-like pattern
func findElementByPattern(doc *html.Node, pattern string) string {
	// Handle different patterns
	if strings.HasPrefix(pattern, ".") {
		className := strings.TrimPrefix(pattern, ".")
		return findByClassAndTag(doc, className, "")
	}
	if strings.HasPrefix(pattern, "#") {
		id := strings.TrimPrefix(pattern, "#")
		return findById(doc, id)
	}
	if strings.Contains(pattern, "[data-testid=") {
		start := strings.Index(pattern, "[data-testid=\"") + 14
		end := strings.Index(pattern[start:], "\"")
		if end > 0 {
			testId := pattern[start : start+end]
			return findByDataTestId(doc, testId)
		}
	}
	// Default to tag name
	return findByTag(doc, pattern)
}

// findListByPattern finds list elements by CSS-like pattern
func findListByPattern(doc *html.Node, pattern string) []string {
	if strings.HasPrefix(pattern, ".") {
		className := strings.TrimPrefix(pattern, ".")
		return findListByClass(doc, className)
	}
	// Add more pattern support as needed
	return []string{}
}

// findByClassAndTag finds element by class and optionally tag
func findByClassAndTag(doc *html.Node, className, tagName string) string {
	var traverse func(*html.Node) string
	traverse = func(n *html.Node) string {
		if n.Type == html.ElementNode {
			if (tagName == "" || n.Data == tagName) && hasClass(n, className) {
				return getTextContent(n)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if result := traverse(c); result != "" {
				return result
			}
		}
		return ""
	}
	return traverse(doc)
}

// findById finds element by ID attribute
func findById(doc *html.Node, id string) string {
	var traverse func(*html.Node) string
	traverse = func(n *html.Node) string {
		if n.Type == html.ElementNode {
			for _, attr := range n.Attr {
				if attr.Key == "id" && attr.Val == id {
					return getTextContent(n)
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if result := traverse(c); result != "" {
				return result
			}
		}
		return ""
	}
	return traverse(doc)
}

// findByDataTestId finds element by data-testid attribute
func findByDataTestId(doc *html.Node, testId string) string {
	var traverse func(*html.Node) string
	traverse = func(n *html.Node) string {
		if n.Type == html.ElementNode {
			for _, attr := range n.Attr {
				if attr.Key == "data-testid" && attr.Val == testId {
					return getTextContent(n)
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if result := traverse(c); result != "" {
				return result
			}
		}
		return ""
	}
	return traverse(doc)
}

// findByTag finds first element by tag name
func findByTag(doc *html.Node, tagName string) string {
	var traverse func(*html.Node) string
	traverse = func(n *html.Node) string {
		if n.Type == html.ElementNode && n.Data == tagName {
			return getTextContent(n)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if result := traverse(c); result != "" {
				return result
			}
		}
		return ""
	}
	return traverse(doc)
}

// findListByClass finds all elements with specific class
func findListByClass(doc *html.Node, className string) []string {
	var results []string
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode && hasClass(n, className) {
			if text := getTextContent(n); text != "" {
				results = append(results, text)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(doc)
	return results
}

// findAllByClass finds all elements with specific class (helper function)
func findAllByClass(doc *html.Node, className string) []string {
	return findListByClass(doc, className)
}

// hasClass checks if node has specific CSS class
func hasClass(n *html.Node, className string) bool {
	for _, attr := range n.Attr {
		if attr.Key == "class" {
			classes := strings.Fields(attr.Val)
			for _, class := range classes {
				if class == className {
					return true
				}
			}
		}
	}
	return false
}

// getTextContent extracts text content from HTML node
func getTextContent(n *html.Node) string {
	if n.Type == html.TextNode {
		return strings.TrimSpace(n.Data)
	}
	var text strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		text.WriteString(getTextContent(c))
	}
	return strings.TrimSpace(text.String())
}

// parseDuration converts duration string to minutes
func parseDuration(duration string) int {
	if duration == "" {
		return 0
	}

	// Handle ISO 8601 format (PT15M, PT1H30M, etc.)
	if strings.HasPrefix(duration, "PT") {
		duration = strings.TrimPrefix(duration, "PT")
		minutes := 0

		// Parse hours
		if strings.Contains(duration, "H") {
			parts := strings.Split(duration, "H")
			if len(parts) > 0 {
				if hours, err := strconv.Atoi(parts[0]); err == nil {
					minutes += hours * 60
				}
			}
			if len(parts) > 1 {
				duration = parts[1]
			}
		}

		// Parse minutes
		if strings.Contains(duration, "M") {
			parts := strings.Split(duration, "M")
			if len(parts) > 0 {
				if mins, err := strconv.Atoi(parts[0]); err == nil {
					minutes += mins
				}
			}
		}

		return minutes
	}

	// Handle common text formats
	duration = strings.ToLower(duration)
	duration = strings.ReplaceAll(duration, " ", "")

	total := 0

	// Extract hours
	if strings.Contains(duration, "hour") || strings.Contains(duration, "hr") {
		re := regexp.MustCompile(`(\d+)\s*(?:hours?|hrs?)`)
		matches := re.FindStringSubmatch(duration)
		if len(matches) > 1 {
			if hours, err := strconv.Atoi(matches[1]); err == nil {
				total += hours * 60
			}
		}
	}

	// Extract minutes
	if strings.Contains(duration, "min") {
		re := regexp.MustCompile(`(\d+)\s*(?:minutes?|mins?)`)
		matches := re.FindStringSubmatch(duration)
		if len(matches) > 1 {
			if minutes, err := strconv.Atoi(matches[1]); err == nil {
				total += minutes
			}
		}
	}

	// If no specific format found, try to extract any number
	if total == 0 {
		re := regexp.MustCompile(`(\d+)`)
		matches := re.FindStringSubmatch(duration)
		if len(matches) > 1 {
			if number, err := strconv.Atoi(matches[1]); err == nil {
				total = number
			}
		}
	}

	return total
}

// parseServings converts yield/servings to integer
func parseServings(yield interface{}) int {
	if yield == nil {
		return 0
	}

	switch v := yield.(type) {
	case string:
		// Try to extract number from string
		re := regexp.MustCompile(`(\d+)`)
		matches := re.FindStringSubmatch(v)
		if len(matches) > 1 {
			if servings, err := strconv.Atoi(matches[1]); err == nil {
				return servings
			}
		}
		return 0
	case float64:
		return int(v)
	case int:
		return v
	default:
		// Try to convert to string and parse
		str := fmt.Sprintf("%v", yield)
		return parseServings(str)
	}
}