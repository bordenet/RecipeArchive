# OpenAI Content Normalization at Ingestion Plan

## Overview

This document outlines a comprehensive plan for integrating OpenAI API calls into our AWS backend to normalize, canonicalize, and enhance recipe content at ingestion time. This system will process recipes when browser extensions send parsed data to the backend, providing consistent formatting, improved data quality, and enhanced searchability.

## Current Architecture Context

Our RecipeArchive system processes recipes through:

- **Browser Extensions**: TypeScript parsers extract recipe data from 11+ supported sites
- **AWS Lambda**: `RecipesFunction` receives parsed data and stores to S3
- **Data Flow**: Extension → Lambda → S3 storage → Mobile apps
- **Storage Format**: JSON recipes with structured ingredient/instruction arrays

## Problem Statement

Current recipe ingestion challenges:

1. **Inconsistent Formatting**: Recipe titles vary wildly ("easy chocolate chip cookies" vs "EASY Chocolate Chip Cookies!")
2. **Unit Variations**: "1 cup flour" vs "1 c. flour" vs "240ml flour"
3. **Ingredient Ambiguity**: "salt" vs "table salt" vs "kosher salt"
4. **Instruction Clarity**: Varies from verbose to overly terse
5. **Missing Metadata**: Cooking methods, cuisine types, dietary information often missing
6. **Quality Issues**: Typos, formatting artifacts, incomplete parsing

## Proposed OpenAI Integration Architecture

### Phase 1: AWS Lambda Enhancement

**New Lambda Function: `RecipeArchive-dev-ContentNormalizer`**

**Integration Point**: Between recipe parsing and S3 storage

```
Extension Parse → Lambda Receiver → OpenAI Normalizer → S3 Storage
```

**OpenAI API Configuration:**

- **Model**: GPT-4-turbo (better instruction following, cost-effective)
- **Temperature**: 0.1 (minimal creativity, maximum consistency)
- **Max Tokens**: 2000 (sufficient for recipe normalization)
- **Timeout**: 10 seconds (fail gracefully if API unavailable)

### Phase 2: Structured Normalization Pipeline

**Recipe Normalization Prompt Template:**

```typescript
const NORMALIZATION_PROMPT = `
You are a professional recipe editor tasked with normalizing recipe data for consistent storage and presentation. 

Input Recipe Data:
- Title: "${originalTitle}"
- Ingredients: ${JSON.stringify(originalIngredients)}
- Instructions: ${JSON.stringify(originalInstructions)}
- Metadata: ${JSON.stringify(originalMetadata)}

Please normalize this recipe following these strict guidelines:

TITLE NORMALIZATION:
- Use Title Case (capitalize major words, lowercase articles/prepositions)
- IMPORTANT: Apostrophes should NOT capitalize the letter after them (e.g., 'Kylie\'s' not 'Kylie\'S' and 'General Tso\'s' not 'General Tso\'S')
- Examples: "Bob's Burgers", "Mom's Apple Pie", "Baker's Dozen"
- Remove excessive punctuation or emoji
- Remove the trailing word "Recipe" from recipe titles if present
- Fix common misspellings
- Correct grammar issues
- Remove redundant words (e.g., "Delicious Recipe" → "Delicious")
- Standardize capitalization of brand names (e.g., "Kylie\'s" not "Kylie\'S")
- Normalize special characters (e.g., replace curly quotes with straight quotes)
- Ensure no escape sequences are present (e.g., replace \u2019 with apostrophe)
- Remove any leading or trailing whitespace
- Remove duplicate spaces
- Correct punctuation spacing (e.g., "Hello , world !" → "Hello, world!")
- Standardize capitalization of cooking terms (e.g., "Sauté" not "saute")
- Remove any HTML tags or markdown formatting
- Ensure proper use of hyphens and dashes (e.g., "well-known" not "well known")
- Remove any non-recipe related text (e.g., promotional phrases)
- Standardize recipe categories if mentioned (e.g., "dessert" not "sweet treat")
- Standardize formatting of compound words (e.g., "stir-fry" not "stir fry")
- Use consistent terminology for cooking vessels (e.g., "skillet" not "frying pan")
- Standardize descriptive adjectives (e.g., "crispy" not "crunchy")
- Standardize descriptive terms (e.g., "Easy" → "Simple", "Super Yummy" → "Delicious")
- Keep titles concise (max 60 characters)

