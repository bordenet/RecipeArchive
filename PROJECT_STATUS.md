# RecipeArchive - Project Status v1.0.0

**Status: Production Release**

Production-ready recipe management solution with web app, browser extensions, and AWS serverless backend. Mobile apps and store submissions are not currently prioritized.

## Platform Status

### ✅ Production Deployed
- **Web App**: https://d1jcaphz4458q7.cloudfront.net (Flutter web)
- **Backend**: AWS Lambda (Go), API Gateway, Cognito, S3
- **Browser Extensions**: Chrome & Safari (14+ supported recipe sites)

### 🛠️ Development Toolchains Available
- **Mobile Apps**: Flutter iOS/Android toolchains operational
- **Distribution**: Not currently pursuing app store or extension store submissions

## New Adopter Support

Clone-and-deploy ready with complete AWS infrastructure setup:
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

## Current Focus

Monitoring Lambda function performance and cost optimization.

**Note:** This project has been [deliberately tuned](./aws-backend/infrastructure#cost-management) to minimize web hosting expenses.

## Known Limitations

### Search Functionality
Search logic is currently brittle with exact word matching:
- Searching for `drink` works, but `drinks` may not match
- No fuzzy matching or stemming
- Logical operators (AND/OR/NOT) not fully implemented
- Could be enhanced if there's sufficient demand

## Future Considerations

Core functionality complete. Potential future work (not currently prioritized):
- App store submissions (Google Play, Apple App Store, Chrome/Safari extension stores)
- Additional recipe website support
- Social features (sharing, ratings, reviews)
- Meal planning and grocery list integration

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
