# Product Requirements Document (PRD): Recipe Browser Extension

## 1. Executive Summary

### 1.1 The Problem: Bookmarks Are Where Recipes Go to Die

Home cooks face a frustrating reality: the perfect recipe found today becomes inaccessible tomorrow. Sites disappear behind paywalls, drown in advertisements, or vanish entirely. Browser bookmarks fail us when we need them most—in the kitchen, with messy hands, trying to make dinner. We're losing our personal cooking history to the chaos of the open web.

### 1.2 Our Solution: A Personal Digital Cookbook That Actually Works

RecipeArchive browser extensions for Chrome and Safari will capture any online recipe with one click, preserving it permanently in a clean, ad-free format that syncs across all devices and works offline. This isn't another recipe discovery platform—it's the definitive tool for recipe preservation and organization.

### 1.3 Target User: The Intentional Home Cook

**Primary User**: Home cooks who actively seek and prepare web recipes 3-5 times per week
**Beta Focus**: Limited release to 50+ food enthusiasts frustrated by current recipe-saving methods

### 1.4 Related Product Requirements

This browser extension is part of the broader RecipeArchive ecosystem. See related PRDs:

- **[AWS Backend PRD](aws-backend.md)** - Cloud infrastructure and API that powers recipe storage, sync, and management
- **[iOS App PRD](ios-app.md)** - Native mobile app for accessing saved recipes on iPhone and iPad
- **[Website PRD](website.md)** - Web application for comprehensive recipe management and organization

The browser extension serves as the primary **recipe capture tool**, while the backend provides **data persistence**, and the iOS app and website enable **recipe access and management** across devices.

## 2. User Needs & Jobs to Be Done

### 2.1 Core User Stories

When users interact with RecipeArchive, they need to:

- **Capture**: "When I find a recipe I like, I want to save it permanently with one click"
- **Access**: "When I'm ready to cook, I want a clean, ad-free view without distractions"
- **Trust**: "When I save a recipe, I want confidence that key information is captured accurately"
- **Sync**: "When I switch devices, I want my recipes available everywhere, even offline"

### 2.2 The Magic Moment

The one-click capture is our core value proposition. It must be:

- **Fast**: Complete extraction within 3 seconds
- **Accurate**: 95% success rate on key fields
- **Simple**: Review, edit if needed, save—done

## 3. Functional Requirements

### 3.1 AWS-Only Push Logic (CRITICAL BUSINESS REQUIREMENT)

**STRICT DATA QUALITY ENFORCEMENT**: Extensions must implement rigorous validation before AWS submission to ensure cloud storage contains only complete, high-quality recipe data.

**Push to AWS Logic:**
```typescript
function shouldPushToAWS(recipeData) {
  // Required fields validation
  const hasValidTitle = recipeData.title && 
                       recipeData.title.trim().length >= 3 &&
                       recipeData.title.length <= 200;
  
  const hasValidIngredients = recipeData.ingredients && 
                             recipeData.ingredients.length >= 2 &&
                             recipeData.ingredients.every(ing => ing.trim().length > 0);
  
  const hasValidInstructions = recipeData.instructions &&
                              recipeData.instructions.length >= 2 &&
                              recipeData.instructions.every(step => step.trim().length > 10);
  
  const hasValidSourceUrl = recipeData.sourceUrl && 
                           recipeData.sourceUrl.startsWith('http');
  
  // AWS push ONLY if ALL required fields are satisfied
  return hasValidTitle && hasValidIngredients && hasValidInstructions && hasValidSourceUrl;
}
```

**Business Logic Requirements:**

1. **Complete Data Only**: AWS receives recipes only when extraction is 100% successful for required fields
2. **Failure Routing**: Incomplete extractions trigger parser failure API instead of recipe storage API
3. **Data Integrity**: Prevent incomplete or corrupted recipe data from polluting production database
4. **Cost Optimization**: Reduce AWS storage costs by filtering low-quality data at the source

**Implementation Enforcement:**

