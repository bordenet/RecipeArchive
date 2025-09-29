# Recipe Schema and OpenAI Normalization Requirements

## Overview

RecipeArchive MUST maintain a comprehensive, consistent recipe schema with full metadata enrichment through OpenAI LLM normalization during import.

## Critical Schema Requirements

### P1: Complete Recipe Schema

- **ALL critical metadata MUST be captured and normalized**
- **Consistent field naming across entire system** (`cookTimeMinutes`, `prepTimeMinutes`)
- **Full schema validation with zero tolerance for inconsistencies**
- **OpenAI normalization MUST fire for every imported recipe**

### P2: Metadata Completeness

- **Structured ingredient parsing** with quantities, units, and preparation notes
- **Step-by-step instruction normalization** with clear, actionable steps
- **Comprehensive tagging and categorization** for search and discovery
- **Time and serving information** normalized to consistent formats

## Core Schema Fields

### Required Fields

```json
{
  "id": "UUID",
  "title": "string",
  "sourceUrl": "string",
  "ingredients": ["string array"],
  "instructions": ["string array"],
  "createdAt": "ISO8601 timestamp",
  "updatedAt": "ISO8601 timestamp",
  "userId": "UUID"
}
```

### Time Fields (Normalized)

```json
{
  "prepTimeMinutes": "integer",
  "cookTimeMinutes": "integer",
  "totalTimeMinutes": "integer",
  "readyInMinutes": "integer"
}
```

### Serving & Quantity

```json
{
  "servings": "integer",
  "yield": "string",
  "portionSize": "string"
}
```

### Categorization & Tagging

```json
{
  "mealType": [
    "breakfast",
    "brunch",
    "lunch",
    "dinner",
    "snack",
    "dessert",
    "drink",
    "appetizer",
    "hors-doeuvre"
  ],
  "cuisineType": ["string array"],
  "dietaryTags": [
    "vegetarian",
    "vegan",
    "gluten-free",
    "dairy-free",
    "keto",
    "paleo",
    "low-carb"
  ],
  "cookingMethods": [
    "baked",
    "grilled",
    "sautéed",
    "roasted",
    "slow-cooked",
    "instant-pot",
    "air-fryer"
  ],
  "difficulty": ["beginner", "intermediate", "advanced"],
  "semanticTags": ["string array"],
  "userTags": ["string array"]
}
```

### Enhanced Metadata

```json
{
  "description": "string",
  "notes": "string",
  "nutrition": {
    "calories": "integer",
    "protein": "string",
    "carbohydrates": "string",
    "fat": "string",
    "fiber": "string"
  },
  "equipment": [
    "oven",
    "stovetop",
    "grill",
    "slow-cooker",
    "instant-pot",
    "air-fryer",
    "food-processor"
  ],
  "season": ["spring", "summer", "fall", "winter"],
  "occasion": ["weeknight", "weekend", "holiday", "entertaining", "meal-prep"]
}
```

### Visual & Rating Data

```json
{
  "images": ["string array of URLs"],
  "heroImage": "string URL",
  "personalRating": "integer (1-5)",
  "personalNotes": "string",
  "lastMadeDate": "ISO8601 timestamp",
  "makeCount": "integer"
}
```

## OpenAI Normalization Requirements

### P1: Automatic Enrichment

- **Every imported recipe MUST trigger OpenAI normalization**
- **Background processing via SQS queue for async handling**
- **Intelligent metadata extraction and categorization**
- **Consistent field standardization across all sources**

### Content Enhancement

- **Ingredient Parsing**: Extract quantities, units, preparation methods
- **Instruction Clarity**: Rewrite for clarity and consistency
- **Automatic Tagging**: Infer meal type, cuisine, cooking methods, difficulty
- **Time Estimation**: Standardize and validate prep/cook time estimates
- **Dietary Analysis**: Identify dietary restrictions and nutritional aspects

### Quality Assurance

- **Schema Validation**: Every normalized recipe must pass complete schema validation
- **Field Consistency**: Uniform naming and data types across all recipes
- **Error Handling**: Failed normalization must be logged and retried
- **Fallback Strategy**: Graceful degradation for OpenAI service unavailability

