# Engineering Safety Net - Complete Guide

**Purpose**: Comprehensive documentation of automated safety mechanisms that prevent broken code, security leaks, and production failures.

## Table of Contents

1. [Overview](#overview)
2. [Pre-Commit Hooks](#pre-commit-hooks)
3. [Validation System](#validation-system)
4. [Dependency Management](#dependency-management)
5. [Build Artifact Protection](#build-artifact-protection)
6. [Environment Variable Security](#environment-variable-security)
7. [Implementation Checklist](#implementation-checklist)

---

## Overview

A comprehensive safety net consists of multiple layers of automated checks that run BEFORE code reaches version control or deployment:

```
Developer writes code
       ↓
Git commit attempted
       ↓
Pre-commit hooks run ───→ FAIL: Block commit, show errors
       ↓ PASS
Commit saved locally
       ↓
Push to remote
       ↓
CI/CD validation ───→ FAIL: Block merge, alert team
       ↓ PASS
Merged to main
       ↓
Deployment pipeline ───→ FAIL: Rollback, alert team
       ↓ PASS
Production deployment
```

**Key Principle**: Catch failures as early as possible (preferably on developer machine, not in CI/CD).

---

## Pre-Commit Hooks

### Purpose

Block broken code from entering git history by running automated checks before each commit.

### Implementation (Husky)

**1. Install Husky**

```bash
npm install --save-dev husky
npx husky install
```

**2. Create Pre-Commit Hook** (`.husky/pre-commit`)

```bash
#!/usr/bin/env bash
npm test
```

**3. Make Hook Executable**

```bash
chmod +x .husky/pre-commit
```

**4. Configure package.json**

```json
{
  "scripts": {
    "prepare": "husky install"
  }
}
```

### Additional Hooks

#### Block Binaries (`.husky/check-binaries`)

**Purpose**: Prevent compiled binaries from being committed (platform-specific, should be built from source).

```bash
#!/usr/bin/env bash
set -e

echo "🔍 Checking for compiled binaries..."

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

BINARIES_FOUND=()

while IFS= read -r file; do
    if [ ! -f "$file" ]; then
        continue
    fi

    FILE_TYPE=$(file -b "$file" 2>/dev/null || echo "unknown")

    if echo "$FILE_TYPE" | grep -qiE "(executable|Mach-O|ELF|PE32|shared object)"; then
        if ! echo "$FILE_TYPE" | grep -qiE "(shell script|text|ASCII)"; then
            BINARIES_FOUND+=("$file")
        fi
    fi
done <<< "$STAGED_FILES"

if [ ${#BINARIES_FOUND[@]} -gt 0 ]; then
    echo "❌ ERROR: Compiled binaries detected"
    for binary in "${BINARIES_FOUND[@]}"; do
        echo "  ✗ $binary"
    done
    echo ""
    echo "To fix: git reset HEAD <file>"
    exit 1
fi

echo "✅ No binaries detected"
```

#### Protect Critical Files (`.husky/protect-prds`)

```bash
#!/usr/bin/env bash

# Prevent accidental modification of critical requirement documents
PROTECTED_FILES=(
  "docs/requirements/aws-backend.md"
  "docs/requirements/ios-app.md"
  "docs/architecture/data-model.md"
)

for file in "${PROTECTED_FILES[@]}"; do
  if git diff --cached --name-only | grep -q "^$file$"; then
    echo "❌ Cannot modify protected file: $file"
    echo "These files require explicit review before changes."
    exit 1
  fi
done
```

### Testing Pre-Commit Hooks

```bash
# Test the hook manually
./.husky/pre-commit

# Force commit to bypass (use sparingly!)
git commit --no-verify -m "Emergency fix"
```

---

## Validation System

### Architecture

**Multi-tier validation** allows fast feedback for commits and comprehensive checks for releases:

| Tier | Duration | Use Case | What Runs |
|------|----------|----------|-----------|
| **p1** | ~20-30s | Pre-commit | Dependencies, core builds, critical tests |
| **med** | ~2-5min | Pre-push | P1 + extended builds, basic quality checks |
| **all** | ~5-10min | Pre-release | Everything (E2E tests, security scans, infrastructure) |

### Implementation (validate-monorepo.sh)

**Core Structure**:

```bash
#!/usr/bin/env bash

set -euo pipefail

# Tier definitions
declare -A TEST_TIERS
TEST_TIERS[p1]="dependencies builds_core tests_unit"
TEST_TIERS[med]="${TEST_TIERS[p1]} builds_extended linting"
TEST_TIERS[all]="${TEST_TIERS[med]} tests_e2e security_scan infra_check"

# Parse arguments
VALIDATION_TIER="med"  # Default

while [[ $# -gt 0 ]]; do
  case $1 in
    --p1)  VALIDATION_TIER="p1"; shift ;;
    --med) VALIDATION_TIER="med"; shift ;;
    --all) VALIDATION_TIER="all"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Run validations for selected tier
SELECTED_TESTS="${TEST_TIERS[$VALIDATION_TIER]}"

for test in $SELECTED_TESTS; do
  run_validation "$test"
done
```

### Key Validations

**1. Dependency Checks**

```bash
validate_dependencies() {
  require_command "node" "brew install node"
  require_command "go" "brew install go"
  require_command "flutter" "brew install flutter"

  # Check versions
  node_version=$(node --version)
  [[ "$node_version" =~ ^v18 ]] || die "Node.js 18+ required"
}
```

**2. Build Validation**

```bash
validate_builds() {
  # Go builds
  for dir in tools/*/; do
    (cd "$dir" && go build) || die "Go build failed: $dir"
  done

  # Node.js builds
  npm run build || die "npm build failed"

  # Flutter builds
  (cd recipe_archive && flutter build web) || die "Flutter build failed"
}
```

**3. Test Execution**

```bash
validate_tests() {
  # Unit tests
  npm test || die "npm tests failed"

  # Go tests
  go test ./... || die "Go tests failed"

  # E2E tests (only in 'all' tier)
  if [[ "$VALIDATION_TIER" == "all" ]]; then
    npm run test:e2e || die "E2E tests failed"
  fi
}
```

**4. Security Scanning**

```bash
validate_security() {
  # Check for secrets in code
  if command -v gitleaks &> /dev/null; then
    gitleaks detect --no-git || die "Secrets detected"
  fi

  # npm audit
  npm audit --audit-level=high || die "npm audit failed"

  # Go vulnerability check
  govulncheck ./... || die "Go vulnerabilities found"
}
```

### Progress Dashboard

Use Go-based validator for real-time progress:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ RecipeArchive Monorepo Validation (med)  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Prerequisites     ████████████████████  100%  ✓
Dependencies      ████████████████████  100%  ✓
Core Builds       ████████████░░░░░░░░   65%  ...
Extended Builds   ░░░░░░░░░░░░░░░░░░░░    0%
Linting           ░░░░░░░░░░░░░░░░░░░░    0%

Elapsed: 45s  |  ETA: 2m 15s
```

---

## Dependency Management

### Purpose

Ensure reproducible environments by capturing ALL dependencies in a single script.

### Implementation (setup-macos.sh)

**Modular Component Architecture**:

```
scripts/
├── setup-macos.sh              # Main entry point
└── setup-components/
    ├── 00-homebrew.sh          # Package manager
    ├── 10-essentials.sh        # Core tools (git, wget, etc.)
    ├── 20-mobile.sh            # Flutter, Android Studio, Xcode
    ├── 30-web-tools.sh         # Node.js, npm
    ├── 40-browser-tools.sh     # Chrome, Safari dev tools
    ├── 50-utilities.sh         # Optional tools
    ├── 60-monorepo.sh          # Project-specific setup
    ├── 70-env.sh               # Environment variables
    ├── 80-mcp-claude-desktop.sh # AI tools
    └── 90-mcp-claude-code.sh   # AI development tools
```

**Example Component** (`10-essentials.sh`):

```bash
#!/usr/bin/env bash

install_essentials() {
  section_start "Essential Development Tools"

  # Git
  if ! command -v git &> /dev/null; then
    brew install git
  fi

  # wget
  if ! command -v wget &> /dev/null; then
    brew install wget
  fi

  # jq (JSON processor)
  if ! command -v jq &> /dev/null; then
    brew install jq
  fi

  section_end
}
```

**Main Script** (`setup-macos.sh`):

```bash
#!/usr/bin/env bash

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
init_script

# Source all components
for component in scripts/setup-components/*.sh; do
  source "$component"
done

# Run installation
log_header "RecipeArchive Development Environment Setup"

install_homebrew
install_essentials
install_mobile_tools
install_web_tools
install_browser_tools
install_utilities
setup_monorepo
configure_environment
install_mcp_tools

log_success "Setup complete!"
```

### Benefits

- ✅ New team members: One command to full environment
- ✅ CI/CD: Reproducible build environments
- ✅ Documentation: Script IS the documentation
- ✅ Maintenance: Update script when dependencies change

---

## Build Artifact Protection

### .gitignore Patterns

**Critical Categories**:

```gitignore
# SECURITY: Never commit credentials
.env
.env.local
.env.*.local
aws-credentials.json
secrets.json
*.pem
*.key

# Binaries (platform-specific, build from source)
*.exe
*.dll
*.bin
*.a
*.o
tools/*/bin/*
aws-backend/functions/*/bootstrap

# Build artifacts
node_modules/
dist/
build/
builds/
.dart_tool/
DerivedData/
cdk.out/
*.zip
*.ipa
*.apk
*.aab

# IDE and temp files
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Test artifacts
coverage/
test-results/
playwright-report/
.validation-logs/
```

### Why This Matters

**Bad Example** (artifacts in git):

```bash
# Clone repo
git clone repo
cd repo

# Try to build
./build.sh

# ERROR: Binary from macOS doesn't work on Linux
# ERROR: node_modules from old npm version conflicts
# ERROR: Build artifacts corrupt source files
```

**Good Example** (clean git):

```bash
# Clone repo
git clone repo
cd repo

# Install dependencies
./scripts/setup-linux.sh

# Build fresh
./build.sh

# ✅ Everything works (built for THIS platform)
```

---

## Environment Variable Security

### .env File Strategy

**File Hierarchy**:

```
.env.example          # Template (committed to git)
.env                  # Local dev (NEVER commit)
.env.production       # Production (stored in AWS Secrets Manager)
.env.test             # CI/CD (stored in GitHub Secrets)
```

### .env.example Template

```bash
# ------------------------------------------------------------------------------
# AWS Authentication
# - Use `aws configure` instead of setting here (more secure)
# ------------------------------------------------------------------------------
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=

# ------------------------------------------------------------------------------
# AWS Region & Account
# ------------------------------------------------------------------------------
AWS_REGION=us-west-2
AWS_ACCOUNT_ID=your-account-id-here

# ------------------------------------------------------------------------------
# AWS S3 - Web App Hosting
# - CloudFront distribution for Flutter web app
# - Format: https://{CLOUDFRONT_ID}.cloudfront.net
# ------------------------------------------------------------------------------
S3_WEB_APP_BUCKET=your-s3-bucket-name
CLOUDFRONT_DISTRIBUTION_ID=your-cloudfront-id
WEB_APP_URL=https://your-cloudfront-id.cloudfront.net

# ------------------------------------------------------------------------------
# AWS Cognito - User Authentication
# - Find in AWS Console → Cognito → User Pools
# ------------------------------------------------------------------------------
COGNITO_USER_POOL_ID=us-west-2_XXXXXXXXX
COGNITO_APP_CLIENT_ID=your-app-client-id

# ------------------------------------------------------------------------------
# AWS S3 - Asset Storage
# - Use account-specific naming to avoid collisions
# ------------------------------------------------------------------------------
S3_RECIPE_STORAGE_BUCKET=recipearchive-storage-${AWS_ACCOUNT_ID}
S3_TEMP_BUCKET_NAME=recipearchive-temp-${AWS_ACCOUNT_ID}
S3_FAILED_PARSING_BUCKET_NAME=recipearchive-failed-${AWS_ACCOUNT_ID}

# ------------------------------------------------------------------------------
# Testing Credentials (for validate-monorepo.sh)
# - NEVER commit real credentials
# ------------------------------------------------------------------------------
RECIPE_USER_EMAIL=
RECIPE_USER_PASSWORD=
```

### Security Best Practices

**DO**:
- ✅ Use `.env.example` as documentation
- ✅ Add `.env` to `.gitignore`
- ✅ Use AWS Secrets Manager for production
- ✅ Rotate credentials regularly
- ✅ Use IAM roles instead of access keys (when possible)

**DON'T**:
- ❌ Commit `.env` files to git
- ❌ Hardcode credentials in source code
- ❌ Share `.env` files via Slack/email
- ❌ Use production credentials in development
- ❌ Store passwords in plain text

### Loading .env Files

**Shell Scripts**:

```bash
# scripts/load-env.sh
if [ -f ".env" ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "❌ .env file not found. Copy .env.example to .env"
  exit 1
fi
```

**Node.js**:

```javascript
require('dotenv').config();

const apiUrl = process.env.API_BASE_URL;
if (!apiUrl) {
  throw new Error('API_BASE_URL not set in .env');
}
```

**Go**:

```go
import "github.com/joho/godotenv"

func init() {
  if err := godotenv.Load(); err != nil {
    log.Fatal("Error loading .env file")
  }

  bucketName := os.Getenv("S3_RECIPE_STORAGE_BUCKET")
  if bucketName == "" {
    log.Fatal("S3_RECIPE_STORAGE_BUCKET not set")
  }
}
```

---

## Implementation Checklist

### New Project Setup

- [ ] **Pre-Commit Hooks**
  - [ ] Install Husky: `npm install --save-dev husky`
  - [ ] Create `.husky/pre-commit` (run tests)
  - [ ] Create `.husky/check-binaries` (block binaries)
  - [ ] Test hooks: Try committing broken code

- [ ] **Validation System**
  - [ ] Create `validate-monorepo.sh`
  - [ ] Define tiers (p1, med, all)
  - [ ] Add dependency checks
  - [ ] Add build validation
  - [ ] Add test execution
  - [ ] Add security scanning
  - [ ] Test each tier manually

- [ ] **Dependency Management**
  - [ ] Create `scripts/setup-<platform>.sh`
  - [ ] Use modular components (`setup-components/`)
  - [ ] Document all dependencies in script
  - [ ] Test on fresh machine

- [ ] **Build Artifact Protection**
  - [ ] Create comprehensive `.gitignore`
  - [ ] Add all build output directories
  - [ ] Add all binary patterns
  - [ ] Add all credential patterns
  - [ ] Test: Verify `git status` shows no artifacts

- [ ] **Environment Variable Security**
  - [ ] Create `.env.example` template
  - [ ] Add `.env` to `.gitignore`
  - [ ] Document all required variables
  - [ ] Never commit real credentials
  - [ ] Use secrets manager for production

### Maintenance

- [ ] **Weekly**
  - [ ] Run `./validate-monorepo.sh --all` on main branch
  - [ ] Review pre-commit hook execution times

- [ ] **Monthly**
  - [ ] Update dependencies in `setup-<platform>.sh`
  - [ ] Review `.gitignore` for new artifact patterns
  - [ ] Audit `.env.example` for completeness

- [ ] **Quarterly**
  - [ ] Test `setup-<platform>.sh` on fresh VM
  - [ ] Review security scanning tools (update if needed)
  - [ ] Audit pre-commit hooks (are they catching issues?)

---

## Real-World Impact

**Before Safety Net**:
- Developer commits broken code → CI fails 30 minutes later
- Build artifacts committed → 500MB repo, slow clones
- Credentials leaked → Emergency key rotation, security audit
- Platform-specific binaries → "Works on my machine" bugs
- Missing dependencies → New devs take 2 days to set up

**After Safety Net**:
- Pre-commit hook catches break in 10 seconds → Fixed before commit
- `.gitignore` prevents artifacts → 20MB repo, fast clones
- `.env.example` + gitignore → No credential leaks in 2 years
- Binary detection hook → No platform-specific binaries in git
- Setup script → New devs productive in 1 hour

---

## Further Reading

- `DEVELOPMENT_PROTOCOLS.md` - Protocols for AI-assisted development
- `SHELL_SCRIPT_STANDARDS.md` - Shell script conventions
- `PROJECT_SETUP_CHECKLIST.md` - Complete setup guide
- `VALIDATION_SYSTEM.md` - Deep dive into validation architecture
