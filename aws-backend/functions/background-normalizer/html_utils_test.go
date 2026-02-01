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

// Test parseDuration with ISO 8601 format
func TestParseDuration_ISO8601(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"PT15M", 15},
		{"PT30M", 30},
		{"PT1H", 60},
		{"PT1H30M", 90},
		{"PT2H15M", 135},
		{"", 0},
	}

	for _, tt := range tests {
		result := parseDuration(tt.input)
		if result != tt.expected {
			t.Errorf("parseDuration(%q) = %d, expected %d", tt.input, result, tt.expected)
		}
	}
}

// Test parseDuration with text formats
func TestParseDuration_TextFormat(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"30 minutes", 30},
		{"1 hour", 60},
		{"1 hour 30 minutes", 90},
		{"2 hrs 15 mins", 135},
		{"45 min", 45},
	}

	for _, tt := range tests {
		result := parseDuration(tt.input)
		if result != tt.expected {
			t.Errorf("parseDuration(%q) = %d, expected %d", tt.input, result, tt.expected)
		}
	}
}

// Test parseDuration with just a number
func TestParseDuration_JustNumber(t *testing.T) {
	result := parseDuration("45")
	if result != 45 {
		t.Errorf("parseDuration(\"45\") = %d, expected 45", result)
	}
}

// Test parseServings with string input
func TestParseServings_String(t *testing.T) {
	tests := []struct {
		input    interface{}
		expected int
	}{
		{"4 servings", 4},
		{"6", 6},
		{"Makes 8", 8},
		{"Serves 12", 12},
		{"", 0},
	}

	for _, tt := range tests {
		result := parseServings(tt.input)
		if result != tt.expected {
			t.Errorf("parseServings(%v) = %d, expected %d", tt.input, result, tt.expected)
		}
	}
}

// Test parseServings with numeric input
func TestParseServings_Numeric(t *testing.T) {
	// Test float64
	result := parseServings(float64(6))
	if result != 6 {
		t.Errorf("parseServings(float64(6)) = %d, expected 6", result)
	}

	// Test int
	result = parseServings(4)
	if result != 4 {
		t.Errorf("parseServings(4) = %d, expected 4", result)
	}
}

// Test parseServings with nil
func TestParseServings_Nil(t *testing.T) {
	result := parseServings(nil)
	if result != 0 {
		t.Errorf("parseServings(nil) = %d, expected 0", result)
	}
}

// Test findByDataTestId
func TestFindByDataTestId(t *testing.T) {
	htmlStr := `<html><body><div data-testid="recipe-title">Test Recipe</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findByDataTestId(doc, "recipe-title")
	if result != "Test Recipe" {
		t.Errorf("Expected 'Test Recipe', got '%s'", result)
	}
}

// Test findByDataTestId with no match
func TestFindByDataTestId_NoMatch(t *testing.T) {
	htmlStr := `<html><body><div>Content</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findByDataTestId(doc, "nonexistent")
	if result != "" {
		t.Errorf("Expected empty string, got '%s'", result)
	}
}

// Test findElementByPattern with data-testid
func TestFindElementByPattern_DataTestId(t *testing.T) {
	htmlStr := `<html><body><div data-testid="my-element">Found It</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findElementByPattern(doc, `[data-testid="my-element"]`)
	if result != "Found It" {
		t.Errorf("Expected 'Found It', got '%s'", result)
	}
}

// Test findById
func TestFindById(t *testing.T) {
	htmlStr := `<html><body><div id="my-id">ID Content</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findById(doc, "my-id")
	if result != "ID Content" {
		t.Errorf("Expected 'ID Content', got '%s'", result)
	}
}

// Test findById with no match
func TestFindById_NoMatch(t *testing.T) {
	htmlStr := `<html><body><div>Content</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findById(doc, "nonexistent")
	if result != "" {
		t.Errorf("Expected empty string, got '%s'", result)
	}
}

// Test findByTag
func TestFindByTag(t *testing.T) {
	htmlStr := `<html><body><article>Article Content</article></body></html>`
	doc := parseHTML(htmlStr)

	result := findByTag(doc, "article")
	if result != "Article Content" {
		t.Errorf("Expected 'Article Content', got '%s'", result)
	}
}

// Test findByTag with no match
func TestFindByTag_NoMatch(t *testing.T) {
	htmlStr := `<html><body><div>Content</div></body></html>`
	doc := parseHTML(htmlStr)

	result := findByTag(doc, "article")
	if result != "" {
		t.Errorf("Expected empty string, got '%s'", result)
	}
}
