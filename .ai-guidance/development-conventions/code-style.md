# Code Style Conventions

## JavaScript/TypeScript Code Style

Always use double quotes in JavaScript files. This project uses ESLint with double quote enforcement.

- ✅ Correct: `console.log("Checking URL:", url);`
- ❌ Wrong: `console.log('Checking URL:', url);`

Always run `npm run lint -- --fix` after editing JavaScript files to prevent quote style errors.

## Go Code Quality Protocol

**MANDATORY: Always run compilation checks before declaring Go work complete.**

When fixing linting errors or modifying Go code:

1. **Fix the reported linting errors** using golangci-lint output
2. **IMMEDIATELY run `go build`** in the affected directory to check for:
   - Unused imports (especially after removing functions)
   - Type errors
   - Compilation failures
3. **Only declare work complete** after both linting AND compilation pass

**Common Gotcha:** Removing unused functions often leaves behind unused imports. The `go build` check will catch this immediately.

```bash
# Fix linting errors
golangci-lint run ./...

# CRITICAL: Check compilation
go build

# If imports are unused, remove them, then re-run both checks
```

**Why this matters:** Unused imports are compilation errors in Go, not just linting warnings.

