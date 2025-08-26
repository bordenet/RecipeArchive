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

### 3.1 Recipe Capture & Data Requirements

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

### 3.2 Supported Websites (MVP Priority)

Must achieve 95% extraction success on:

- Washington Post Recipes
- Food & Wine
- New York Times Cooking
- Smitten Kitchen
- Love & Lemons
- Damn Delicious
- Serious Eats

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

#### 3.3.6 Automatic Diagnostic Capture (ENHANCED REQUIREMENT)

**CRITICAL ENHANCEMENT**: Both extensions must automatically capture diagnostic data when recipe extraction fails, without user intervention.

**Automatic Trigger Conditions:**

- Recipe extraction fails (missing title AND either ingredients OR steps)
- Parser returns incomplete or malformed data
- Site structure changes break existing parsers

**Implementation Requirements:**

- **Failure Detection**: `isExtractionFailed()` function validates extraction quality
- **Automatic Submission**: Failed extractions trigger `sendAutoDiagnosticData()`
- **User Notification**: Clear messaging that diagnostic data was automatically sent
- **Non-Blocking**: Auto-diagnostic failures never break user experience
- **AWS Endpoint**: `/v1/diagnostics/auto` for automatic submissions

**Business Impact:**
This creates a **self-improving parser ecosystem** where every real-world failure contributes to system enhancement, enabling rapid response to site changes and continuous quality improvement.

- Love & Lemons
- Damn Delicious
- Serious Eats

Start with sites having cleanest markup, expand incrementally based on success metrics.

### 3.3 User Workflow

1. **Trigger**: Click extension icon while on recipe page
2. **Extract**: Automatic parsing of recipe components (3-second target)
3. **Review**: Pop-up shows extracted data for verification
4. **Edit**: Optional corrections before saving
5. **Save**: Confirmation and automatic sync to cloud

### 3.4 Recipe Library Management

- **Search within saved recipes** by title and ingredients
- **Filter** by date captured, cook time, servings, source website
- **Sort** alphabetically or chronologically
- **Quick access** to recently viewed recipes
- Local cache of 50 most recent/frequent recipes for offline access

### 3.5 Data Storage & Sync

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

### 6.2 Explicitly Excluded (The "Not Now" List)

- Advanced post-save editing
- Meal planning/calendar features
- Shopping list generation
- Social features (sharing, comments)
- **External recipe discovery and recommendations**
- **Recipe search from external sources or databases**
- User-generated content (notes, ratings)
- Video recipe support
- OCR for image-based recipes
- Nutritional analysis
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
