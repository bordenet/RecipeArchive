package models

import (
	"encoding/json"
	"testing"
)

func TestFlexInt_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected *int
		wantErr  bool
	}{
		{
			name:     "integer value",
			input:    `42`,
			expected: intPtr(42),
			wantErr:  false,
		},
		{
			name:     "string integer value",
			input:    `"42"`,
			expected: intPtr(42),
			wantErr:  false,
		},
		{
			name:     "null value",
			input:    `null`,
			expected: nil,
			wantErr:  false,
		},
		{
			name:     "empty string",
			input:    `""`,
			expected: nil,
			wantErr:  false,
		},
		{
			name:     "zero value",
			input:    `0`,
			expected: intPtr(0),
			wantErr:  false,
		},
		{
			name:     "string zero value",
			input:    `"0"`,
			expected: intPtr(0),
			wantErr:  false,
		},
		{
			name:     "invalid string",
			input:    `"not a number"`,
			expected: nil,
			wantErr:  false, // FlexInt returns nil for invalid values
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var f FlexInt
			err := json.Unmarshal([]byte(tt.input), &f)

			if (err != nil) != tt.wantErr {
				t.Errorf("UnmarshalJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.expected == nil && f.Value != nil {
				t.Errorf("UnmarshalJSON() got = %v, want nil", *f.Value)
			} else if tt.expected != nil && f.Value == nil {
				t.Errorf("UnmarshalJSON() got nil, want %v", *tt.expected)
			} else if tt.expected != nil && f.Value != nil && *f.Value != *tt.expected {
				t.Errorf("UnmarshalJSON() got = %v, want %v", *f.Value, *tt.expected)
			}
		})
	}
}

func TestFlexInt_MarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		value    *int
		expected string
	}{
		{
			name:     "integer value",
			value:    intPtr(42),
			expected: `42`,
		},
		{
			name:     "zero value",
			value:    intPtr(0),
			expected: `0`,
		},
		{
			name:     "nil value",
			value:    nil,
			expected: `null`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := FlexInt{Value: tt.value}
			result, err := json.Marshal(f)

			if err != nil {
				t.Errorf("MarshalJSON() error = %v", err)
				return
			}

			if string(result) != tt.expected {
				t.Errorf("MarshalJSON() got = %s, want %s", string(result), tt.expected)
			}
		})
	}
}

func TestRecipe_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		validate func(*testing.T, *Recipe)
	}{
		{
			name: "new field names with integers",
			input: `{
				"id": "test-1",
				"userId": "user-1",
				"title": "Test Recipe",
				"ingredients": [{"text": "1 cup flour"}],
				"instructions": [{"stepNumber": 1, "text": "Mix"}],
				"sourceUrl": "https://example.com",
				"prepTimeMinutes": 10,
				"cookTimeMinutes": 20,
				"totalTimeMinutes": 30,
				"servings": 4
			}`,
			validate: func(t *testing.T, r *Recipe) {
				if r.PrepTimeMinutes == nil || *r.PrepTimeMinutes != 10 {
					t.Errorf("PrepTimeMinutes got = %v, want 10", r.PrepTimeMinutes)
				}
				if r.CookTimeMinutes == nil || *r.CookTimeMinutes != 20 {
					t.Errorf("CookTimeMinutes got = %v, want 20", r.CookTimeMinutes)
				}
				if r.TotalTimeMinutes == nil || *r.TotalTimeMinutes != 30 {
					t.Errorf("TotalTimeMinutes got = %v, want 30", r.TotalTimeMinutes)
				}
				if r.Servings == nil || *r.Servings != 4 {
					t.Errorf("Servings got = %v, want 4", r.Servings)
				}
			},
		},
		{
			name: "new field names with string integers",
			input: `{
				"id": "test-2",
				"userId": "user-2",
				"title": "Test Recipe 2",
				"ingredients": [{"text": "2 cups sugar"}],
				"instructions": [{"stepNumber": 1, "text": "Combine"}],
				"sourceUrl": "https://example.com",
				"prepTimeMinutes": "15",
				"cookTimeMinutes": "25",
				"totalTimeMinutes": "40",
				"servings": "6"
			}`,
			validate: func(t *testing.T, r *Recipe) {
				if r.PrepTimeMinutes == nil || *r.PrepTimeMinutes != 15 {
					t.Errorf("PrepTimeMinutes got = %v, want 15", r.PrepTimeMinutes)
				}
				if r.CookTimeMinutes == nil || *r.CookTimeMinutes != 25 {
					t.Errorf("CookTimeMinutes got = %v, want 25", r.CookTimeMinutes)
				}
				if r.TotalTimeMinutes == nil || *r.TotalTimeMinutes != 40 {
					t.Errorf("TotalTimeMinutes got = %v, want 40", r.TotalTimeMinutes)
				}
				if r.Servings == nil || *r.Servings != 6 {
					t.Errorf("Servings got = %v, want 6", r.Servings)
				}
			},
		},
		{
			name: "legacy field names (prepTime, cookTime)",
			input: `{
				"id": "test-3",
				"userId": "user-3",
				"title": "Legacy Recipe",
				"ingredients": [{"text": "3 eggs"}],
				"instructions": [{"stepNumber": 1, "text": "Beat"}],
				"sourceUrl": "https://example.com",
				"prepTime": 5,
				"cookTime": 10
			}`,
			validate: func(t *testing.T, r *Recipe) {
				if r.PrepTimeMinutes == nil || *r.PrepTimeMinutes != 5 {
					t.Errorf("PrepTimeMinutes (from prepTime) got = %v, want 5", r.PrepTimeMinutes)
				}
				if r.CookTimeMinutes == nil || *r.CookTimeMinutes != 10 {
					t.Errorf("CookTimeMinutes (from cookTime) got = %v, want 10", r.CookTimeMinutes)
				}
			},
		},
		{
			name: "new field names take precedence over legacy",
			input: `{
				"id": "test-4",
				"userId": "user-4",
				"title": "Precedence Test",
				"ingredients": [{"text": "4 cups water"}],
				"instructions": [{"stepNumber": 1, "text": "Boil"}],
				"sourceUrl": "https://example.com",
				"prepTime": 5,
				"prepTimeMinutes": 10,
				"cookTime": 15,
				"cookTimeMinutes": 20
			}`,
			validate: func(t *testing.T, r *Recipe) {
				if r.PrepTimeMinutes == nil || *r.PrepTimeMinutes != 10 {
					t.Errorf("PrepTimeMinutes got = %v, want 10 (new field should take precedence)", r.PrepTimeMinutes)
				}
				if r.CookTimeMinutes == nil || *r.CookTimeMinutes != 20 {
					t.Errorf("CookTimeMinutes got = %v, want 20 (new field should take precedence)", r.CookTimeMinutes)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var r Recipe
			err := json.Unmarshal([]byte(tt.input), &r)
			if err != nil {
				t.Errorf("UnmarshalJSON() error = %v", err)
				return
			}
			tt.validate(t, &r)
		})
	}
}

// Helper function to create int pointers
func intPtr(i int) *int {
	return &i
}