## Advanced Schema Features

### Ingredient Intelligence

```json
{
  "parsedIngredients": [
    {
      "original": "2 cups all-purpose flour",
      "quantity": 2,
      "unit": "cups",
      "ingredient": "all-purpose flour",
      "preparation": "",
      "category": "baking"
    }
  ]
}
```

### Instruction Structure

```json
{
  "structuredInstructions": [
    {
      "step": 1,
      "instruction": "Preheat oven to 350°F",
      "duration": "5 minutes",
      "equipment": ["oven"],
      "techniques": ["preheating"]
    }
  ]
}
```

### Search Optimization

```json
{
  "searchableText": "combined ingredient and instruction text for full-text search",
  "primaryIngredients": ["chicken", "tomatoes", "onions"],
  "allergens": ["gluten", "dairy", "nuts"],
  "flavorProfile": ["savory", "spicy", "herbed", "sweet"]
}
```

## Data Integrity Requirements

### Schema Consistency

- **Uniform field naming**: NO variations like `cookTime` vs `cookTimeMinutes`
- **Type safety**: Consistent data types across all recipe instances
- **Validation pipeline**: Pre-save validation with detailed error reporting
- **Migration safety**: Schema changes must not break existing recipes

### Error Prevention

- **Silent failure elimination**: All parsing errors must be logged and monitored
- **Recipe count monitoring**: Discrepancies between S3 and API must trigger alerts
- **Automated schema validation**: `./scripts/validate-recipe-schema.sh` integration
- **Emergency recovery procedures**: Documented fix procedures for schema issues

### Quality Gates

- **Pre-deployment validation**: Schema changes must pass full test suite
- **Fresh/overwrite consistency**: Identical schema regardless of import method
- **Cross-platform validation**: Same schema behavior web/mobile/API
- **Backward compatibility**: New schema versions must support existing data

## OpenAI Integration

### Processing Pipeline

1. **Recipe Import**: Web extension submits raw recipe data
2. **Queue Processing**: Recipe placed in SQS normalization queue
3. **OpenAI Enhancement**: LLM extracts and enriches metadata
4. **Schema Validation**: Normalized data validated against complete schema
5. **Storage**: Final recipe stored with full metadata in S3
6. **Indexing**: Recipe made available for search and display

### LLM Prompt Engineering

- **Structured output**: Force consistent JSON schema responses
- **Metadata extraction**: Comprehensive ingredient and instruction analysis
- **Categorization logic**: Intelligent meal type and cuisine classification
- **Quality enhancement**: Instruction clarity and ingredient standardization
- **Validation hooks**: Built-in schema compliance checking

### Error Handling

- **OpenAI failures**: Graceful degradation with partial normalization
- **Rate limiting**: Proper backoff and retry logic for API limits
- **Cost monitoring**: Usage tracking and budget alerts
- **Quality validation**: Post-processing schema and content validation

## Success Metrics

### Schema Compliance

- **100% schema validation success** for all imported recipes
- **Zero field naming inconsistencies** across the system
- **Complete metadata coverage** for all required fields
- **Consistent data types** for all schema fields

### Processing Reliability

- **100% normalization trigger rate** for imported recipes
- **<5 second average** processing time for recipe normalization
- **99% OpenAI processing success rate** with proper error handling
- **Zero data loss** during normalization pipeline

### Data Quality

- **Consistent meal type classification** across similar recipes
- **Accurate time estimates** within 20% of actual cooking times
- **Comprehensive ingredient parsing** with 95% accuracy
- **Meaningful semantic tags** for enhanced searchability

## Cross-References

- [web-extension-parsing.md](./web-extension-parsing.md): Recipe extraction and import requirements
- [search-functionality.md](./search-functionality.md): Search and filtering based on schema fields
- [backup-restore-versioning.md](./backup-restore-versioning.md): Schema versioning and migration
- [../data-integrity-measures.md](../data-integrity-measures.md): Schema consistency procedures