- Extensions must validate data using `shouldPushToAWS()` before AWS submission
- Failed validation triggers automatic parser failure submission with HTML dump
- Dev server (port 8081) accepts all data for testing and development
- Production AWS accepts only validated, complete recipe data

### 3.2 Recipe Capture & Data Requirements

| Data Field        | Priority | Requirement                     | User Value              |
| ----------------- | -------- | ------------------------------- | ----------------------- |
| Recipe Title      | Required | Extracted recipe name           | Primary identifier      |
| Ingredients       | Required | Structured list with quantities | Core shopping/prep list |
| Instructions      | Required | Step-by-step directions         | Cooking guide           |
| Main Photo        | Required | Hero image of dish              | Visual reference        |
| Source URL        | Required | Original recipe link            | Attribution & reference |
| Prep/Cook Time    | Optional | If available on page            | Meal planning           |
| Servings          | Optional | If available on page            | Scaling reference       |
| Full Page Archive | Required | Complete HTML/PDF backup        | Fallback reference      |

### 3.2 Supported Websites


#### 3.2.1 Supported Sites (Registry-Driven, Production Ready)


**All supported sites listed above are registry-driven, fully migrated, validated, and production-ready.**
Documentation and PRD are kept in lock-step with the central site registry (`/parsers/sites/site-registry.ts`).
Parser location: `/parsers/sites/` (monorepo) and `extensions/shared/parsers/sites/` (extension bundle)
Test coverage: Unit tests + integration tests for all registry sites
Success rate target: 95% extraction accuracy

#### 3.2.2 Previously Implemented Sites (Legacy - Requires Migration)

These sites had working parsers in the legacy system that need to be **migrated to the new TypeScript parser architecture**:

| Website | URL Pattern | Legacy Status | Migration Priority | Special Notes |
|---------|-------------|---------------|-------------------|---------------|
| **Washington Post** | `washingtonpost.com` | 🔄 Legacy Complete | HIGH | **Cookie-based auth required for tests** |
| **Love & Lemons** | `loveandlemons.com` | 🔄 Legacy Complete | HIGH | Complex ingredient grouping |
| **Food52** | `food52.com` | 🔄 Legacy Complete | MEDIUM | Multiple recipe formats |
| **AllRecipes** | `allrecipes.com` | 🔄 Legacy Complete | MEDIUM | Community-generated content |
| **Epicurious** | `epicurious.com` | 🔄 Legacy Complete | MEDIUM | Condé Nast network |

**Required Action**: Create TypeScript parsers in `extensions/shared/parsers/sites/` for each legacy site
**Legacy Code Location**: `extensions/chrome/backup-files/content.js` (lines 174-895)
**Test Infrastructure**: Comprehensive test suites already exist in `tests/integration/sites/`

#### 3.2.3 PRD-Defined Target Sites (Future Implementation)

These sites are specified in the original PRD but not yet implemented:

| Website | URL Pattern | Implementation Status | Priority | Business Value |
|---------|-------------|----------------------|----------|----------------|
| **Food & Wine** | `foodandwine.com` | 📋 Not Started | HIGH | Popular cooking magazine |
| **Damn Delicious** | `damndelicious.net` | 📋 Not Started | MEDIUM | High-traffic food blog |
| **Serious Eats** | `seriouseats.com` | 📋 Not Started | HIGH | Technical cooking focus |

#### 3.2.4 Universal Fallback Strategy

For **all other websites** not listed above:

1. **JSON-LD Extraction**: Automatic structured data parsing (covers 80% of recipe sites)
2. **Generic DOM Parsing**: Basic ingredient/instruction detection  
3. **Failed Parse API**: Automatic diagnostic submission for parser development

#### 3.2.5 Implementation Requirements

**Parser Architecture Standards:**
- Each site must have a dedicated TypeScript class extending `BaseParser`
- Site-specific selectors with JSON-LD fallback
- Comprehensive validation using `validateRecipe()`
- Unit tests with mock HTML fixtures
- Integration tests with real site data

