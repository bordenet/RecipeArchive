# RecipeArchive Command Reference

## Essential Commands

| Task | Command |
| --- | --- |
| Validate All | `./validate-monorepo.sh --all` |
| Validate Quick | `./validate-monorepo.sh --p1` |
| Validate Medium | `./validate-monorepo.sh --med` |
| Validate Mobile | `./validate-monorepo.sh --mobile` |
| Deploy All (AWS + Web) | `./scripts/aws-deploy-all.sh` |
| Deploy Lambda Functions | `./scripts/aws-deploy-lambda.sh --all` |
| Deploy Web App | `./scripts/web/deploy.sh` |
| Build Extensions | `npm run build:extensions` |
| Package Extensions | `./scripts/extensions/package.sh` |
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
| iOS Build (Dev + Run) | `./scripts/ios/build.sh --dev --run` |
| iOS Build (Production) | `./scripts/ios/build.sh --prod --device --release --version X.Y.Z` |
| iOS Build (Clean) | `./scripts/ios/build.sh --dev --clean --run` |
| iOS Build Help | `./scripts/ios/build.sh --help` |
| iOS Setup | `./scripts/ios/setup.sh` |
| iOS Simulator | `./scripts/ios/simulator.sh` |
| iOS Xcode | `./scripts/ios/xcode.sh` |
| iOS Run | `./scripts/ios/run.sh` |
| iOS Help | `./scripts/ios/help.sh` |
| iOS Clean | `./scripts/ios/clean.sh` |

## Android Development Commands

| Task | Command |
| --- | --- |
| Android Build (Dev + Run) | `./scripts/android/build.sh --dev --run` |
| Android Build (Production APK) | `./scripts/android/build.sh --prod --device --release --version X.Y.Z` |
| Android Build (Production AAB) | `./scripts/android/build.sh --prod --device --release --version X.Y.Z --appbundle` |
| Android Build (Clean) | `./scripts/android/build.sh --dev --clean --run` |
| Android Build Help | `./scripts/android/build.sh --help` |
| Android Setup | `./scripts/android/setup.sh` |
| Android Emulator | `./scripts/android/emulator.sh` |
| Android Run | `./scripts/android/run.sh` |
| Android Help | `./scripts/android/help.sh` |
| Android Clean | `./scripts/android/clean.sh` |

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
