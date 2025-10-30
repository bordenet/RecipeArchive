# RecipeArchive - Project Status v1.0.0

**Status: Production with Critical Issues**

Recipe management solution with web app, browser extensions, and AWS serverless backend. Currently experiencing significant quality and reliability problems.

## Platform Status

### Deployed
- **Web App**: https://d1jcaphz4458q7.cloudfront.net (Flutter web)
- **Backend**: AWS Lambda (Go), API Gateway, Cognito, S3
- **Browser Extensions**: Chrome & Safari (14+ supported recipe sites)

## Critical Issues Requiring Immediate Attention

### Validation Gaps

- [ ] **No end-to-end validation test suite**
  - Parser changes not tested against actual websites
  - No regression testing for known-good recipes
  - Breakage discovered by users, not tests

### Architectural Issues

- [ ] **Unreliable In-memory Lambda cache**
  - Persists across Lambda container reuse
  - No cache invalidation strategy
  - Content hashing insufficient (based on counts only)
  - Consider: DynamoDB cache with TTL or disable caching entirely

## New Adopter Support

Clone-and-deploy available with complete AWS infrastructure setup:
- Setup script: `./scripts/setup-new-adopter-environment.sh`
- AWS deployment guide: [docs/setup/aws-setup.md](docs/setup/aws-setup.md)
- Security: Extensions configured for adopter's own AWS resources
- Validation: `./validate-monorepo.sh --all` ensures correctness

## Core Features

- Recipe capture from 14+ websites with intelligent parsing
- OpenAI-powered recipe normalization
- Cross-platform authentication (AWS Cognito)
- Real-time synchronization across devices
- Multi-tenant invitation system
- Diagnostic telemetry and error tracking
- Security validation and monitoring

## Known Limitations

### Search Functionality
Search logic is currently brittle with exact word matching:
- Searching for `drink` works, but `drinks` may not match
- No fuzzy matching or stemming
- Logical operators (AND/OR/NOT) not fully implemented

### Parser Coverage
- Modern recipe sites generally work
- Historical recipes (pre-2015) often fail
- Narrative-style recipes without structured markup are problematic

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
