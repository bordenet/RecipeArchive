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

## Outstanding Work

**E2E Test Suite:** Automated parser regression testing (P0-1)

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