INGREDIENT NORMALIZATION:
- Standardize units (cups, tablespoons, teaspoons, ounces, pounds, grams)
- Use consistent fraction formatting (1/2, 1/4, 3/4)
- Standardize ingredient names (e.g., "all-purpose flour" not "AP flour")
- Include preparation methods when relevant ("diced", "chopped", "minced")
- Use specific salt types when mentioned ("kosher salt", "sea salt")
- Normalize special characters (e.g., replace curly quotes with straight quotes)
- Ensure no escape sequences are present (e.g., replace \u2019 with apostrophe)
- Remove any leading or trailing whitespace
- Remove duplicate spaces
- Correct punctuation spacing (e.g., "Hello , world !" → "Hello, world!")
- Standardize measurement terms (e.g., "Tbsp" → "tablespoon", "tsp" → "teaspoon")
- Use consistent terminology (e.g., "bake" not "oven cook")
- Standardize formatting of numbers (e.g., "1 1/2" not "1 and 1/2")
- Use numerals for quantities (e.g., "2" not "two")
- Standardize capitalization of cooking terms (e.g., "Sauté" not "saute")
- Remove any HTML tags or markdown formatting
- Ensure proper use of hyphens and dashes (e.g., "well-known" not "well known")
- Standardize spice names (e.g., "cumin" not "ground cumin" unless specified)
- Use consistent naming for common ingredients (e.g., "bell pepper" not "capsicum")
- Ensure proper use of singular/plural forms (e.g., "1 egg" not "1 eggs")
- Remove any non-recipe related text (e.g., promotional phrases)
- Standardize recipe categories if mentioned (e.g., "dessert" not "sweet treat")
- Ensure no personal names or anecdotes are included
- Standardize formatting of compound words (e.g., "stir-fry" not "stir fry")
- Use consistent terminology for cooking vessels (e.g., "skillet" not "frying pan")
- Standardize descriptive adjectives (e.g., "crispy" not "crunchy")
- Standardize descriptive terms (e.g., "Easy" → "Simple", "Super Yummy" → "Delicious")


INSTRUCTION NORMALIZATION:
- Use imperative voice ("Mix flour" not "You should mix flour")
- Start each step with action verb when possible
- Keep steps concise but complete
- Use consistent temperature formats (375°F, 190°C)
- Standardize temperature formats (e.g., "375°F" not "375 degrees F")
- Standardize timing formats ("10 minutes", "1 hour")
- Use consistent time formats (e.g., "10 minutes" not "ten mins")

SERVINGS AND TIME INFERENCE (CRITICAL):
- ALWAYS estimate servings if not provided: analyze ingredient quantities to determine realistic serving count
- For cocktails/drinks: typically 1-2 servings unless ingredients suggest more
- For main dishes: analyze protein amounts, starch portions to estimate 2-8 servings
- For baked goods: count individual items or estimate portions from pan size
- ALWAYS estimate times in minutes if missing: analyze instructions for realistic timing
- Prep time: time for chopping, mixing, assembling before cooking
- Cook time: actual cooking/baking/active heat time
- Total time: prep + cook + any waiting/resting time
- Add timing details inline in instructions when multiple phases exist (e.g., "Mix ingredients (5 minutes)", "Bake for 25 minutes", "Cool for 10 minutes")

METADATA ENHANCEMENT:
- Infer cuisine type when possible
- Identify cooking methods (baked, sautéed, grilled, etc.)
- Detect dietary information (vegetarian, gluten-free, dairy-free)
- Estimate difficulty level (Simple, Moderate, Complex)

Return ONLY valid JSON in this exact format:
{
  "normalizedTitle": "Normalized Recipe Title",
  "normalizedIngredients": [
    {"text": "1 cup all-purpose flour"},
    {"text": "1/2 teaspoon kosher salt"}
  ],
  "normalizedInstructions": [
    {"stepNumber": 1, "text": "Preheat oven to 375°F (190°C)."},
    {"stepNumber": 2, "text": "Mix flour and salt in large bowl."}
  ],
  "inferredMetadata": {
    "cuisineType": "American",
    "cookingMethods": ["baked"],
    "dietaryInfo": ["vegetarian"],
    "difficultyLevel": "Simple"
  },
  "qualityScore": 8.5,
  "normalizationNotes": "Standardized units and temperature format"
}
`;
```

**Lambda Function Implementation:**

