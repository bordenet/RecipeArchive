package main

import (
	"testing"
)

// Test detectCookingMethods with multi-method recipe
func TestDetectCookingMethods_MultiMethod(t *testing.T) {
	instructions := []Instruction{
		{Text: "Heat oil in a pot and sauté onions"},
		{Text: "Transfer to slow cooker"},
		{Text: "Cook on low for 6 hours"},
	}

	if !detectCookingMethods(instructions) {
		t.Error("Expected multi-method to be detected")
	}
}

// Test detectCookingMethods with only stovetop
func TestDetectCookingMethods_StovetopOnly(t *testing.T) {
	instructions := []Instruction{
		{Text: "Heat oil in a pot"},
		{Text: "Bring to a boil"},
		{Text: "Simmer for 20 minutes"},
	}

	if detectCookingMethods(instructions) {
		t.Error("Expected single method to be detected, not multi")
	}
}

// Test detectCookingMethods with only slow cooker
func TestDetectCookingMethods_SlowCookerOnly(t *testing.T) {
	instructions := []Instruction{
		{Text: "Add ingredients to slow cooker"},
		{Text: "Cook on low for 8 hours"},
	}

	if detectCookingMethods(instructions) {
		t.Error("Expected single method to be detected, not multi")
	}
}

// Test containsMethodKeywords with matching text
func TestContainsMethodKeywords_Match(t *testing.T) {
	testCases := []string{
		"For stovetop, heat the pan",
		"Add to slow cooker and cook",
		"Heat olive oil in pan",
		"Cook on low for 6 hours",
		"Bring to a boil then reduce heat",
	}

	for _, tc := range testCases {
		if !containsMethodKeywords(tc) {
			t.Errorf("Expected '%s' to contain method keywords", tc)
		}
	}
}

// Test containsMethodKeywords with no match
func TestContainsMethodKeywords_NoMatch(t *testing.T) {
	if containsMethodKeywords("Mix flour and sugar") {
		t.Error("Expected 'Mix flour and sugar' not to contain method keywords")
	}
}

// Test splitInstructionsByMethod
func TestSplitInstructionsByMethod_Mixed(t *testing.T) {
	instructions := []Instruction{
		{Text: "Heat oil in a pot and sauté onions"},
		{Text: "Transfer to slow cooker"},
		{Text: "Cook on low for 6 hours"},
		{Text: "Serve and enjoy"},
	}

	stovetop, slowCooker := splitInstructionsByMethod(instructions)

	if len(stovetop) == 0 {
		t.Error("Expected stovetop instructions")
	}

	if len(slowCooker) == 0 {
		t.Error("Expected slow cooker instructions")
	}
}

// Test splitInstructionsByMethod with crockpot variant
func TestSplitInstructionsByMethod_Crockpot(t *testing.T) {
	instructions := []Instruction{
		{Text: "Add all ingredients to crockpot"},
	}

	_, slowCooker := splitInstructionsByMethod(instructions)

	if len(slowCooker) != 1 {
		t.Errorf("Expected 1 slow cooker instruction, got %d", len(slowCooker))
	}
}

// Test splitInstructionsByMethod with neutral instructions
func TestSplitInstructionsByMethod_Neutral(t *testing.T) {
	instructions := []Instruction{
		{Text: "Mix all ingredients together"},
	}

	stovetop, slowCooker := splitInstructionsByMethod(instructions)

	// Neutral instructions should be added to both
	if len(stovetop) != 1 {
		t.Errorf("Expected neutral instruction in stovetop, got %d", len(stovetop))
	}
	if len(slowCooker) != 1 {
		t.Errorf("Expected neutral instruction in slow cooker, got %d", len(slowCooker))
	}
}

