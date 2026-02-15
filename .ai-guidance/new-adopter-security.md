# New Adopter Security

**Browser extensions use build-time code generation for AWS configuration.**

## Architecture

1. **Source code is generic** - No hardcoded AWS values committed to git
2. **Configuration via .env** - New adopters create `.env` with their AWS infrastructure
3. **Build generates config files** - `npm run build:extension-env` creates gitignored config files
4. **Clean separation** - Source loads values from generated files at runtime

## Setup for New Adopters

```bash
cp .env.example .env              # Configure your AWS infrastructure
./scripts/setup-new-adopter-environment.sh  # Generate extension config
npm run build:extensions          # Build extensions
```

Benefits: No forks needed, credentials never committed, generated files gitignored.

## Image & Storage Security

- Backend downloads external recipe images → uploads to S3 at `recipe-images/{recipeID}/`
- S3 bucket allows public read for `recipe-images/*`, 10s timeout, 10MB limit
- All data uses S3 (no DynamoDB in production)

## AWS Environment

| Variable | Description |
|----------|-------------|
| `S3_RECIPE_STORAGE_BUCKET` | Main recipe storage |
| `S3_TEMP_BUCKET_NAME` | Temp processing |
| `S3_FAILED_PARSING_BUCKET_NAME` | Failed parse storage |

**NEVER access S3 via AWS CLI. ALWAYS use Go tools** (auto-load from `../../.env`).

