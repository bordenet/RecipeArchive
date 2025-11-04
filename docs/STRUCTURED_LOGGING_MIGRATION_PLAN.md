# Structured Logging Migration Plan

## Overview

This document outlines the migration of all Go code in the RecipeArchive project from legacy `log` package usage to structured logging using `log/slog` (Go 1.21+).

## Goals

1. **CloudWatch Integration**: Enable CloudWatch Logs Insights queries for Lambda functions
2. **Consistent Logging**: Standardize logging format across all Go code
3. **Better Debugging**: Structured fields for filtering and aggregation
4. **No Regressions**: Test and validate each binary before proceeding to the next

## Lessons Learned (Session 1 - 2025-11-04)

### Critical Discovery: Deployment Testing Required
- **Issue**: Migration without deployment testing would have broken production
- **Solution**: Deploy each Lambda function immediately after migration
- **Process**: Build → Lint → Deploy → Test → Commit → Push
- **Emergency Deployment**: `cd function/ && GOOS=linux GOARCH=amd64 go build -o bootstrap *.go && zip deployment-package.zip bootstrap && aws lambda update-function-code --function-name [NAME] --zip-file fileb://deployment-package.zip`

### Documentation Fixes Needed
- Fixed incorrect script path in CLAUDE.md: `./scripts/deploy-lambda.sh` → `./scripts/aws/lambda.sh`
- Added missing `zip deployment-package.zip bootstrap` step to emergency deployment docs

### Critical Bug Discovery: Infinite Recursion in Deployment Script (2025-11-04)
- **Issue**: `scripts/aws/lambda.sh` had recursive function definitions causing segfault (exit code 139)
- **Root Cause**: Lines 178-188 redefined `log_info()`, `log_success()`, `log_warning()`, `log_error()` functions that called themselves infinitely
- **Impact**: ALL deployments using the script would crash immediately with exit code 139
- **Discovery Method**: Attempted to deploy invitation-manager-s3 after migration, script crashed with segfault
- **Fix Applied**: Removed all 4 recursive wrapper functions (lines 178-188), added comment noting they're provided by common.sh
- **Fix Location**: `scripts/aws/lambda.sh` lines 174-175 now have explanatory comment
- **Verification Completed**:
  - Checked all 6 already-migrated functions: NO similar bugs found
  - Checked all 7 remaining Lambda functions: NO similar bugs found
  - Ran `./tools/get-diagnostics/get-diagnostics -lambdas -since 2h -report`: No errors in production
  - Script now deploys successfully in ~8 seconds
- **Lesson Learned**: ALWAYS test deployment scripts immediately after any modifications
- **Quality Gate Added**: Deployment must succeed before marking migration complete

### Migration Efficiency
- **Bulk replacements work**: Using `perl -i -pe` for pattern-based replacements saved significant time
- **Multi-file functions**: background-normalizer had 52 log statements across 4 files - need to check all files in directory
- **Multiline statements**: Some `log.Printf` calls span multiple lines - use `perl -0777` for multiline regex

### Testing Protocol That Works
1. Replace imports: `log` → `log/slog`
2. Add logger initialization with JSONHandler
3. Bulk replace log statements with perl
4. Run `go build -o bootstrap *.go` to catch unused imports
5. Run `golangci-lint run ./...`
6. Run `go mod tidy`
7. **DEPLOY TO AWS**: Build Linux binary, zip, and update Lambda function code
8. Verify deployment succeeded (check LastUpdateStatus) -- USE SCHELL SCRIPTS to exercise them -- they catch regressions better than manual/emergency deployments. We WANT to catch and fix regressions early. And we are still not fully recovered from the aftermath of script overhaul resulting bugs from the other day.
9. Commit and push immediately
10. Move to next function

**CRITICAL**: Do not skip deployment step - compilation success does not guarantee runtime success

## Implementation Strategy

### Phase 1: Lambda Functions (Critical Path)
Lambda functions must use `slog.NewJSONHandler` for CloudWatch Logs Insights compatibility.

#### Priority 1: Core Recipe Processing
1. **content-normalizer** (461 lines) - OpenAI normalization, has logging
2. **recipes** (1858 lines) - Main API handler, likely extensive logging
3. **background-normalizer** - Background processing

#### Priority 2: Storage & Management
4. **s3-manager** (372 lines)
5. **backup** (471 lines)
6. **invitation-manager-s3** (774 lines)

#### Priority 3: Analytics & Diagnostics
7. **analytics-aggregator** (468 lines)
8. **diagnostics** (270 lines)
9. **diagnostics-mobile-share**