```typescript
import { OpenAI } from 'openai';

interface NormalizationRequest {
  originalRecipe: RecipeData;
  userId: string;
  sourceUrl: string;
}

interface NormalizationResponse {
  normalizedRecipe: RecipeData;
  qualityScore: number;
  processingTime: number;
  openaiTokensUsed: number;
}

export async function normalizeRecipeContent(
  originalRecipe: RecipeData,
  openaiClient: OpenAI
): Promise<NormalizationResponse> {
  const startTime = Date.now();

  try {
    const prompt = buildNormalizationPrompt(originalRecipe);

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const normalizedData = JSON.parse(completion.choices[0].message.content);

    // Validation & fallback logic
    const validatedRecipe = validateNormalizedRecipe(
      normalizedData,
      originalRecipe
    );

    return {
      normalizedRecipe: validatedRecipe,
      qualityScore: normalizedData.qualityScore || 7.0,
      processingTime: Date.now() - startTime,
      openaiTokensUsed: completion.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error('OpenAI normalization failed:', error);

    // Graceful fallback - return original with basic cleanup
    return {
      normalizedRecipe: applyBasicNormalization(originalRecipe),
      qualityScore: 6.0,
      processingTime: Date.now() - startTime,
      openaiTokensUsed: 0,
    };
  }
}
```

### Phase 3: Quality Validation & Fallback System

**Multi-Layer Validation:**

1. **JSON Schema Validation**: Ensure OpenAI response matches expected structure
2. **Content Preservation**: Verify essential recipe data wasn't lost
3. **Reasonable Bounds**: Check ingredient quantities, cooking times are realistic
4. **Fallback Logic**: Use original data if normalization produces invalid results

**Quality Scoring System:**

- **9-10**: Excellent - Complete normalization with enhanced metadata
- **7-8**: Good - Solid normalization with minor improvements
- **5-6**: Fair - Basic cleanup, some normalization applied
- **3-4**: Poor - Minimal changes due to processing limitations
- **1-2**: Failed - Fallback to original content

### Phase 4: Mobile App Integration

**Enhanced Recipe Display:**

**Flutter Web App Improvements:**

- **Quality Indicators**: Visual badges for normalized vs. raw recipes
- **Normalization Details**: Expandable section showing improvements made
- **User Feedback**: Rate normalization quality for continuous improvement

**Native iOS/iPad Enhancements:**

- **Smart Search**: Enhanced searchability from normalized ingredient names
- **Cooking Assistance**: Step-by-step mode with normalized instruction clarity
- **Metadata Display**: Show inferred cuisine, dietary info, difficulty level

**Android App Features:**

- **Material Design Cards**: Highlight normalized metadata with chips
- **Search Filters**: Filter by inferred dietary information and cuisine
- **Quality Indicators**: Color-coded quality scores in recipe lists

### Phase 5: Advanced Normalization Features

**Dietary Analysis Enhancement:**

```typescript
interface DietaryAnalysis {
  detectedDietary: string[]; // ['vegetarian', 'gluten-free']
  potentialAllergens: string[]; // ['nuts', 'dairy', 'eggs']
  nutritionEstimates?: {
    servings: number;
    estimatedCalories: number;
    macronutrientProfile: 'high-carb' | 'high-protein' | 'high-fat';
  };
  substitutionSuggestions: {
    ingredient: string;
    alternatives: string[];
    reason: string;
  }[];
}
```

**Cuisine Classification:**

- **Primary Cuisine**: Italian, Mexican, American, Asian, etc.
- **Sub-cuisine**: Northern Italian, Tex-Mex, Southern American
- **Fusion Detection**: Italian-American, Mexican-Asian fusion
- **Regional Specificity**: Sicilian, Oaxacan, Louisiana Creole

**Cooking Method Analysis:**

- **Primary Methods**: Baking, sautéing, grilling, braising
- **Equipment Required**: Oven, stovetop, grill, slow cooker
- **Skill Level Indicators**: Knife skills, timing complexity, technique difficulty

### Phase 6: Cost Management & Monitoring

**OpenAI API Cost Controls:**

**Rate Limiting Strategy:**

- **Per-User Limits**: Max 200 normalizations per day per user
- **Global Limits**: Max 2000 API calls per day (adjustable)
- **Batch Processing**: Queue normalizations during high usage periods

**Cost Monitoring:**

```typescript
interface CostTracking {
  dailyTokenUsage: number;
  dailyCost: number;
  monthlyBudget: number;
  costPerNormalization: number;
  qualityScoreDistribution: number[];
}
```

**Budget Management:**

