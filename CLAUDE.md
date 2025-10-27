# RecipeArchive Project Guide v1.0.0

## Current Status

**v1.0.0 Production**: https://d1jcaphz4458q7.cloudfront.net

**CRITICAL**: Review PROJECT_STATUS.md for list of critical issues requiring immediate attention.

ALWAYS review COMMANDS.md to find project-specific tools, including tools for diagnostic error harvesting, tracing, and deployments. DO NOT "wing it" with direct S3 access, direct lambda deployments, etc.

### Infrastructure Validation Protocol

When making infrastructure changes, ALWAYS:

1. Run deployment scripts completely
2. Validate ALL Lambda function environment variables
3. Test end-to-end functionality via app
4. Check SQS queues, triggers, and Lambda event mappings
5. Monitor CloudWatch logs for integration errors
6. Use `./validate-monorepo.sh --all` for comprehensive validation

### Go Tools

- **`content-ops`**: A multi-tenant content operations utility for analyzing recipes across all tenants in AWS S3. It supports pagination for large datasets and provides operational insights for multi-tenant management.
- **`recipe-tracer`**: An end-to-end tracing tool that tracks recipe processing through S3, SQS, and CloudWatch logs, with cache performance analysis and detailed normalization debugging.
- **`get-diagnostics`**: Collects and analyzes diagnostic telemetry from web extensions, Flutter apps, and Lambda functions for error triage and production monitoring. Default (no flags) produces a global report.

## CODE STYLE MANDATE

Always use double quotes in JavaScript files. This project uses ESLint with double quote enforcement.
- Correct: `console.log("Checking URL:", url);`
- Wrong: `console.log('Checking URL:', url);`

Always run `npm run lint -- --fix` after editing JavaScript files to prevent quote style errors.

## Quick Start Commands

```bash
# From repository root:
./validate-monorepo.sh --all           # Validate all components
npm run build:extensions               # Build extensions with latest parser fixes
npm run security:scan                  # Check for security issues
```

**See [COMMANDS.md](COMMANDS.md) for complete command reference tables.**

## New Adopter Security

Browser extensions contain hardcoded AWS infrastructure references. New adopters must deploy their own AWS infrastructure via CDK and run `./scripts/setup-new-adopter-environment.sh` to configure extensions.

## Mobile Development

iOS/Android toolchain available

## Security & Validation

### Image Security Architecture
- Extensions upload images directly to S3 only
- Backend validates S3-only image URLs, external URLs rejected for security
- Never implement server-side image fetching

### CORS Issue Handling
- When CORS blocks image downloads, report via diagnostics
- Use diagnostic reporting to identify domains needing CORS rule updates
- Do not fall back to server-side downloads

### Storage Architecture
- All data storage uses S3, no DynamoDB in production

## Debugging Protocol

### Reviewing Work from Other AI Agents - CRITICAL PROTOCOL

**When asked to review and integrate work from Google Gemini or other AI agents:**

1. **ASSUME THE WORK IS DONE**: If told "AI X did the implementation", trust that code changes exist
2. **READ CAREFULLY**: Distinguish between:
   - Review the PLAN (just documentation, no code yet)
   - Review the IMPLEMENTATION (code changes already made)
3. **NEVER `git restore` without explicit permission**: File changes may represent hours of work
4. **Check git diff FIRST**: Before making assumptions, review what actually changed
5. **When uncertain, ASK**: "Should I review the plan document or the actual implementation changes?"

**Common Mistake Pattern to Avoid:**
- User: "Review Gemini's work on X"
- Wrong: Assume no implementation exists, restore files
- Right: Check git status/diff, review actual changes made

**Why this matters:** Running `git restore` on implemented work wastes thousands of tokens recreating completed work and damages trust. The cost of asking a clarifying question is trivial compared to the cost of undoing real work.

### Build & Compilation Issues - CRITICAL ESCALATION POLICY

**MANDATORY: When encountering build/compilation errors:**

1. **After 5 minutes OR 3 failed attempts**, STOP and generate a Perplexity.ai prompt
2. Include in prompt:
   - Exact error message
   - Environment details (Xcode version, OS version, tool versions)
   - Project structure (Flutter/React/Go/etc.)
   - Steps already attempted
   - Full dependency chain if applicable (CocoaPods, npm, etc.)
