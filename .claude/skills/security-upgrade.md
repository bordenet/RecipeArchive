# Security Dependency Upgrade Workflow

You are a comprehensive dependency security auditor and upgrader. Your task is to:

1. **Scan all project dependencies for security vulnerabilities**
2. **Upgrade vulnerable dependencies to patched versions**
3. **Validate all changes compile and pass tests**
4. **Commit and push changes to origin main**

## Workflow Steps

### Phase 1: Security Scanning

#### npm Dependencies
```bash
# Root package.json
npm audit --json

# Chrome extension
cd extensions/chrome && npm audit --json

# Check for other package.json files
find . -name "package.json" -not -path "*/node_modules/*" -exec dirname {} \;
```

#### Go Dependencies
Install and use govulncheck for comprehensive Go security scanning:

```bash
# Install govulncheck if not present
go install golang.org/x/vuln/cmd/govulncheck@latest

# Scan Lambda functions
cd aws-backend/functions/recipes && ~/go/bin/govulncheck .
cd aws-backend/functions/content-normalizer && ~/go/bin/govulncheck .
cd aws-backend/functions/background-normalizer && ~/go/bin/govulncheck -show verbose .

# Scan tools
cd tools/content-ops && ~/go/bin/govulncheck .
cd tools/recipe-tracer && ~/go/bin/govulncheck .
cd tools/get-diagnostics && ~/go/bin/govulncheck .

# Find all affected modules
grep -r "VULNERABLE_PACKAGE" --include="go.mod" .
```

#### Flutter Dependencies
```bash
cd recipe_archive && flutter pub outdated
```

### Phase 2: Upgrade Dependencies

#### Go Module Upgrades
```bash
# For each vulnerable module, upgrade to fixed version
cd <module-path>
go get <package>@<fixed-version>
go mod tidy

# Common vulnerable packages:
# - github.com/golang-jwt/jwt/v5 → upgrade to latest
# - golang.org/x/net → upgrade to latest
```

#### npm Upgrades
```bash
# Fix vulnerabilities automatically
npm audit fix

# For breaking changes requiring manual review
npm audit fix --force  # Use with caution
```

#### Flutter Upgrades
```bash
cd recipe_archive

# Upgrade within constraints
flutter pub upgrade

# For major version upgrades
flutter pub upgrade --major-versions --dry-run  # Preview changes
# Then edit pubspec.yaml manually for selected packages
flutter pub get
```

### Phase 3: Validation

#### Compile Verification
```bash
# Verify Go modules compile
cd aws-backend/functions/recipes && go build -o /dev/null .
cd aws-backend/functions/background-normalizer && go build -o /dev/null .
cd tools/content-ops && go build -o /dev/null .
cd tools/recipe-tracer && go build -o /dev/null .

# Verify npm builds
npm run build:extensions

# Verify Flutter builds (if needed)
cd recipe_archive && flutter build web --release
```

#### Run Validation Suite
```bash
cd /Users/matt/GitHub/RecipeArchive
./validate-monorepo.sh --all
```

Expected output: All 17 validation checks should pass.

#### Security Re-scan
Re-run govulncheck to verify vulnerabilities are resolved:
```bash
cd <previously-vulnerable-module>
~/go/bin/govulncheck .
```

Expected: "No vulnerabilities found."

### Phase 4: Linting
```bash
npm run lint:fix
```

### Phase 5: Git Commit & Push

**IMPORTANT**: Only proceed if ALL validation tests pass.

```bash
# Stage all dependency changes
git add -A

# Create comprehensive commit message
git commit -m "$(cat <<'EOF'
security: upgrade dependencies to fix CVEs

Go Dependencies:
- Upgrade github.com/golang-jwt/jwt/v5 v5.0.0 → v5.2.2 (GO-2025-3553)
  Fixes excessive memory allocation during header parsing
  Affected: utils, recipes, analytics-aggregator, backup, invitation-manager-s3

- Upgrade golang.org/x/net v0.25.0 → v0.38.0 (GO-2025-3595, GO-2024-3333, GO-2025-3503)
  Fixes input neutralization, non-linear parsing, and IPv6 proxy bypass issues
  Affected: background-normalizer

Flutter Dependencies:
- package_info_plus: ^8.0.2 → ^9.0.0
- flutter_lints: ^5.0.0 → ^6.0.0
- share_plus: ^12.0.0 → ^12.0.1
- wakelock_plus: ^1.2.8 → ^1.4.0
- 25 additional transitive dependency updates

npm Dependencies:
- No vulnerabilities found (674 dependencies scanned)

Validation: All 17 validation tests passing
- Go modules compile successfully
- Security scans clean
- Linting checks pass
- Integration tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Push to origin main
git push origin main
```

## Critical Reminders

1. **Always run full validation suite** before committing
2. **Document all CVE numbers** in commit message
3. **Test compilation** of all affected modules
4. **Re-scan for vulnerabilities** after upgrades to verify fixes
5. **Update go.sum files** with `go mod tidy` after module changes
6. **Never bypass security updates** - all CVEs must be addressed

## Expected Outcomes

- ✅ Zero known security vulnerabilities in dependencies
- ✅ All Go modules compile without errors
- ✅ All 17 monorepo validation checks pass
- ✅ Linting checks pass
- ✅ Changes committed and pushed to origin main

## Troubleshooting

**If govulncheck panics:**
- Run on individual function directories instead of entire codebase
- Exclude template directories (e.g., node_modules/aws-cdk/lib/init-templates)

**If validation fails:**
- Do NOT commit or push
- Review error messages carefully
- Fix issues before proceeding
- Re-run validation suite

**If breaking changes introduced:**
- Review package changelogs
- Update code to accommodate API changes
- Run comprehensive test suite
- Consider gradual rollout for major version bumps
