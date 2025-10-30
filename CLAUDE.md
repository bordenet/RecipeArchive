# RecipeArchive Project Guide

**Production**: https://d1jcaphz4458q7.cloudfront.net

## CRITICAL: Git Workflow Policy

**NEVER run `git add`, `git commit`, or `git push` commands yourself.**

When work is complete:
1. **Show the user what commands to run** - provide the exact git commands as copyable text
2. **Let the user execute them** - they want to learn and save Claude Pro tokens
3. **Do NOT stage files or create commits** - the user will do this themselves

This has been requested SIX times. Follow this policy WITHOUT EXCEPTION.

## Outstanding Work

### CRITICAL: Android Cognito Authentication Failure

**Status:** App broken on Android emulator - Authentication Error page on all login attempts

**What Works:**
- App launches successfully
- Login screen displays properly
- .env file IS correctly bundled in APK (verified with `unzip -l app-debug.apk | grep .env`)
- Build scripts now auto-sync .env from root before every build
- Emulator runs successfully (Medium_Phone_API_36.1 - ARM64)

**What Fails:**
- All login attempts (both admin and non-admin credentials) result in "Authentication Error page"
- Issue started after fixing .env bundling (switched from symlink to real file copy)

**Environment Configuration:**
- Cognito credentials in `.env`: `COGNITO_USER_POOL_ID=us-west-2_rpBcEEhYK`, `COGNITO_APP_CLIENT_ID=7lm8mqr03s0m0fn17dnv373s4h`
- Auth service loads from dotenv: [auth_service.dart:90-91](recipe_archive/lib/services/auth_service.dart#L90-L91)
- Build scripts auto-sync .env: [build-android-unified.sh:238-243](scripts/build-android-unified.sh#L238-L243), [build-ios-unified.sh:212-217](scripts/build-ios-unified.sh#L212-L217)

**Investigation Steps Needed:**
1. Capture logcat output during fresh login attempt:
   ```bash
   ~/Library/Android/sdk/platform-tools/adb logcat -c
   # User attempts login on emulator
   ~/Library/Android/sdk/platform-tools/adb logcat -d | grep -i -E "flutter|cognito|auth|error|exception"
   ```
2. Check if dotenv is actually loading .env at runtime
3. Verify Cognito User Pool configuration in AWS Console
4. Compare with iOS implementation (which works correctly)
5. Check for Android-specific Cognito SDK initialization issues

**Recent Context:**
- Session focused on fixing Android build errors (spawn helper, APK paths, cmdline-tools)
- Successfully consolidated scripts from `recipe_archive/scripts/` to `./scripts/`
- Fixed .env bundling issue (symlinks don't work with Flutter assets)
- Added comprehensive documentation: [scripts/android/README.md](scripts/android/README.md), [scripts/ios/README.md](scripts/ios/README.md)

---

**Android Recipe Capture** - 4-week implementation plan (BLOCKED until Cognito fixed)
- See [ADR 003](docs/adr/003-android-recipe-capture-implementation.md) for complete execution plan
- Phase 1: Share Intent Receiver + MethodChannel (Week 1)
- Phase 2: WebView HTML Extraction + Image Download (Week 2)
- Phase 3: Flutter Integration (Week 3)
- Phase 4: Testing & Production Polish (Week 4)
- Target: Full parity with iOS WKWebView implementation

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

### CRITICAL: .env File Management

**Flutter does NOT follow symlinks in asset bundles.**

- **Root .env**: Keep the master `.env` at repository root (gitignored)
- **Flutter .env**: Copy (NOT symlink) to `recipe_archive/.env` for builds
- **Build scripts**: Automatically sync `.env` from root before every build
- **NEVER commit**: `recipe_archive/.env` must stay in `.gitignore`

Both `build-android-unified.sh` and `build-ios-unified.sh` automatically copy the root `.env` to `recipe_archive/.env` before building. This ensures the app has current environment variables without committing secrets to git.

### Development Conventions - CRITICAL

These conventions ensure consistent, maintainable, production-grade automation across the project:

#### 1. Dependency Management
- **ALL dependencies** must be installed via [`./scripts/setup-macos.sh`](scripts/setup-macos.sh)
- Never document manual installation steps without adding them to setup script
- Setup script is the single source of truth for environment configuration

#### 2. Shell Scripts for Recurring Tasks
- **Build operations**: Use shell scripts with production-grade error handling
- **Clean builds**: Dedicated scripts (not ad-hoc commands)
- **Deployment**: Simulator/device deployments via scripts
- **AWS operations**: Backend interactions via scripts (see `deploy-lambda.sh`)
- **CRITICAL: Single Scripts Directory**:
  - **ALL scripts MUST live in `./scripts/` at repository root**
  - **NEVER create scripts directories inside subdirectories** (e.g., recipe_archive/scripts/)
  - This reduces complexity and ensures consistent script locations
  - Exception: Component-specific scripts embedded in their natural locations (e.g., `package.json` scripts)
- **Required elements**:
  - `set -e` for fail-fast behavior
  - Clear error messages with exit codes
  - Status logging (info, success, error, warning)
  - Input validation
  - Usage documentation in header comments

#### 3. Long-Running Task Safety
- **MANDATORY 10-minute timeout** on all long-running operations
- Prevents blocked shells and hung processes
- Applies to:
  - Emulator/simulator deployments
  - Device deployments
  - Network operations (downloads, API calls)
  - Build operations that might hang
- Use `timeout` command or equivalent timing mechanisms

#### 4. Platform-Specific Patterns

**iOS (Gold Standard)**:
- Unified build script: [`build-ios-unified.sh`](scripts/build-ios-unified.sh)
- Direct use of native build systems (Xcode, NOT `flutter build ios`)
- Auto-reset mechanisms (project.pbxproj) to avoid git noise
- Clear dev vs prod modes
- Proper SDK targeting (iphonesimulator vs iphoneos)
- Share Extension verification
- Symlink organization in builds directory

**Android (Target Parity)**:
- Unified build script pattern (following iOS approach)
- Direct use of Gradle build system
- Proper clean/build separation
- Dev vs prod modes
- Emulator management with timeouts
- APK/AAB output verification

### iOS Recipe Capture

**Architecture**: Three-tier approach (see [ADR 002](docs/adr/002-ios-recipe-capture-architecture.md))
1. **WKWebView Proxy** (primary) - Loads page in background, extracts HTML + images
2. **Web Archive** - Offline capture with embedded resources
3. **URL-only** - Fallback for public content

**Key Implementation**: [WebViewContentLoader.swift](recipe_archive/ios/Shared/WebViewContentLoader.swift)
- Off-screen WKWebView loads URL with authenticated session
- JavaScript extracts HTML + image URLs
- URLSession downloads images (bypasses CDN restrictions)
- Base64 encodes and saves to App Group
- Flutter app processes via MethodChannel

**Files**:
- `recipe_archive/ios/Shared/WebViewContentLoader.swift` - WKWebView loader
- `recipe_archive/ios/RecipeArchive/ShareViewController.swift` - Share Extension entry point
- `recipe_archive/ios/Runner/AppDelegate.swift` - Flutter integration
- `recipe_archive/lib/services/share_channel.dart` - Dart bridge

### Android Builds - Unified Script

**All Android builds now use a single unified script**: [`./scripts/build-android-unified.sh`](scripts/build-android-unified.sh)

**Development Builds** (fast iteration, emulator):
```bash
# Quick build and run on emulator
./scripts/build-android-unified.sh --dev --run

# Release build for emulator testing
./scripts/build-android-unified.sh --dev --emulator --release

# Clean build
./scripts/build-android-unified.sh --dev --clean --run
```

**Production Builds** (Play Store, signed APK/AAB):
```bash
# Production release APK with version
./scripts/build-android-unified.sh --prod --device --release --version 1.0.1

# Production App Bundle (AAB) for Play Store
./scripts/build-android-unified.sh --prod --device --release --version 1.0.1 --appbundle
```

**Critical Architecture Decision**:
- **Use Gradle build system directly** via `./gradlew` (NOT `flutter build apk`)
- Gradle configurations: debug, release, profile
- Automatic 10-minute timeout protection on all builds
- APK/AAB output verification and symlink organization

**Key Features**:
- Uses Gradle build system directly
- Standard Gradle configurations (debug, release, profile)
- Automatic emulator management with timeouts
- Auto-resets build artifacts organization
- Dev mode: Fast `./gradlew assemble*` → APK
- Prod mode: `./gradlew bundle*` or signed APK

**Android Studio Build Fix**:
If Android Studio fails with "Cannot run program '/opt/homebrew/share/flutter/bin/flutter'" or "spawn helper" errors:

1. **Root cause**: Extended attributes on Flutter binary prevent Android Studio's Java subprocess from executing it
2. **Fix**: Remove extended attributes from Flutter installation:
   ```bash
   sudo xattr -r -d com.apple.provenance /opt/homebrew/share/flutter/bin/
   sudo xattr -r -d com.apple.provenance /opt/homebrew/share/flutter/bin/cache/
   sudo xattr -r -d com.apple.quarantine /opt/homebrew/share/flutter/bin/ 2>/dev/null || true
   ```
3. **Verification**: Command-line builds (`./gradlew assembleDebug`) should already work; this only fixes Android Studio IDE builds
4. **gradle.properties**: Set `org.gradle.java.home` to Android Studio's JDK if needed (already configured)

### iOS Builds - Unified Script

**All iOS builds now use a single unified script**: [`./scripts/build-ios-unified.sh`](scripts/build-ios-unified.sh)

**Development Builds** (fast iteration, simulator):
```bash
# Quick build and run on simulator
./scripts/build-ios-unified.sh --dev --run

# Release build for simulator testing
./scripts/build-ios-unified.sh --dev --simulator --release

# Clean build
./scripts/build-ios-unified.sh --dev --clean --run
```

**Production Builds** (App Store, TestFlight, device installs):
```bash
# Release archive with version
./scripts/build-ios-unified.sh --prod --device --release --version 1.0.1

# Creates .xcarchive at: recipe_archive/ios/build/archives/Runner.xcarchive
# Export IPA via Xcode Organizer for distribution
```

**Critical Architecture Decision**:
- **NEVER use `flutter build ios` command** - it gets confused by multiple Xcode schemes
- **ALWAYS use Xcode's build system directly** via `xcodebuild`
- Xcode's build phases call Flutter's compilation scripts automatically
- This approach avoids scheme ambiguity and is more reliable

**Key Features**:
- Uses Xcode build system (NOT Flutter build command)
- Uses "Runner" scheme with standard Xcode configurations (Debug, Release, Profile)
- Automatic Share Extension embedding verification
- Auto-resets project.pbxproj after build to avoid git noise
- Dev mode: Fast `xcodebuild build` → .app
- Prod mode: `xcodebuild build` with `-allowProvisioningUpdates` → .app (signed)

**⚠️ Xcode 16 Compatibility**: Script auto-downgrades `objectVersion 70` → `60` for CocoaPods compatibility.

## Security & Validation

### Image Security Architecture
- Backend automatically downloads external recipe images and uploads to S3
- Images stored at `recipe-images/{recipeID}/recipes/main-photo.{ext}`
- S3 bucket policy allows public read for `recipe-images/*` path
- Image downloads have 10s timeout and 10MB size limit
- Manual uploads from extensions go directly to S3

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