#### Priority 4: Supporting Functions
10. **image-upload**
11. **test-tools** (440 lines)
12. **local-server** (683 lines)
13. **health** (91 lines) - minimal, no logging currently

### Phase 2: CLI Tools
CLI tools should use `slog.NewTextHandler` for human-readable output while keeping user-facing `fmt.Printf` with emojis.

#### Priority 1: Production Tools
1. **recipe-tracer** - Production debugging
2. **get-diagnostics** - Error analysis
3. **content-ops** - Multi-tenant operations

#### Priority 2: Development Tools
4. **monorepo-validator-go** - Build validation
5. **recipe-cli** - Recipe testing
6. **s3-cleanup** - Maintenance

#### Priority 3: Testing/Experimental
7. **recipe-url-discovery** - URL testing
8. **recipe-extract-test** - Parser testing
9. **test-single-recipe** - Single recipe testing
10. **wapost-cookies** - Cookie testing

## Implementation Pattern

### Lambda Functions (JSON Handler)

```go
package main

import (
    "context"
    "log/slog"
    "os"

    "github.com/aws/aws-lambda-go/events"
    "github.com/aws/aws-lambda-go/lambda"
)

var logger *slog.Logger

func init() {
    // JSON handler for Lambda functions (CloudWatch Logs Insights compatible)
    logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
        AddSource: true, // Include source file/line for errors
    }))
}

// Lambda handler pattern
func handler(ctx context.Context, event events.APIGatewayProxyRequest) error {
    requestLogger := logger.With(
        "requestID", event.RequestContext.RequestID,
        "userID", event.RequestContext.Authorizer["userId"],
    )

    requestLogger.Info("processing request", "path", event.Path)

    // Business logic
    if err := processRequest(ctx, event); err != nil {
        requestLogger.Error("request processing failed",
            "error", err,
            "path", event.Path,
        )
        return err
    }

    requestLogger.Info("request completed",
        "path", event.Path,
        "statusCode", 200,
    )
    return nil
}
```

**Before:**
```go
log.Printf("ERROR: OpenAI normalization failed: %v\n", err)
log.Printf("INFO: Recipe normalization completed with quality score: %.1f\n", score)
```

**After:**
```go
logger.Error("openai normalization failed",
    "recipeID", recipeID,
    "userID", userID,
    "error", err,
)
logger.Info("recipe normalization completed",
    "recipeID", recipeID,
    "qualityScore", score,
    "duration", duration,
)
```

### CLI Tools (Text Handler)

```go
package main

import (
    "fmt"
    "log/slog"
    "os"
)

var logger *slog.Logger

func init() {
    // Text handler for CLI tools (human-readable)
    logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))
}

func main() {
    // User-facing output - keep emojis
    fmt.Printf("🔍 Fetching all tenants from Cognito User Pool...\n")

    // Operational logging - structured
    logger.Info("fetching tenants", "poolID", poolID)

    tenants, err := fetchTenants()
    if err != nil {
        // Operational logging
        logger.Error("failed to fetch tenants",
            "poolID", poolID,
            "error", err,
        )
        // User-facing error
        fmt.Fprintf(os.Stderr, "❌ Failed to fetch tenants: %v\n", err)
        os.Exit(1)
    }

    // User-facing success
    fmt.Printf("✅ Found %d tenants\n", len(tenants))
}
```

## Testing Protocol

For each binary:

1. **Build Test**
   ```bash
   cd <function-directory>
   go build -o bootstrap *.go
   ```

2. **Lint Test**
   ```bash
   golangci-lint run ./...
   ```

3. **Import Check**
   ```bash
   go mod tidy
   go build
   ```

4. **Functional Test** (where applicable)
   - Lambda: Deploy to test environment, invoke with test event
   - CLI: Run with test flags, verify output format

5. **Commit**
   ```bash
   git add <files>
   git commit -m "feat(logging): add structured logging to <binary-name>

   - Replace log.Printf with slog for structured fields
   - Use JSON handler for Lambda / Text handler for CLI
   - Maintain user-facing output format for CLI tools
   - Enable CloudWatch Logs Insights filtering"

   git push origin main
   ```

## Migration Checklist

