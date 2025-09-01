# OpenAI Content Normalization Plan

## Overview
Integrate OpenAI at recipe ingestion to automatically normalize, enhance, and canonicalize recipe content before S3 storage, ensuring consistent data quality across all sources.

## Integration Architecture

### 1. Processing Pipeline Location
**Trigger Point:** After successful parser extraction, before S3 storage
```javascript
// In browser extension recipe capture flow:
const parsedRecipe = await siteParser.parse(html, url);
const normalizedRecipe = await normalizeWithOpenAI(parsedRecipe);  // NEW
await submitRecipe(normalizedRecipe);
```

### 2. Lambda Function: RecipeContentNormalizer
**Location:** `aws-backend/functions/recipe-content-normalizer/`
**Trigger:** HTTP POST from browser extensions
**Timeout:** 60 seconds (allows OpenAI API calls)

### 3. OpenAI Integration Strategy

#### Structured Prompt Engineering
```javascript
const NORMALIZATION_PROMPT = `
You are a culinary data specialist. Normalize this recipe data:

INPUT RECIPE:
Title: "${recipe.title}"
Ingredients: ${JSON.stringify(recipe.ingredients)}  
Instructions: ${JSON.stringify(recipe.instructions)}
Metadata: ${JSON.stringify({prepTime, cookTime, servings, cuisine})}

NORMALIZATION TASKS:
1. TITLE: Apply proper title case (e.g., "chocolate chip cookies" → "Chocolate Chip Cookies")
2. INGREDIENTS: 
   - Standardize measurements (1 Tbsp → 1 tablespoon)
   - Fix spacing/punctuation
   - Resolve ambiguous amounts ("a pinch" → "1/8 teaspoon")
3. INSTRUCTIONS:
   - Number steps if missing
   - Fix grammar/punctuation  
   - Standardize cooking terms
4. METADATA:
   - Infer missing prep/cook times from instructions
   - Estimate servings if not provided
   - Classify cuisine type
   - Set difficulty level (Easy/Medium/Hard)

OUTPUT as valid JSON matching this schema:
{
  "title": "string",
  "ingredients": [{"text": "normalized ingredient"}],
  "instructions": [{"stepNumber": 1, "text": "normalized step"}],
  "prepTime": "estimated minutes or existing",
  "cookTime": "estimated minutes or existing", 
  "servings": "estimated number or existing",
  "cuisine": "classified cuisine type",
  "difficulty": "Easy|Medium|Hard",
  "enhancementNotes": "summary of changes made"
}
`;
```

#### Quality Control Prompts
```javascript
const QUALITY_CHECK_PROMPT = `
Review this normalized recipe for accuracy:
${JSON.stringify(normalizedRecipe)}

Check for:
- Logical cooking times
- Realistic ingredient amounts  
- Clear instruction sequence
- Appropriate difficulty rating

Return: {"quality_score": 0-100, "issues": ["list of problems"], "approved": boolean}
`;
```

## Implementation Design

### 4. API Integration Layer
```typescript
// aws-backend/functions/recipe-content-normalizer/openai-client.ts
import { OpenAI } from 'openai';

class RecipeNormalizer {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async normalizeRecipe(recipe: RawRecipe): Promise<NormalizedRecipe> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Cost-effective for structured tasks
        messages: [
          {
            role: "system", 
            content: "You are a culinary data normalization specialist."
          },
          {
            role: "user",
            content: this.buildNormalizationPrompt(recipe)
          }
        ],
        temperature: 0.1, // Low temperature for consistency
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      return this.parseNormalizedResponse(response.choices[0].message.content);
    } catch (error) {
      console.error('OpenAI normalization failed:', error);
      return this.fallbackNormalization(recipe);
    }
  }

  private fallbackNormalization(recipe: RawRecipe): NormalizedRecipe {
    // Basic normalization without OpenAI
    return {
      ...recipe,
      title: this.titleCase(recipe.title),
      enhancementNotes: "Basic normalization (OpenAI unavailable)"
    };
  }
}
```

### 5. Cost Management & Optimization

#### Token Usage Optimization
- **Input Compression**: Remove HTML, focus on recipe content only
- **Batch Processing**: Process multiple recipes per API call when possible  
- **Selective Enhancement**: Only normalize recipes with quality issues

#### Cost Estimates
- **Average Recipe**: ~800 input tokens, ~400 output tokens  
- **Cost per Recipe**: ~$0.003 (gpt-4o-mini pricing)
- **Monthly Budget**: $100 = ~33,000 recipe normalizations

#### Rate Limiting Strategy
```typescript
class RateLimitedNormalizer {
  private requestQueue: Array<{recipe: Recipe, resolve: Function}> = [];
  private processing = false;
  
  async normalize(recipe: Recipe): Promise<NormalizedRecipe> {
    return new Promise((resolve) => {
      this.requestQueue.push({recipe, resolve});
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const batch = this.requestQueue.splice(0, 5); // Process 5 at a time
      await Promise.all(batch.map(item => this.processSingle(item)));
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
    }
    
    this.processing = false;
  }
}
```

## Quality Assurance

### 6. Validation Pipeline
1. **Schema Validation**: Ensure normalized data matches expected structure
2. **Content Validation**: Check for reasonable values (positive cook times, etc.)
3. **A/B Testing**: Compare OpenAI vs. non-OpenAI recipe quality
4. **User Feedback**: Track recipe ratings post-normalization

### 7. Monitoring & Analytics
```typescript
interface NormalizationMetrics {
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  costPerRecipe: number;
  qualityImprovementScore: number;
  userSatisfactionRating: number;
}
```

## Progressive Rollout Strategy

### Phase 1: Pilot Program (100 recipes/day)
- [ ] Deploy normalizer Lambda function
- [ ] Test with 10 high-quality recipe sources
- [ ] Monitor cost and quality metrics
- [ ] Refine prompts based on results

### Phase 2: Expanded Testing (500 recipes/day)  
- [ ] Add more recipe sources
- [ ] Implement batch processing
- [ ] A/B test normalized vs. original recipes
- [ ] User feedback collection

### Phase 3: Full Production (All recipes)
- [ ] Deploy to all browser extensions
- [ ] Implement quality-based selective processing
- [ ] Add real-time monitoring dashboard
- [ ] Cost optimization based on usage patterns

## Environment Variables

```bash
# aws-backend/functions/recipe-content-normalizer/.env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2000
NORMALIZATION_ENABLED=true
BATCH_SIZE=5
RATE_LIMIT_DELAY_MS=1000
QUALITY_THRESHOLD=70
```

## Success Metrics & KPIs

- **Recipe Completion Rate**: Target >90% (all required fields populated)
- **Title Consistency**: Target >95% proper title case
- **Ingredient Standardization**: Target >85% consistent format
- **User Recipe Ratings**: Target 10% improvement vs. non-normalized
- **Processing Cost**: Target <$0.01 per recipe (including all overhead)
- **Processing Time**: Target <10 seconds average

This system will significantly improve recipe data quality while maintaining reasonable costs and processing speeds.