**Quality Gates:**
- 95% extraction success rate on title, ingredients, instructions
- <3 second parsing time
- Graceful fallback to JSON-LD when site-specific parsing fails
- Automatic failed-parse submission for continuous improvement

**Migration Checklist for Legacy Sites:**
- [ ] Create TypeScript parser class in `extensions/shared/parsers/sites/`
- [ ] Add parser to registry in `parser-registry.ts`
- [ ] Write unit tests with HTML fixtures
- [ ] Verify integration tests still pass
- [ ] Update browser extension bundles
- [ ] Remove legacy inline parser code

#### 3.2.6 Success Metrics

**Per-Site Targets:**
- **Extraction Success Rate**: ≥95% for required fields (title, ingredients, instructions)
- **Processing Time**: ≤3 seconds for complete extraction
- **Error Rate**: ≤5% of extraction attempts

**Overall Coverage:**
- **Tier 1 Sites**: 100% functional with dedicated parsers
- **Legacy Migration**: Complete within 2 weeks of this PRD update  
- **Future Sites**: Implemented based on user feedback and usage analytics

This comprehensive website support strategy ensures RecipeArchive maintains robust recipe extraction capabilities while providing a clear roadmap for expanding site coverage.

### 3.3 Diagnostic Mode for Parser Improvement

**NEW REQUIREMENT**: Both Chrome and Safari extensions must include a diagnostic mode for continuous parser improvement.

#### 3.3.1 Diagnostic Mode Features

- **Toggle Switch**: User-controlled diagnostic mode in extension popup
- **Privacy-First**: Explicitly opt-in data sharing with clear user consent
- **Comprehensive Analysis**: Capture complete page structure and parsing attempts
- **AWS Integration**: Automated submission to AWS diagnostic API endpoint

#### 3.3.2 Diagnostic Data Payload

When diagnostic mode is enabled and user triggers capture, the extension must collect:

**Page Structure Analysis:**

- URL, hostname, title, and timestamp
- DOM metrics (elements, headings, lists, images, links)
- Recipe-specific indicators (JSON-LD scripts, recipe keywords)
- CSS class names and IDs containing recipe-related terms
- Potential ingredient/instruction container elements with sample content

**Recipe Extraction Analysis:**

- Complete extraction attempt results (success/failure)
- Time taken for extraction process
- Which extraction method succeeded (JSON-LD vs manual parsing)
- Count of ingredients and steps found
- Extraction source (site-specific parser vs generic fallback)

**Technical Metadata:**

- User agent, extension version, platform (Chrome/Safari)
- JSON-LD structured data analysis
- Shadow DOM detection
- Time/serving indicators found in text

#### 3.3.3 Business Value

- **Continuous Improvement**: Real-world usage data drives parser updates
- **Site Coverage**: Identify new sites requiring parser support
- **Quality Assurance**: Monitor extraction success rates in production
- **Rapid Response**: Detect when sites change structure and break parsers

#### 3.3.4 Implementation Requirements

- **AWS API Endpoint**: `/v1/diagnostics` for receiving diagnostic payloads
- **Authentication**: Bearer token authentication for diagnostic submissions
- **Data Processing**: AWS Lambda functions for analyzing diagnostic data
- **Update Pipeline**: Automated process to translate diagnostic insights into parser updates

#### 3.3.5 User Experience

- **Non-Intrusive**: Diagnostic capture is separate from normal recipe capture
- **Clear Benefit**: Users understand their data helps improve the extension
- **Optional**: Always user-initiated, never automatic background collection
- **Visual Feedback**: Clear indication when diagnostic data is successfully sent

#### 3.3.6 Parser Failure API Integration (CRITICAL REQUIREMENT)

**SECURITY-FIRST REQUIREMENT**: Both extensions must automatically submit parser failure data to AWS backend with Cognito authentication to enable ML retraining pipeline.

**Automatic Failure Detection:**

Extensions must detect parser failures using `isExtractionComplete()` validation:

```typescript
function isExtractionComplete(recipeData) {
  const hasTitle = recipeData.title && recipeData.title.length > 3;
  const hasIngredients = recipeData.ingredients && recipeData.ingredients.length >= 2;
  const hasInstructions = recipeData.instructions && recipeData.instructions.length >= 2;
  
  return hasTitle && hasIngredients && hasInstructions;
}
```

**AWS Push Logic (ENHANCED REQUIREMENT):**

Extensions must implement dual-mode submission strategy:

1. **Success Path**: Push to AWS if and only if ALL required JSON fields are satisfied
   - Required: `title`, `ingredients[]` (≥2), `instructions[]` (≥2), `sourceUrl`
   - Optional: `prepTime`, `cookTime`, `servings`, `mainPhotoUrl`
   - Validation: Complete data validation before AWS submission

2. **Failure Path**: Automatic parser failure submission when extraction fails
   - Trigger: Missing title OR insufficient ingredients (<2) OR insufficient instructions (<2)
   - Action: Submit HTML dump and metadata to `/v1/diagnostics/parser-failure`
   - Authentication: Cognito bearer token required

**Parser Failure Payload Requirements:**

```typescript
interface ExtensionFailurePayload {
  url: string;                    // Current page URL
  timestamp: string;              // ISO 8601 extraction attempt time
  userAgent: string;              // Navigator.userAgent string
  extensionVersion: string;       // Extension version from manifest
  extractionAttempt: {
    method: 'json-ld' | 'site-specific' | 'generic-fallback';
    timeElapsed: number;          // Milliseconds for extraction
    elementsFound: {
      jsonLdScripts: number;      // document.querySelectorAll('script[type="application/ld+json"]').length
      recipeContainers: number;   // Elements with recipe-related classes/IDs
      ingredientElements: number; // Potential ingredient list elements
      instructionElements: number;// Potential instruction elements
    };
    partialData: RecipeData;      // Whatever was successfully extracted
  };
  htmlDump: string;               // document.documentElement.outerHTML
  domMetrics: {
    totalElements: number;        // document.getElementsByTagName('*').length
    imageCount: number;           // document.images.length
    linkCount: number;            // document.links.length
    listCount: number;            // document.querySelectorAll('ul, ol').length
  };
  failureReason: string;          // "Insufficient ingredients" | "Missing title" | "No instructions found"
}
```

**Implementation Requirements:**

1. **Authentication Integration:**
   - Use existing Cognito authentication flow
   - Submit with Bearer token from user session
   - Handle authentication failures gracefully

2. **Data Collection:**
   - Capture complete HTML via `document.documentElement.outerHTML`
   - Collect DOM metrics using standard web APIs
   - Record extraction timing and method attempted

3. **User Experience:**
   - Non-blocking: Failure submission never prevents normal extension operation
   - User notification: "Sent diagnostic data to improve parser"
   - Privacy respect: Clear indication when HTML data is transmitted

4. **Error Handling:**
   - Network failures: Queue locally and retry later
   - Authentication errors: Prompt user to re-authenticate
   - Rate limiting: Respect AWS rate limits (50 submissions/hour)

**Security Measures:**

- **Content Sanitization**: Remove sensitive data (passwords, tokens) from HTML before submission
- **Size Limits**: Maximum 2MB HTML dump per submission
- **User Consent**: Clear privacy policy regarding diagnostic data collection
- **Data Retention**: AWS automatically purges failure data after 90 days

**Business Impact:**
This creates a **self-improving parser ecosystem** where every real-world failure contributes to system enhancement, enabling rapid response to site changes and continuous quality improvement.

- Love & Lemons
- Damn Delicious
- Serious Eats

Start with sites having cleanest markup, expand incrementally based on success metrics.

### 3.3 Authentication-First User Experience

**CRITICAL REQUIREMENT**: RecipeArchive is a **signed-in experience** with strict authentication requirements.

#### 3.3.1 Initial User Experience

- **First Launch**: Users must see only a "Sign In" button with no other options available
- **Authentication Required**: No recipe capture functionality is accessible without authentication
- **Clear Call-to-Action**: The sign-in button should be prominent and clearly labeled

#### 3.3.2 Post-Authentication Interface

