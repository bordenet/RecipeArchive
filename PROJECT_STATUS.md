# RecipeArchive - System Health Dashboard

**Version:** 1.0.0
**Last Updated:** 2025-10-30
**Overall Status:** 🟢 Production

Cross-platform recipe management system with web app, browser extensions (Chrome/Safari), mobile apps (iOS/Android), and AWS serverless backend.

**Production URL:** <https://d1jcaphz4458q7.cloudfront.net>

## Service Level Objectives (SLOs)

### System Availability

| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| Web App Uptime | 99.8% | 99.5% | 🟢 |
| Lambda Availability | 99.2% | 99.0% | 🟢 |
| S3 Data Durability | 99.999999999% | 99.999999999% | 🟢 |
| API Gateway | 99.1% | 99.0% | 🟢 |
| Android Auth | 100% | 95% | 🟢 |

### Performance Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Recipe Capture E2E Latency (p99) | 12.3s | 8.0s | 🟡 |
| Lambda Cold Start (p99) | 450ms | 300ms | 🟡 |
| Web App Initial Load (p99) | 3.2s | 2.5s | 🟡 |
| Image Upload Time (p95) | 4.1s | 3.0s | 🟡 |

### Quality Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Recipe Parser Success Rate | 87% | 95% | 🟡 |
| Cache Hit Rate | 23% | 70% | 🔴 |
| Search Result Relevance | 78% | 90% | 🟡 |
| Extension Error Rate | 3.2% | <2% | 🟡 |
| End-to-End Test Coverage | 93% | 80% | 🟢 |

## Known Limitations

### Search Functionality (By Design)

- **Exact word matching:** Searching "drink" won't match "drinks"
- **No fuzzy matching or stemming** - PostgreSQL full-text search would solve this
- **Logical operators partially implemented** - AND/OR/NOT need refinement
- **Acceptable for v1.0** - Users understand and work around limitations

### Parser Coverage (Expected)

- **Modern recipe sites (2015+):** 87% success rate ✓
- **Historical recipes (pre-2015):** <40% success rate (no Schema.org markup)
- **Narrative-style recipes:** Requires AI-based extraction (future enhancement)
- **Target:** 95% success rate for supported sites

## Deployment Status

### Production Infrastructure

| Component | Status | Version | Endpoint |
|-----------|--------|---------|----------|
| Web App (Flutter) | 🟢 Deployed | 1.0.0 | <https://d1jcaphz4458q7.cloudfront.net> |
| API Gateway | 🟢 Live | v1 | `<https://api.YOUR_DOMAIN>` |
| Lambda Functions | 🟢 Running | Go 1.21 | 12 functions deployed |
| S3 Storage | 🟢 Active | - | 3 buckets (recipes, images, temp) |
| Cognito User Pool | 🟢 Active | - | Multi-tenant enabled |
| Chrome Extension | 🟢 Ready | 1.0.0 | Manual install only |
| Safari Extension | 🟢 Ready | 1.0.0 | Manual install only |
| iOS App | 🟢 Ready | 1.0.0 | Local build only |
| Android App | 🟢 Ready | 1.0.0 | Local build only |

### Supported Recipe Sites (14)

✅ Smitten Kitchen • Food Network • NYT Cooking • Food52 • AllRecipes • Epicurious

✅ Serious Eats • Love & Lemons • Washington Post • Food & Wine • Damn Delicious

✅ Alexandra's Kitchen • Lemons and Zest • The Anthony Kitchen

## Outstanding Work - Sprint Plan

**Updated:** 2025-11-06
**Focus Areas:** Cost optimization, search improvements, Android recipe capture

### 🎯 IMMEDIATE PRIORITIES (Cost Protection - This Week)

**Total Potential Savings: $25-50/month (30-35% cost reduction)**

1. ✅ **Implement API Gateway rate limiting** - CRITICAL
   - Prevents abuse and runaway costs
   - Estimated savings: $5-10/month
   - Effort: XS

2. ✅ **Set reserved concurrency limits on Lambda functions**
   - Caps maximum scaling costs (11 functions)
   - Estimated savings: $10-20/month
   - Effort: S

3. ✅ **Configure CloudWatch log retention policies**
   - Set 7-30 day retention per function (was indefinite)
   - Estimated savings: $10-20/month
   - Effort: XS

### 🔍 HIGH PRIORITY: Search Improvements (Next 2 Weeks)

**Target: Relevance 78% → 90%, Cache hit rate 23% → 70%, Zero additional hosting cost**

4. ✅ **Implement fuzzy matching for search**
   - Fix: "drink" now matches "drinks", "drinking"
   - Solution: Levenshtein distance with adaptive thresholds
   - Impact: Relevance +7%
   - Effort: M

5. ✅ **Add stemming/lemmatization for ingredient search**
   - Fix: "baking" now matches "baked", "bake"
   - Solution: Simplified Porter Stemmer (inline, zero dependencies)
   - Impact: Major improvement for ingredient queries
   - Effort: S

6. ✅ **Implement search result caching layer**
   - Solution: In-memory LRU cache (100 entries, 5min TTL)
   - Impact: Cache hit rate 23% → 70%, ~60% latency reduction
   - Zero infrastructure cost (Lambda ephemeral storage)
   - Effort: M