### Lambda Functions (11/11 Complete - 100%)
- [x] content-normalizer (6 log statements, deployed 2025-11-04)
- [x] recipes (52 log statements, deployed 2025-11-04)
- [x] background-normalizer (52 log statements across 4 files, deployed 2025-11-04)
- [x] s3-manager (8 log statements, CLI utility - uses TextHandler, not deployed)
- [x] backup (11 log statements, CLI utility - uses TextHandler, not deployed)
- [x] invitation-manager-s3 (54 log statements, deployed 2025-11-04)
- [x] analytics-aggregator (10 log statements, deployed 2025-11-04)
- [x] diagnostics (9 log statements, deployed 2025-11-04)
- [x] diagnostics-mobile-share (0 log statements - simple function, no logging)
- [x] image-upload (7 log statements, deployed 2025-11-04)
- [x] health (0 log statements - simple health check, no logging)

### CLI Tools in aws-backend/functions/ (2/2 Complete - 100%)
- [x] test-tools (10 log statements, migrated 2025-11-04)
- [x] local-server (20 log statements, CLI HTTP server - uses TextHandler, migrated 2025-11-04)

### CLI Tools in tools/ (5/6 Complete - 83%)
- [x] recipe-tracer (already uses no logging)
- [x] get-diagnostics (already uses no logging)
- [x] content-ops (already uses no logging)
- [x] monorepo-validator-go (already uses no logging)
- [x] s3-cleanup (already uses no logging)
- [x] recipe-url-discovery (11 log statements - 7 Printf + 4 Fatalf, migrated 2025-11-04)

**Total Progress: 14/18 binaries (78%)**
**Total Log Statements Migrated: 250**

## CloudWatch Logs Insights Examples

After migration, these queries will work:

```
# Find all errors for a specific recipe
fields @timestamp, recipeID, userID, error
| filter recipeID = "abc123"
| sort @timestamp desc

# Track normalization performance
fields @timestamp, recipeID, duration, qualityScore
| filter message = "recipe normalization completed"
| stats avg(duration), avg(qualityScore) by bin(5m)

# Find slow requests
fields @timestamp, requestID, path, duration
| filter duration > 5000
| sort duration desc
```

## Common Patterns to Convert

### Error Logging
**Before:**
```go
log.Printf("ERROR: Failed to normalize recipe %s: %v", recipeID, err)
```

**After:**
```go
logger.Error("failed to normalize recipe",
    "recipeID", recipeID,
    "error", err,
)
```

### Info Logging
**Before:**
```go
log.Printf("INFO: Recipe normalized [recipeID=%s, duration=%s]", recipeID, duration)
```

**After:**
```go
logger.Info("recipe normalized",
    "recipeID", recipeID,
    "duration", duration,
)
```

### Warning Logging
**Before:**
```go
log.Printf("WARN: Retrying recipe normalization [recipeID=%s, attempt=%d]", recipeID, attempt)
```

**After:**
```go
logger.Warn("retrying recipe normalization",
    "recipeID", recipeID,
    "attempt", attempt,
)
```

### Debug Logging (Performance-Aware)
**Before:**
```go
// Not typically used
```

**After:**
```go
if logger.Enabled(ctx, slog.LevelDebug) {
    logger.Debug("detailed state",
        "data", expensiveOperation(),
    )
}
```

## Key Rules

1. **NO emojis in Lambda functions** - breaks JSON parsing
2. **NO string interpolation** - use structured fields
3. **Include AddSource: true** for error-level logs in Lambda
4. **Reuse loggers** with `.With()` for common fields
5. **Test compilation** after every change
6. **Keep user-facing output** separate from operational logs (CLI only)

## Success Criteria

- [ ] All 23 binaries compile successfully
- [ ] All binaries pass linting (golangci-lint)
- [ ] go mod tidy shows no changes
- [ ] Lambda functions produce valid JSON logs
- [ ] CLI tools maintain user-friendly output
- [ ] CloudWatch Logs Insights queries work for Lambda functions
- [ ] No functional regressions in any binary

## Rollback Plan

If issues are discovered:
1. Each binary is committed separately
2. Git history allows per-binary rollback
3. Critical Lambda functions prioritized first
4. Can pause migration at any point

## Estimated Timeline

- Lambda Functions: ~13 binaries × 15min = ~3 hours
- CLI Tools: ~10 binaries × 10min = ~1.5 hours
- **Total: ~4.5 hours** (with testing and commits)

## Next Steps

1. User pushes setup-macos.sh fixes and moves v1.3.0 tag
2. Start fresh conversation with `/clear`
3. Begin Phase 1: Lambda Functions (content-normalizer first)
4. Test, commit, push after each binary
5. Continue until all 23 binaries complete
