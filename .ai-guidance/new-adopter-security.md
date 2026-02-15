# New Adopter Security

**Browser extensions use build-time code generation for AWS configuration.**

## Architecture

1. **Source code is generic** - No hardcoded AWS values committed to git
2. **Configuration via .env** - New adopters create `.env` with their AWS infrastructure details
3. **Build generates config files** - `npm run build:extension-env` creates:
   - `extensions/*/env-config.js` (gitignored, contains AWS values)
   - `extensions/*/manifest.json` (gitignored, contains API permissions)
4. **Clean separation** - Source code loads values from generated config files at runtime

## Setup Process for New Adopters

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env with YOUR AWS infrastructure

# 2. Generate extension configuration
./scripts/setup-new-adopter-environment.sh

# 3. Build extensions
npm run build:extensions
```

## Key Benefits

- ✅ No source code forks required
- ✅ AWS credentials never committed to git
- ✅ Easy to update configuration (regenerate files)
- ✅ Safe distribution (generated files are gitignored)

## Image Security Architecture

- Backend automatically downloads external recipe images and uploads to S3
- Images stored at `recipe-images/{recipeID}/recipes/main-photo.{ext}`
- S3 bucket policy allows public read for `recipe-images/*` path
- Image downloads have 10s timeout and 10MB size limit
- Manual uploads from extensions go directly to S3

## Storage Architecture

All data storage uses S3, no DynamoDB in production.

## AWS Environment Setup

The project uses environment variables from `.env` for AWS authentication and bucket names:

| Variable | Value |
|----------|-------|
| `S3_RECIPE_STORAGE_BUCKET` | `recipe-storage-0ea7007d57f67ecb-990537043943` |
| `S3_TEMP_BUCKET_NAME` | `recipe-temp-0ea7007d57f67ecb-990537043943` |
| `S3_FAILED_PARSING_BUCKET_NAME` | `recipe-failed-0ea7007d57f67ecb-990537043943` |

All Go tools automatically load these from `../../.env` relative to their location.

**NEVER access S3 directly via AWS CLI commands. ALWAYS use the provided Go tools.**

