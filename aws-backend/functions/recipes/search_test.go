package main

import (
	"testing"
)

// Test levenshteinDistance with identical strings
func TestLevenshteinDistance_Identical(t *testing.T) {
	distance := levenshteinDistance("hello", "hello")
	if distance != 0 {
		t.Errorf("Expected distance 0 for identical strings, got %d", distance)
	}
}

// Test levenshteinDistance with one empty string
func TestLevenshteinDistance_EmptyString(t *testing.T) {
	distance := levenshteinDistance("", "hello")
	if distance != 5 {
		t.Errorf("Expected distance 5, got %d", distance)
	}

	distance = levenshteinDistance("hello", "")
	if distance != 5 {
		t.Errorf("Expected distance 5, got %d", distance)
	}
}

// Test levenshteinDistance with single character difference
func TestLevenshteinDistance_SingleDifference(t *testing.T) {
	distance := levenshteinDistance("hello", "hallo")
	if distance != 1 {
		t.Errorf("Expected distance 1, got %d", distance)
	}
}

// Test levenshteinDistance with multiple differences
func TestLevenshteinDistance_MultipleDifferences(t *testing.T) {
	distance := levenshteinDistance("kitten", "sitting")
	if distance != 3 {
		t.Errorf("Expected distance 3, got %d", distance)
	}
}

// Test stem with plural forms
func TestStem_Plurals(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"drinks", "drink"},
		{"eggs", "egg"},
		{"berries", "berry"},
		{"tomatoes", "tomato"},
		{"dishes", "dish"},
		{"glasses", "glass"},
	}

	for _, tt := range tests {
		result := stem(tt.input)
		if result != tt.expected {
			t.Errorf("stem(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// Test stem with verb forms
func TestStem_Verbs(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"baking", "bak"},   // stem removes 'ing' but doesn't preserve final 'e'
		{"cooking", "cook"}, // 'cook' doesn't end in 'e'
		{"baked", "bak"},    // stem removes 'ed' but doesn't preserve final 'e'
		{"cooked", "cook"},  // 'cook' doesn't end in 'e'
	}

	for _, tt := range tests {
		result := stem(tt.input)
		if result != tt.expected {
			t.Errorf("stem(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// Test stem with short words (should not be stemmed)
func TestStem_ShortWords(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"egg", "egg"},
		{"tea", "tea"},
		{"pie", "pie"},
	}

	for _, tt := range tests {
		result := stem(tt.input)
		if result != tt.expected {
			t.Errorf("stem(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// Test stem with uppercase (should be lowercased)
func TestStem_Uppercase(t *testing.T) {
	result := stem("DRINKS")
	if result != "drink" {
		t.Errorf("stem(\"DRINKS\") = %q, expected \"drink\"", result)
	}
}

// Test min function
func TestMin(t *testing.T) {
	tests := []struct {
		a, b, c  int
		expected int
	}{
		{1, 2, 3, 1},
		{3, 2, 1, 1},
		{2, 1, 3, 1},
		{5, 5, 5, 5},
		{0, 10, 20, 0},
	}

	for _, tt := range tests {
		result := min(tt.a, tt.b, tt.c)
		if result != tt.expected {
			t.Errorf("min(%d, %d, %d) = %d, expected %d", tt.a, tt.b, tt.c, result, tt.expected)
		}
	}
}