- **Daily Budget**: $10/day (~2000-3000 normalizations
- **Quality Threshold**: Skip normalization if recipe quality already high
- **User Prioritization**: Premium users get priority normalization access

### Phase 7: Performance Optimization

**Caching Strategy:**

- **Recipe Fingerprinting**: Hash recipe content to avoid duplicate processing
- **Result Caching**: Store normalized results for identical recipes
- **Partial Normalization**: Cache common ingredient/instruction normalizations

**Parallel Processing:**

```typescript
async function processRecipeBatch(
  recipes: RecipeData[]
): Promise<ProcessedRecipe[]> {
  const chunks = chunkArray(recipes, 5); // Process 5 at a time
  const results = [];

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map((recipe) => normalizeRecipeContent(recipe))
    );
    results.push(...chunkResults);

    // Rate limiting delay
    await sleep(1000);
  }

  return results;
}
```

## Implementation Timeline

### Week 1-2: Foundation & OpenAI Integration

- Set up OpenAI API access and billing
- Create ContentNormalizer Lambda function
- Implement basic normalization prompt and validation
- Deploy with feature flag for controlled testing

### Week 3-4: Quality System & Fallbacks

- Build comprehensive validation system
- Implement quality scoring and fallback logic
- Create cost monitoring and rate limiting
- Integration testing with existing recipe pipeline

### Week 5-6: Mobile App Integration

- Update Flutter app to display normalization metadata
- Enhance iOS/iPad apps with quality indicators
- Improve Android app search with normalized data
- A/B testing framework for normalization effectiveness

### Week 7-8: Advanced Features & Optimization

- Implement dietary analysis and cuisine classification
- Add caching and performance optimizations
- Deploy batch processing for historical recipes
- Comprehensive monitoring and alerting

## Success Metrics

### Content Quality Metrics

- **Normalization Success Rate**: % of recipes successfully normalized
- **Quality Score Distribution**: Average quality scores over time
- **User Satisfaction**: Ratings for normalized vs. original recipes
- **Search Improvement**: Click-through rates on normalized recipe results

### Technical Performance Metrics

- **Processing Latency**: Time from recipe submission to normalized storage
- **API Reliability**: OpenAI API success rate and error handling
- **Cost Efficiency**: Cost per normalization vs. quality improvement
- **System Throughput**: Recipes processed per minute/hour

### Business Impact Metrics

- **User Engagement**: Time spent with normalized recipes
- **Feature Adoption**: Usage of enhanced search and filtering
- **Retention Impact**: User retention with vs. without normalization
- **Content Discoverability**: Improved recipe search success rates

## Testing Strategy

### Unit Testing

- Normalization prompt effectiveness with sample recipes
- Validation logic for edge cases and malformed responses
- Fallback system reliability under various failure conditions
- Cost tracking accuracy and rate limiting functionality

### Integration Testing

- End-to-end recipe flow from extension through normalization to storage
- Cross-platform mobile app display of normalized content
- Performance testing under various load conditions
- OpenAI API failure scenarios and graceful degradation

### User Acceptance Testing

- Side-by-side comparison of original vs. normalized recipes
- User feedback collection on normalization quality
- Usability testing of enhanced search and filtering features
- Beta testing with power users and recipe enthusiasts

## Risk Mitigation

### Technical Risks

- **OpenAI API Outages**: Robust fallback system maintains service availability
- **Cost Overruns**: Strict rate limiting and budget monitoring prevent overspend
- **Quality Degradation**: Human review process for low-scoring normalizations

### Content Quality Risks

- **Over-normalization**: Preserve original recipe character while improving consistency
- **Cultural Sensitivity**: Respect authentic recipe terminology and methods
- **User Preference**: Optional normalization for users who prefer original content

### Business Risks

- **Feature Complexity**: Start with basic normalization, iterate based on user feedback
- **Development Resource**: Balanced investment in normalization vs. new features
- **User Adoption**: Clear communication of normalization benefits and controls

## Future Enhancements

### Advanced AI Features

- **Recipe Improvement Suggestions**: AI-powered cooking tips and technique improvements
- **Nutritional Analysis**: Detailed nutritional breakdowns with health recommendations
- **Seasonal Adaptations**: Suggest ingredient substitutions based on seasonality

### Community Integration

- **User Feedback Loop**: Community rating of normalization quality
- **Custom Normalization**: User preferences for normalization style and strictness
- **Expert Review**: Professional chef review of AI normalization suggestions

### Enterprise Features

- **Bulk Historical Processing**: Normalize entire recipe collections retroactively
- **Custom Prompts**: Tailored normalization for specific use cases or dietary needs
- **Analytics Dashboard**: Comprehensive analysis of normalization patterns and effectiveness

---

This comprehensive OpenAI integration plan transforms recipe ingestion from simple data storage into intelligent content enhancement, providing users with consistently formatted, searchable, and actionable recipe information while maintaining respect for original recipe authenticity and cultural context.
