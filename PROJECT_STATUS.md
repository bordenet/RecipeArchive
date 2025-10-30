# RecipeArchive - System Health Dashboard

**Version:** 1.0.0
**Last Updated:** 2025-10-30
**Overall Status:** 🟡 Production (Degraded)

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
| **Android Auth** | **0%** | **95%** | 🔴 |

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
| End-to-End Test Coverage | 0% | 80% | 🔴 |

## Critical Issues (P0)

### 🔴 P0-1: Android Authentication Failure

- **Impact:** 100% of Android users cannot sign in
- **Symptom:** All login attempts result in "Authentication Error" page
- **Root Cause:** Under investigation (Cognito SDK integration suspected)
- **Affected Users:** All Android platform users
- **Workaround:** None - blocking mobile Android deployment
- **Priority:** CRITICAL - Blocks Android production launch
- **Runbook:** [docs/runbooks/android-auth-failure.md](docs/runbooks/android-auth-failure.md) *(Planned Week 3)*

### 🔴 P0-2: No End-to-End Test Suite

- **Impact:** Parser regressions discovered by users, not tests
- **Risk:** Breaking changes ship to production undetected
- **Coverage:** 0% automated E2E validation for recipe capture
- **Mitigation:** Manual testing before major releases
- **Priority:** HIGH - Technical debt accumulating rapidly

### 🔴 P0-3: Lambda Cache Inefficiency

- **Impact:** 77% cache miss rate increases Lambda costs and latency
- **Symptom:** In-memory cache persists across container reuse without TTL
- **Design Flaw:** Content hashing based on counts only (insufficient)
- **Options:** (1) DynamoDB cache with TTL, (2) Disable caching entirely
- **Priority:** MEDIUM - Performance and cost optimization needed

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
| Android App | 🔴 Blocked | 1.0.0 | Auth failure - not deployable |

### Supported Recipe Sites (14)

✅ Smitten Kitchen • Food Network • NYT Cooking • Food52 • AllRecipes • Epicurious
✅ Serious Eats • Love & Lemons • Washington Post • Food & Wine • Damn Delicious
✅ Alexandra's Kitchen • Lemons and Zest • The Anthony Kitchen

## Upcoming Work

### Week 2: Build Artifact Management (In Progress)

**Goal:** Predictable, hermetic builds with semantic versioning

**Deliverables:**

- [x] Unified `./build/` directory structure
- [x] Semantic artifact naming: `RecipeArchive-{version}-{platform}-{config}.{ext}`
- [x] Documentation: `docs/development/build-system.md`
- [x] Script reorganization: Platform-specific scripts in `scripts/{platform}/`
- [x] Updated `.gitignore` for unified build directory
- [ ] Update iOS build script to output to new location (pending execution)
- [ ] Update Android build script to output to new location (pending execution)
- [ ] Update web build scripts for new location (pending execution)
- [ ] Eliminate all "auto-reset" mechanisms that fight Git (pending)
- [ ] Update documentation references (README, COMMANDS, CLAUDE)

**Migration Guide:** [WEEK2_MIGRATION.md](WEEK2_MIGRATION.md)

**Success Criteria:**

- Build output location is 100% predictable
- Zero git noise from build processes
- Trivial integration with CI/CD pipelines

### Week 3: Health Checks & Operational Runbooks (Planned)

**Goal:** Self-service diagnostics and incident response

**Deliverables:**

- [ ] `./scripts/diagnose-health.sh` - Component-level health checks
- [ ] Structured runbooks in `docs/runbooks/`:
  - [ ] `android-auth-failure.md`
  - [ ] `lambda-cache-invalidation.md`
  - [ ] `parser-regression-protocol.md`
  - [ ] `production-incident-response.md`
- [ ] Each runbook includes deterministic reproduction steps
- [ ] Health check integration with monitoring (CloudWatch)

**Success Criteria:**

- Engineers can identify and triage issues in <5 minutes
- Zero prior system knowledge required for basic diagnostics
- Incident response time reduced by 80%

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
✅ Cross-platform authentication (AWS Cognito) - iOS, Web (Android blocked)
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