3. **DO NOT continue troubleshooting without external research**
4. Use Perplexity's findings to guide solution, don't reinvent the wheel

**Example scenarios requiring Perplexity escalation:**
- Xcode circular dependency errors
- CocoaPods version compatibility issues
- Build system failures across multiple attempts
- Obscure compiler/linker errors
- Platform-specific toolchain issues

**Why this matters:** Build toolchain issues often have known solutions in the community. Spending 30+ minutes on trial-and-error wastes time when a 2-minute search would reveal the answer.

### AWS Environment Setup

The project uses environment variables from `.env` for AWS authentication and bucket names:
- **S3_RECIPE_STORAGE_BUCKET**: `recipe-storage-0ea7007d57f67ecb-990537043943`
- **S3_TEMP_BUCKET_NAME**: `recipe-temp-0ea7007d57f67ecb-990537043943`
- **S3_FAILED_PARSING_BUCKET_NAME**: `recipe-failed-0ea7007d57f67ecb-990537043943`

All Go tools automatically load these from `../../.env` relative to their location.

**NEVER access S3 directly via AWS CLI commands. ALWAYS use the provided Go tools.**

### For Recipe Normalization Issues

**Standard workflow for missing ingredients/instructions:**

1. **Find Recipe ID** (from repo root):
   ```bash
   cd tools/content-ops && ./content-ops -include-recipe-id "Recipe Name"
   ```

2. **Trace Processing** (from repo root):
   ```bash
   cd tools/recipe-tracer && ./recipe-tracer -recipe RECIPE_ID
   ```

   This shows:
   - Current recipe state (ingredient count, instruction count)
   - Processing timeline with CloudWatch logs
   - Cache performance
   - S3 operations
   - Any errors encountered

3. **Analyze Output**:
   - If "Ingredients: 0" and "Instructions: 0" → scraper failed to extract content
   - Check CloudWatch logs in output for normalization errors
   - Look for cache hits that might indicate stale data
   - Verify S3 operations show PUT events

**For Production Error Triage:**

Tools are pre-built and run from repository root.

IMPORTANT: `get-diagnostics` tool location TBD - tool may not exist yet. Use CloudWatch Logs Insights directly if needed.

## Deployment Rules

### Quality Gates

- Always run `./validate-monorepo.sh --all` before GitHub push
- Test multi-file Go builds: `go build -o bootstrap *.go` in function directories
- Pre-commit hooks include comprehensive compilation validation for all components
- Do not bypass Husky checks

### Lambda Deployment

```bash
# Preferred method
./scripts/deploy-lambda.sh recipes
./scripts/deploy-lambda.sh --all

# Emergency only
cd aws-backend/functions/[name]
GOOS=linux GOARCH=amd64 go build -o bootstrap *.go
aws lambda update-function-code --function-name [NAME] --zip-file fileb://deployment-package.zip
```

## Important Instructions

Do what has been asked; nothing more, nothing less.
NEVER create files unless absolutely necessary.
ALWAYS prefer editing existing files.
NEVER proactively create documentation files.

### Localhost Policy

NEVER attempt to run Flutter locally or test localhost endpoints. This consistently fails and wastes significant tokens. Always work directly with the production environment at https://d1jcaphz4458q7.cloudfront.net for testing and debugging.

### Post-Push Procedure

**Standard process after successful GitHub push:**

1. Remove all backwards-looking "Recent Completed Work" sections from CLAUDE.md
2. Archive accomplishments to maintain lean documentation focused on:
   - Current issues requiring attention
   - How-to guidance for upcoming work
   - Essential context for development workflow
3. Keep document orientation forward-looking and actionable

# important-instruction-reminders
- Do what has been asked; nothing more, nothing less.
- NEVER create files unless they're absolutely necessary for achieving your goal.
- ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation files (*.md) or README files if existing documents can be updated. Only create new documentation files if explicitly requested by the User.
- In cases where we need to find a recipeID from a recipe title, remember to use tools/content-ops/content-ops -include-recipe-id
- In cases where we're reviewing normalization issues, remember to use tools/recipe-tracer
- In cases where we're reviewing Flutter errors, remember to use tools/analyze-flutter-errors.sh
- In cases where we're reviewing recipe reports, remember to use tools/recipe-report.sh