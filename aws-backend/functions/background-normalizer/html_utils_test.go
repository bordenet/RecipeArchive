package main

import (
	"strings"
	"testing"

	"golang.org/x/net/html"
)

// Helper function to parse HTML string
func parseHTML(htmlStr string) *html.Node {
	doc, err := html.Parse(strings.NewReader(htmlStr))
	if err != nil {
		panic(err)
	}
	return doc
}

// Test findElementBySelectors with class selector
func TestFindElementBySelectors_ClassSelector(t *testing.T) {
	htmlStr := `<html><body><div class="recipe-title">Chocolate Cake</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findElementBySelectors(doc, []string{".recipe-title"})
	if result != "Chocolate Cake" {
		t.Errorf("Expected 'Chocolate Cake', got '%s'", result)
	}
}

// Test findElementBySelectors with ID selector
func TestFindElementBySelectors_IDSelector(t *testing.T) {
	htmlStr := `<html><body><div id="main-title">Pasta Recipe</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findElementBySelectors(doc, []string{"#main-title"})
	if result != "Pasta Recipe" {
		t.Errorf("Expected 'Pasta Recipe', got '%s'", result)
	}
}

// Test findElementBySelectors with tag selector
func TestFindElementBySelectors_TagSelector(t *testing.T) {
	htmlStr := `<html><body><h1>Recipe Title</h1></body></html>`
	doc := parseHTML(htmlStr)

	result := findElementBySelectors(doc, []string{"h1"})
	if result != "Recipe Title" {
		t.Errorf("Expected 'Recipe Title', got '%s'", result)
	}
}

// Test findElementBySelectors with multiple selectors (first match wins)
func TestFindElementBySelectors_MultipleSelectors(t *testing.T) {
	htmlStr := `<html><body><div class="title">First</div><div id="second">Second</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findElementBySelectors(doc, []string{".title", "#second"})
	if result != "First" {
		t.Errorf("Expected 'First', got '%s'", result)
	}
}

// Test findElementBySelectors with no match
func TestFindElementBySelectors_NoMatch(t *testing.T) {
	htmlStr := `<html><body><div>Content</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findElementBySelectors(doc, []string{".nonexistent"})
	if result != "" {
		t.Errorf("Expected empty string, got '%s'", result)
	}
}

// Test findListBySelectors with class selector
func TestFindListBySelectors_ClassSelector(t *testing.T) {
	htmlStr := `<html><body>
		<div class="ingredient">Flour</div>
		<div class="ingredient">Sugar</div>
		<div class="ingredient">Eggs</div>
	</body></html>`
	doc := parseHTML(htmlStr)

	result := findListBySelectors(doc, []string{".ingredient"})
	if len(result) != 3 {
		t.Errorf("Expected 3 ingredients, got %d", len(result))
	}
	if result[0] != "Flour" {
		t.Errorf("Expected first ingredient 'Flour', got '%s'", result[0])
	}
}

// Test findListBySelectors with no match
func TestFindListBySelectors_NoMatch(t *testing.T) {
	htmlStr := `<html><body><div>Content</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findListBySelectors(doc, []string{".nonexistent"})
	if len(result) != 0 {
		t.Errorf("Expected empty list, got %d items", len(result))
	}
}

// Test hasClass helper
func TestHasClass(t *testing.T) {
	htmlStr := `<html><body><div class="recipe-card featured">Content</div></body></html>`
	doc := parseHTML(htmlStr)

	// Find the div element
	var divNode *html.Node
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "div" {
			divNode = n
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(doc)

	if divNode == nil {
		t.Fatal("Could not find div element")
	}

	if !hasClass(divNode, "recipe-card") {
		t.Error("Expected div to have class 'recipe-card'")
	}
	if !hasClass(divNode, "featured") {
		t.Error("Expected div to have class 'featured'")
	}
	if hasClass(divNode, "nonexistent") {
		t.Error("Expected div not to have class 'nonexistent'")
	}
}

// Test getTextContent
func TestGetTextContent(t *testing.T) {
	htmlStr := `<html><body><div>Hello <span>World</span>!</div></body></html>`
	doc := parseHTML(htmlStr)

	// Find the div element
	var divNode *html.Node
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "div" {
			divNode = n
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(doc)

	if divNode == nil {
		t.Fatal("Could not find div element")
	}

	text := getTextContent(divNode)
	// getTextContent concatenates text without preserving spaces
	expected := "HelloWorld!"
	if text != expected {
		t.Errorf("Expected '%s', got '%s'", expected, text)
	}
}
