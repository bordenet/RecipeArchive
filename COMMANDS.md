# RecipeArchive Command Reference

## Essential Commands

| Task | Command |
| --- | --- |
| Validate All | `./validate-monorepo.sh --all` |
| Validate Quick | `./validate-monorepo.sh --p1` |
| Validate Medium | `./validate-monorepo.sh --med` |
| Validate Mobile | `./validate-monorepo.sh --mobile` |
| Deploy All | `./scripts/deploy-all.sh` |
| Deploy Lambda | `./scripts/deploy-lambda.sh --all` |
| Deploy Web App | `./scripts/web-deploy.sh` |
| Build Extensions | `npm run build:extensions` |
| Package Extensions | `./scripts/package-extensions.sh` |
| Security Scan | `npm run security:scan` |

## Essential Tools

| Task | Command |
| --- | --- |
| Content Analysis | `cd tools/content-ops && ./content-ops` |
| Recipe ID Lookup | `cd tools/content-ops && ./content-ops -include-recipe-id "RECIPE TITLE"` |
| Recipe Tracing | `cd tools/recipe-tracer && ./recipe-tracer -recipe RECIPE_ID` |
| S3 Cleanup (Preview) | `cd tools/s3-cleanup && ./s3-cleanup` |
| S3 Cleanup (Execute) | `cd tools/s3-cleanup && ./s3-cleanup --dry-run=false` |
| Diagnostics Global Report | `cd tools/get-diagnostics && ./get-diagnostics` |
| Diagnostic Harvest | `cd tools/get-diagnostics && ./get-diagnostics -all -since 7d` |
| Extension Diagnostics | `cd tools/get-diagnostics && ./get-diagnostics -extensions -since 24h` |
| Lambda Diagnostics | `cd tools/get-diagnostics && ./get-diagnostics -lambdas -since 1h` |

## iOS Development Commands

| Task | Command |
| --- | --- |
| iOS Setup | `./scripts/ios-setup.sh` |
| iOS Simulator (Auto) | `./scripts/ios-simulator.sh` |
| iOS Xcode (Manual) | `./scripts/ios-xcode.sh` |
| iOS Run (Legacy) | `./scripts/ios-run.sh` |
| iOS Build | `./scripts/ios-build.sh` |
| iOS Help | `./scripts/ios-help.sh` |
| iOS Clean | `./scripts/ios-clean.sh` |
| **iOS Production Build (Release)** | `./scripts/build-ios.sh --release --version 1.0.1` |
| **iOS Production Build (Debug)** | `./scripts/build-ios.sh --debug --version 1.0.1` |
| iOS Build Help | `./scripts/build-ios.sh --help` |

## Mobile App Commands

| Task | Command |
| --- | --- |
| Validate Mobile Setup | `./validate-monorepo.sh --mobile` |
| Build Android APK | `cd recipe_archive && ./scripts/build-mobile.sh android release` |
| Build iOS App | `cd recipe_archive && ./scripts/build-mobile.sh ios release` |
| Build Both Platforms | `cd recipe_archive && ./scripts/build-mobile.sh both release` |
| Mobile Debug Build | `cd recipe_archive && ./scripts/build-mobile.sh both debug` |

## API Gateway Management Commands

| Command | Purpose |
| --- | --- |
| `./scripts/manage-api-routes.sh show` | Display all API Gateway routes |
| `./scripts/manage-api-routes.sh validate` | Check all Lambda integrations |
| `./scripts/manage-api-routes.sh fix` | Auto-repair broken integrations |
| `./scripts/validate-api-gateway.sh` | Standalone validation script |
| `./scripts/validate-api-gateway.sh --fix` | Validate and fix in one command |

## Monitoring & CloudWatch

| Task | Command |
| --- | --- |
| Deploy Monitoring Stack | `cd aws-backend/infrastructure && npx cdk deploy RecipeArchive-Monitoring` |
| View CloudWatch Dashboard | Navigate to CloudWatch console → Dashboards → RecipeArchive-Production |
| Test Alarm Triggers | See monitoring implementation plan for test procedures |

## Other Useful Scripts

| Task | Command |
| --- | --- |
| Analyze Flutter Errors | `./tools/analyze-flutter-errors.sh` |
| Recipe Report | `./tools/recipe-report.sh` |