Once authenticated, the popup interface must display:

1. **Primary Action**: Large, prominent "Capture Recipe" button as the main interface element
2. **User Identity**: Clear indication of the signed-in user (email or name)
3. **Secondary Actions**: Minimalistic "Sign Out" button or link for credential management
4. **Clean Design**: Interface dedicated primarily to recipe capture

#### 3.3.3 Error Handling Requirements

- **Popup-Contained Errors**: All error messages and notifications must display within the popup window
- **Scrollable Interface**: The popup becomes scrollable when content (including errors) exceeds the viewport
- **Clear Error States**: Authentication failures, capture errors, and network issues are clearly communicated
- **Recovery Actions**: Users can easily retry failed operations or re-authenticate

### 3.4 User Workflow

1. **Trigger**: Click extension icon while on recipe page
2. **Extract**: Automatic parsing of recipe components (3-second target)
3. **Review**: Pop-up shows extracted data for verification
4. **Edit**: Optional corrections before saving
5. **Save**: Confirmation and automatic sync to cloud

### 3.5 Recipe Library Management

- **Search within saved recipes** by title and ingredients
- **Filter** by date captured, cook time, servings, source website
- **Sort** alphabetically or chronologically
- **Quick access** to recently viewed recipes
- Local cache of 50 most recent/frequent recipes for offline access

### 3.6 Data Storage & Sync

- Cloud storage for all captured recipes (AWS S3)
- Automatic cross-device synchronization with conflict resolution
- Background sync when online with version-based conflict handling
- Offline access to cached content

### 3.6 Authentication

- **AWS Cognito authentication from day 1**
- Email-based user accounts with verification
- JWT token management (1-hour access, 30-day refresh)
- Secure session management across browser restarts
- Automatic token refresh for seamless experience

## 4. Non-Functional Requirements

### 4.1 Performance Targets

| Metric           | Target                        | Measurement          |
| ---------------- | ----------------------------- | -------------------- |
| Extraction Speed | <3 seconds                    | 95th percentile      |
| Popup Load Time  | <500ms                        | Time to interactive  |
| API Response     | <300ms critical, <500ms lists | 95th percentile      |
| Sync Latency     | <5 seconds                    | Recipe availability  |
| Search Results   | <1s local cache, <2s server   | 95th percentile      |
| Offline Cache    | 50 recipes                    | Most recent/frequent |

### 4.2 Reliability & Quality

- 95% extraction success rate on priority sites
- Graceful degradation for unsupported sites
- Clear error messaging
- Automatic retry for network failures
- Rate limiting on all endpoints (configurable)

### 4.3 Technical Constraints

- Serverless AWS architecture (cost optimization)
- No Kubernetes or complex orchestration
- Minimal npm dependencies
- US-WEST-2 region default
- Chrome Manifest V3 compliance
- Safari WebExtension API
- Single-page recipe extraction only (MVP)
- **Code Documentation**: Include TODO comments for post-MVP features, specifically manual copy/paste fallback for failed extractions

## 5. Success Metrics & KPIs

### 5.1 Beta Success Criteria

| Goal               | KPI                         | Target                                    |
| ------------------ | --------------------------- | ----------------------------------------- |
| **Validate Value** | Install → First Save (24hr) | >80% activation                           |
| **Validate Value** | Active beta users           | 50+ users with 5+ saved recipes           |
| **Quality**        | Extraction success rate     | >95% for title, ingredients, instructions |
| **Quality**        | Save completion rate        | >80% of initiated captures                |
| **Engagement**     | Recipes/user/week           | 5+ minimum, 10+ stretch goal              |
| **Retention**      | 30-day retention            | >80% of activated users                   |
| **Performance**    | Time to first capture       | <2 minutes post-install                   |

### 5.2 Monitoring Requirements

- Per-site extraction success rates
- User error rates by type
- Performance metrics dashboard
- Weekly cohort retention tracking

## 6. Scope Boundaries

### 6.1 MVP Includes

