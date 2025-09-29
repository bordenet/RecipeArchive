package main

import (
	"strings"
)

// detectCookingMethods scans all instructions to identify cooking method patterns
// TODO: Add support for grilling versus stovetop versus oven
func detectCookingMethods(instructions []Instruction) bool {
	slowCookerCount := 0
	stovetopCount := 0

	for _, inst := range instructions {
		text := strings.ToLower(inst.Text)

		// Check for slow cooker indicators (including crockpot variants)
		if strings.Contains(text, "slow cooker") ||
			strings.Contains(text, "crockpot") ||
			strings.Contains(text, "crock pot") ||
			strings.Contains(text, "cook on low") ||
			strings.Contains(text, "cook on high") {
			slowCookerCount++
		}

		// Check for stovetop indicators
		if strings.Contains(text, "simmer") ||
			strings.Contains(text, "sauté") ||
			strings.Contains(text, "saute") ||
			strings.Contains(text, "in a pot") ||
			strings.Contains(text, "heat oil") ||
			strings.Contains(text, "bring to a boil") {
			stovetopCount++
		}
	}

	// If we have indicators for both methods, it's multi-method
	return slowCookerCount > 0 && stovetopCount > 0
}

// containsMethodKeywords checks if an instruction contains method-specific keywords
func containsMethodKeywords(text string) bool {
	lowerText := strings.ToLower(text)
	methodKeywords := []string{
		"for stovetop", "for slow cooker", "for crockpot", "for crock pot", "for oven", "for instant pot",
		"stovetop method", "slow cooker method", "crockpot method", "crock pot method", "oven method",
		"heat olive oil", "heat oil", "add broth", "bring to a boil",
		"add to slow cooker", "add to crockpot", "add to crock pot", "cook on low", "cook on high",
	}

	for _, keyword := range methodKeywords {
		if strings.Contains(lowerText, keyword) {
			return true
		}
	}
	return false
}

// splitInstructionsByMethod separates instructions into cooking method groups
func splitInstructionsByMethod(instructions []Instruction) ([]Instruction, []Instruction) {
	stovetopSteps := []Instruction{}
	slowCookerSteps := []Instruction{}

	for _, inst := range instructions {
		text := strings.ToLower(inst.Text)

		// Check for slow cooker steps
		if strings.Contains(text, "slow cooker") ||
			strings.Contains(text, "crockpot") ||
			strings.Contains(text, "crock pot") ||
			strings.Contains(text, "cook on low") ||
			strings.Contains(text, "cook on high") {
			slowCookerSteps = append(slowCookerSteps, inst)
			continue
		}

		// Check for stovetop steps
		if strings.Contains(text, "simmer") ||
			strings.Contains(text, "sauté") ||
			strings.Contains(text, "saute") ||
			strings.Contains(text, "in a pot") ||
			strings.Contains(text, "heat oil") ||
			strings.Contains(text, "bring to a boil") {
			stovetopSteps = append(stovetopSteps, inst)
			continue
		}

		// If unsure, add to both methods
		slowCookerSteps = append(slowCookerSteps, inst)
		stovetopSteps = append(stovetopSteps, inst)
	}

	return stovetopSteps, slowCookerSteps
}
