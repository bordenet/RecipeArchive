package main

import (
	"recipe-archive/models"
)

// SortSearchResults sorts a slice of recipes by the specified criteria
func SortSearchResults(recipes []models.Recipe, sortBy, sortOrder string) {
	if len(recipes) <= 1 {
		return
	}

	// Default to sorting by creation date (newest first)
	if sortBy == "" {
		sortBy = "createdAt"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	// Implement sorting logic
	switch sortBy {
	case "title":
		if sortOrder == "desc" {
			// Sort titles Z-A
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					if recipes[i].Title < recipes[j].Title {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		} else {
			// Sort titles A-Z
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					if recipes[i].Title > recipes[j].Title {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		}
	case "prepTime":
		if sortOrder == "desc" {
			// Sort prep time high to low
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					iPrepTime := 0
					if recipes[i].PrepTimeMinutes != nil {
						iPrepTime = *recipes[i].PrepTimeMinutes
					}
					jPrepTime := 0
					if recipes[j].PrepTimeMinutes != nil {
						jPrepTime = *recipes[j].PrepTimeMinutes
					}
					if iPrepTime < jPrepTime {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		} else {
			// Sort prep time low to high
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					iPrepTime := 999999 // Put nil values at the end for ascending
					if recipes[i].PrepTimeMinutes != nil {
						iPrepTime = *recipes[i].PrepTimeMinutes
					}
					jPrepTime := 999999
					if recipes[j].PrepTimeMinutes != nil {
						jPrepTime = *recipes[j].PrepTimeMinutes
					}
					if iPrepTime > jPrepTime {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		}
	case "cookTime":
		if sortOrder == "desc" {
			// Sort cook time high to low
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					iCookTime := 0
					if recipes[i].CookTimeMinutes != nil {
						iCookTime = *recipes[i].CookTimeMinutes
					}
					jCookTime := 0
					if recipes[j].CookTimeMinutes != nil {
						jCookTime = *recipes[j].CookTimeMinutes
					}
					if iCookTime < jCookTime {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		} else {
			// Sort cook time low to high
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					iCookTime := 999999 // Put nil values at the end for ascending
					if recipes[i].CookTimeMinutes != nil {
						iCookTime = *recipes[i].CookTimeMinutes
					}
					jCookTime := 999999
					if recipes[j].CookTimeMinutes != nil {
						jCookTime = *recipes[j].CookTimeMinutes
					}
					if iCookTime > jCookTime {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		}
	case "servings":
		if sortOrder == "desc" {
			// Sort servings high to low
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					iServings := 0
					if recipes[i].Servings != nil {
						iServings = *recipes[i].Servings
					}
					jServings := 0
					if recipes[j].Servings != nil {
						jServings = *recipes[j].Servings
					}
					if iServings < jServings {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		} else {
			// Sort servings low to high
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					iServings := 999999 // Put nil values at the end for ascending
					if recipes[i].Servings != nil {
						iServings = *recipes[i].Servings
					}
					jServings := 999999
					if recipes[j].Servings != nil {
						jServings = *recipes[j].Servings
					}
					if iServings > jServings {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		}
	default: // "createdAt"
		if sortOrder == "desc" {
			// Sort newest first (default)
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					if recipes[i].CreatedAt.Before(recipes[j].CreatedAt) {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		} else {
			// Sort oldest first
			for i := 0; i < len(recipes)-1; i++ {
				for j := i + 1; j < len(recipes); j++ {
					if recipes[i].CreatedAt.After(recipes[j].CreatedAt) {
						recipes[i], recipes[j] = recipes[j], recipes[i]
					}
				}
			}
		}
	}
}