- Chrome and Safari browser extensions
- One-click capture from priority sites
- Pre-save review/edit interface
- Cloud-synced recipe library
- Clean, standardized reading view
- Offline access (50 recipe cache)
- **Recipe library search within saved recipes**
- AWS Cognito authentication from day 1

### 6.2 New Feature Requirements

**Enhanced Failed Parse Workflow Integration:**
- **Failed Parse Management**: Visual indicators in extension popup for failed parsing attempts
- **Manual Entry Conversion**: One-click conversion from failed parse to manual recipe entry
- **Parser Improvement Notifications**: In-extension alerts when parsing improves for previously failed sites

**OpenAI Content Enhancement Integration:**
- **Normalization Status**: Visual badges showing recipe normalization quality scores
- **Content Improvement**: Automatic enhancement of parsed recipe titles, ingredients, and instructions
- **Metadata Enhancement**: Display of inferred cuisine types, dietary information, and cooking methods

### 6.3 Explicitly Excluded (The "Not Now" List)

- Advanced post-save editing beyond normalization
- Meal planning/calendar features
- Shopping list generation
- Social features (sharing, comments)
- **External recipe discovery and recommendations**
- **Recipe search from external sources or databases**
- User-generated content (notes, ratings) beyond personal categories
- Video recipe support
- OCR for image-based recipes
- Nutritional analysis beyond basic dietary detection
- Manual copy/paste fallback for failed extractions (include TODO comment in code)
- Multi-page recipe support

## 7. Release Strategy

### 7.1 Beta Phase Plan

- **Duration**: 8-12 weeks
- **User Cap**: Limited to personal network (wife's foodie friends)
- **Recruitment**: Direct invitation only
- **Feedback**: Direct feedback channel via personal communication
- **Iteration**: Weekly releases based on feedback

### 7.2 Beta Exit Criteria

All criteria must be met before general availability:

- 95% extraction success on all priority sites
- <5% user-facing error rate
- 80% user satisfaction (survey)
- 5+ recipes/week average for active users (10+ stretch)
- Zero critical bugs for 2 consecutive weeks

## 8. Risks & Mitigations

### 8.1 Technical Risks

| Risk                   | Impact            | Mitigation                                                                                            |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| Sites change structure | Broken extraction | Monitoring alerts, rapid parser updates                                                               |
| Complex site layouts   | Poor extraction   | Graceful failure message (Note: Include TODO comment in code for manual copy/paste fallback post-MVP) |
| AWS cost overrun       | Budget issues     | Rate limiting, usage caps, gradual rollout                                                            |

### 8.2 User Risks

| Risk                    | Impact           | Mitigation                                  |
| ----------------------- | ---------------- | ------------------------------------------- |
| Low adoption            | Product failure  | Focus on quality over quantity in beta      |
| Poor extraction quality | User frustration | Start with easiest sites, expand carefully  |
| Sync failures           | Lost recipes     | Robust retry logic, clear status indicators |

### 8.3 Open Questions

- Optimal cache size validation? (Start with 50, adjust based on usage)
- Copyright concerns? (Store attribution, focus on personal use)

## 9. Future Considerations (Post-MVP)

### 9.1 Near-term Enhancements

- Enhanced AI/ML extraction for complex sites
- Additional recipe sites beyond priority list
- Advanced search filters (tags, ingredients, nutrition)
- Recipe tagging and categorization
- Manual copy/paste fallback for failed extractions

### 9.2 Long-term Vision

- iOS native application
- Recipe scaling tools
- Nutritional information
- Multi-tenant B2B model
- API for third-party integrations

---

_This PRD defines the MVP requirements for RecipeArchive browser extensions. Success will be measured by user adoption, engagement, and satisfaction during the beta phase. The document will evolve based on user feedback and technical learnings._

---

**Document Attribution**: This Product Requirements Document was created using the [Product Requirements Assistant](https://github.com/bordenet/product-requirements-assistant) - an AI-powered tool for generating comprehensive, structured PRDs. The assistant helped ensure thoroughness, consistency, and professional formatting throughout the requirements definition process.