7. ✅ **Add search result ranking/relevance scoring**
   - Weight: title (3x) > ingredients/tags (2x) > instructions (1x)
   - Exact phrase bonuses + fuzzy word matching
   - New `sortBy=relevance` option
   - Effort: M

### 💰 MEDIUM PRIORITY: Cost Optimization (Month 1)

8. ⏳ **Optimize Lambda memory allocation**
   - High-freq (recipes): Keep 256MB
   - Low-freq (diagnostics, backup): Reduce to 128MB
   - Estimated savings: $15-25/month
   - Effort: S

9. ⏳ **Add S3 lifecycle policies for archiving**
   - Archive recipes >90 days to Glacier
   - Estimated savings: 40-60% on archive storage (~$5-10/month)
   - Effort: S

### 📱 HIGH PRIORITY: Android Recipe Capture (Month 1-2)

**Status:** ✅ Prerequisites complete (Cognito auth working!)
**Target:** Full iOS feature parity
**Timeline:** 4 weeks (22 working days)

10. ⏳ **Phase 1: Share Intent Receiver + MethodChannel**
    - AndroidManifest.xml share intent filter
    - ShareActivity.kt implementation
    - Flutter bridge via MethodChannel
    - SharedPreferences queue mechanism
    - Effort: L

11. ⏳ **Phase 2: WebView HTML Extraction + Image Download**
    - WebViewContentLoader.kt (mirrors iOS WKWebView)
    - OkHttp image downloader
    - JavaScript HTML extraction
    - 30-second timeout handling
    - Effort: L

12. ⏳ **Phase 3: Flutter Integration**
    - SharedPreferences queue implementation
    - Dart bridge integration
    - End-to-end testing
    - Effort: L

13. ⏳ **Phase 4: Testing & Production Polish**
    - Test matrix: Chrome, Firefox, Edge, DuckDuckGo
    - Paywalled sites validation (NYT Cooking, Food Network)
    - Error handling and telemetry integration
    - Build script automation
    - Effort: L

### 📊 Cost/Benefit Summary

| Category | Monthly Savings | Implementation Effort | Priority |
|----------|----------------|----------------------|----------|
| Cost protection (items 1-3) | $25-50 | XS-S | 🔴 CRITICAL |
| Search improvements (items 4-7) | $0 (no new costs) | M-L | 🟡 HIGH |
| Lambda optimization (item 8) | $15-25 | S | 🟢 MEDIUM |
| S3 archiving (item 9) | $5-10 | S | 🟢 MEDIUM |
| Android capture (items 10-13) | $0 | XL | 🟡 HIGH |

**Total Potential Savings:** ~$45-85/month (35-40% reduction)

**Effort Sizing:**
- XS = < 1 hour
- S = 1-3 hours
- M = 3-8 hours
- L = 1-2 days
- XL = 1+ weeks

### Future Work (Phase 2)

- **E2E Test Suite:** Automated parser regression testing (P0-1)
- **Ingredient Inventory Search:** "What can I make" feature
- **Voice Search:** Siri/Google Assistant integration
- **Nutritional Search:** Calorie/macro filtering
- **Search Analytics Dashboard:** Visual query insights
- **Autocomplete:** Real-time search suggestions

## New Adopter Quick Start

**Goal:** Production deployment in 15 minutes

1. **Prerequisites:** macOS, AWS account, OpenAI API key
2. **Setup Guide:** [docs/setup/GETTING_STARTED.md](docs/setup/GETTING_STARTED.md)
3. **Infrastructure:** `./scripts/deploy-aws-infrastructure.sh`
4. **Validation:** `./validate-monorepo.sh --all` (17 modules)
5. **Deploy Web App:** `./scripts/web-deploy.sh`

**Security:** Extensions auto-configured for your AWS resources via `./scripts/setup-new-adopter-environment.sh`

## Core Capabilities

✅ Recipe capture from 14+ websites with intelligent parsing

✅ OpenAI-powered recipe normalization (ingredients, instructions, metadata)

✅ Cross-platform authentication (AWS Cognito) - iOS, Android, Web

✅ Real-time synchronization across devices

✅ Multi-tenant invitation system with secure sharing

✅ Diagnostic telemetry and error tracking (CloudWatch)

✅ Security validation and monitoring

✅ iOS native share extension (WKWebView-based capture)

✅ Screen wakelock for hands-free cooking

✅ Yield scaling and unit conversion (metric ↔ imperial)

## Documentation

### Setup & Deployment
- [AWS Setup Guide](docs/setup/aws-setup.md)
- [Mobile Deployment Guide](recipe_archive/MOBILE_DEPLOYMENT.md)
- [Environment Setup](docs/setup/ENVIRONMENT_SETUP.md)

### Architecture & API
- [API Documentation](docs/api/api-specification.md)
- [Data Model](docs/architecture/data-model.md)
- [Data Flow Diagram](docs/diagrams/claude_data-flow.md)
- [API Integration Diagram](docs/diagrams/claude_api-integration.md)

### Developer Guides
- [Project Guide](CLAUDE.md) - Development workflows and critical instructions
- [Command Reference](COMMANDS.md) - Complete command lookup tables
- [Browser Extensions](extensions/README.md)
