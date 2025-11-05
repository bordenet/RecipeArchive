# Large Go File Refactoring Plan

**Goal**: Break down large Go files (>500 lines) into smaller, more maintainable modules for better LLM efficiency and code organization.

**Priority**: High - improves LLM context window usage and code maintainability

---

## Files Requiring Refactoring

### Priority 1: Lambda Functions (Production-Critical)

1. **`aws-backend/functions/recipes/main.go`** (1117 lines) - HIGHEST PRIORITY
2. **`aws-backend/functions/local-server/main.go`** (693 lines)
3. **`aws-backend/functions/content-normalizer/main.go`** (490 lines)
4. **`aws-backend/functions/backup/main.go`** (480 lines)
5. **`aws-backend/functions/analytics-aggregator/main.go`** (477 lines)

### Priority 2: Tools & CLIs

6. **`tools/cmd/recipe-cli/main.go`** (1068 lines)
7. **`aws-backend/functions/recipes/parser.go`** (795 lines)
8. **`aws-backend/functions/background-normalizer/url_parser.go`** (520 lines)

---

## Detailed Refactoring Plan: `recipes/main.go` (1117 lines)

### Current Structure

**Existing modular files** (already extracted):
- `aws_clients.go` (67 lines) - AWS client initialization, global variables
- `html_fetch.go` (93 lines) - HTML fetching utilities
- `images.go` (167 lines) - Image download/upload logic
- `normalization.go` (245 lines) - Recipe normalization logic
- `parser.go` (795 lines) - HTML parsing logic
- `search.go` (223 lines) - Search functionality

**Functions in `main.go`** (line numbers):
```
22:  main()                      - Entry point (4 lines)
26:  handler()                   - Main router (66 lines)
94:  getUserIDFromRequest()      - Auth helper (15 lines)
113: handleGetRecipes()          - GET router (9 lines)
124: handleGetRecipeByID()       - GET single (55 lines)
181: handleListRecipes()         - GET list (83 lines)
267: handleSearchRecipes()       - Search (see search.go)
392: handleCreateRecipe()        - POST create (430 lines) ⚠️ LARGEST
824: handleUpdateRecipe()        - PUT update (208 lines) ⚠️ SECOND LARGEST
1032: handleDeleteRecipe()       - DELETE (86 lines)
```

### Recommended Extraction

#### Step 1: Create `handlers_get.go` (147 lines)
Extract GET handlers:
- `handleGetRecipes()` (9 lines)
- `handleGetRecipeByID()` (55 lines)
- `handleListRecipes()` (83 lines)

**Imports needed**:
```go
import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"

	"recipe-archive/models"
	"recipe-archive/utils"
)
```

**Depends on global vars from `aws_clients.go`**:
- `recipeDB`
- `logger`

**Depends on functions from `search.go`**:
- `SortSearchResults()`

#### Step 2: Create `handlers_create.go` (430 lines)
Extract POST create handler:
- `handleCreateRecipe()` (430 lines)

**Imports needed**:
```go
import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/google/uuid"

	"recipe-archive/models"
	"recipe-archive/utils"
)
```

**Depends on global vars**:
- `recipeDB`
- `logger`
- `s3Client`
- `sqsClient`
- `bucketName`

**Depends on functions from other files**:
- `fetchHTMLFromURL()` - from `html_fetch.go`
- `getDomainFromURL()` - from `html_fetch.go`
- `parseHTMLToRecipe()` - from `parser.go`
- `validateImageURL()` - from `images.go`
- `uploadWebArchiveImage()` - from `images.go`
- `downloadAndUploadImage()` - from `images.go`
- `queueRecipeNormalization()` - from `normalization.go`
- `applyBasicNormalization()` - from `normalization.go`

**Further breakdown possible** (for future optimization):
- Extract validation logic (lines 408-460) → `validation.go`
- Extract duplicate detection (lines 462-486) → `validation.go`
- Extract HTML processing (lines 488-561) → `html_processing.go`
- Extract image handling (lines 563-668) → `images.go` (extend existing)
- Extract recipe creation (lines 746-820) → `recipe_creation.go`

#### Step 3: Create `handlers_update.go` (208 lines)
Extract PUT update handler:
- `handleUpdateRecipe()` (208 lines)

**Imports needed**:
```go
import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"

	"recipe-archive/models"
	"recipe-archive/utils"
)
```

**Depends on global vars**:
- `recipeDB`
- `logger`

#### Step 4: Create `handlers_delete.go` (86 lines)
Extract DELETE handler:
- `handleDeleteRecipe()` (86 lines)

**Imports needed**:
```go
import (
	"context"
	"net/http"
	"time"

	"github.com/aws/aws-lambda-go/events"

	"recipe-archive/utils"
)
```

**Depends on global vars**:
- `recipeDB`
- `logger`

#### Step 5: Keep minimal `main.go` (80 lines)
After extraction, `main.go` should contain only:
- `main()` - Lambda entry point
- `handler()` - HTTP router
- `getUserIDFromRequest()` - Auth helper

**Imports needed**:
```go
import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"recipe-archive/utils"
)
```

### After Refactoring: File Structure

```
recipes/
├── main.go                  (80 lines)   - Entry point, router, auth
├── handlers_get.go          (147 lines)  - GET handlers (list, single)
├── handlers_create.go       (430 lines)  - POST create handler
├── handlers_update.go       (208 lines)  - PUT update handler
├── handlers_delete.go       (86 lines)   - DELETE handler
├── aws_clients.go           (67 lines)   - AWS initialization
├── html_fetch.go            (93 lines)   - HTML fetching
├── images.go                (167 lines)  - Image handling
├── normalization.go         (245 lines)  - Normalization
├── parser.go                (795 lines)  - HTML parsing
└── search.go                (223 lines)  - Search logic
```

**Total**: 2541 lines across 11 files (avg 231 lines/file)
**Before**: 1912 lines across 7 files (avg 273 lines/file)

---

## Validation Protocol (CRITICAL)

### Step 1: Pre-Refactoring Snapshot
```bash
# Save current state
cd aws-backend/functions/recipes
cp main.go main.go.backup

# Build and test current version
go build -o bootstrap *.go
./bootstrap  # Should compile successfully

# Run unit tests (if available)
go test ./...

# Deploy to AWS and verify
cd /Users/matt/GitHub/RecipeArchive
./scripts/aws/lambda.sh recipes
```

### Step 2: After Each File Extraction
```bash
# Verify compilation
go build -o bootstrap *.go

# Run linter
golangci-lint run

# Verify imports (no unused imports)
goimports -l .

# Run unit tests
go test ./...

# Test deployment package size (should not increase significantly)
zip -r deployment-package.zip bootstrap
ls -lh deployment-package.zip
```

### Step 3: Integration Testing
```bash
# Deploy to AWS Lambda
./scripts/aws/lambda.sh recipes

# Test all CRUD operations via API:
# 1. GET /recipes (list)
# 2. GET /recipes/{id} (single)
# 3. POST /recipes (create)
# 4. PUT /recipes/{id} (update)
# 5. DELETE /recipes/{id} (delete)
# 6. GET /recipes/search (search)

# Monitor CloudWatch Logs for errors
aws logs tail /aws/lambda/recipes --follow

# Check for performance regression (cold start time should be similar)
```

### Step 4: Production Verification
```bash
# Full monorepo validation
./validate-monorepo.sh --all

# Should pass all checks including:
# - Go compilation
# - Linting
# - Lambda deployment
# - Integration tests
```

---

## Rollback Strategy

If any issues occur:

```bash
cd aws-backend/functions/recipes

# Restore backup
cp main.go.backup main.go

# Remove new handler files (if created)
rm -f handlers_*.go

# Rebuild and redeploy
go build -o bootstrap *.go
cd /Users/matt/GitHub/RecipeArchive
./scripts/aws/lambda.sh recipes

# Verify rollback successful
aws logs tail /aws/lambda/recipes --follow
```

---

## Risk Mitigation

### Low-Risk Approach (Recommended)
1. Start with extracting GET handlers (`handlers_get.go`) - least complex
2. Test thoroughly before proceeding
3. Extract DELETE handler next - simple, self-contained
4. Extract UPDATE handler - moderate complexity
5. Extract CREATE handler last - most complex

### Code Review Checklist
- [ ] All global variables accessible (defined in `aws_clients.go`)
- [ ] All helper functions available (from other `.go` files in same package)
- [ ] Imports minimized (no unused imports)
- [ ] No breaking changes to function signatures
- [ ] Error handling preserved
- [ ] Logging statements maintained
- [ ] Comments and documentation preserved

---

## Similar Refactoring for Other Files

### `local-server/main.go` (693 lines)
Apply same pattern:
- Extract HTTP handlers by route
- Keep `main()` and server setup minimal
- Create `handlers_*.go` files per resource

### `parser.go` (795 lines)
Different strategy - extract by parser type:
- `parser_schema.go` - JSON-LD schema parsing
- `parser_metadata.go` - Metadata extraction
- `parser_fallback.go` - Fallback heuristics

### `background-normalizer/url_parser.go` (520 lines)
Extract by parsing stage:
- `url_extraction.go` - URL extraction logic
- `url_validation.go` - URL validation
- `url_normalization.go` - URL normalization

---

## Future Enhancements

### Phase 2: Further Break Down `handleCreateRecipe()` (430 lines)
Extract logical sections into helper functions:

```go
// validation.go
func validateCreateRecipeRequest(recipeData *models.CreateRecipeRequest) error
func checkDuplicateRecipe(userID, sourceURL string) (*models.Recipe, error)

// html_processing.go
func fetchAndParseHTML(ctx context.Context, recipeData *models.CreateRecipeRequest) error
func mergeHTMLParsedData(recipeData *models.CreateRecipeRequest, parsedRecipe *models.Recipe)

// recipe_creation.go
func createRecipeFromRequest(userID string, recipeData *models.CreateRecipeRequest, existingRecipeID string) (*models.Recipe, error)
func saveRecipeWithNormalization(ctx context.Context, recipe *models.Recipe) error
```

This would reduce `handleCreateRecipe()` from 430 lines to ~100 lines.

---

## Estimated Time Investment

- **Initial extraction**: 2-3 hours per file
- **Testing & validation**: 1-2 hours per file
- **Total for `recipes/main.go`**: 12-20 hours
- **Total for all Priority 1 files**: 40-60 hours

**Recommendation**: Tackle one file per session, with full testing cycle before moving to next file.

---

## Tools & Commands Reference

### Build & Test
```bash
# Build Lambda function
cd aws-backend/functions/recipes
GOOS=linux GOARCH=amd64 go build -o bootstrap *.go

# Run tests
go test ./...

# Lint
golangci-lint run

# Format
goimports -w .
gofmt -w .
```

### Deployment
```bash
# Deploy single Lambda
./scripts/aws/lambda.sh recipes

# Deploy all Lambdas
./scripts/aws/lambda.sh --all

# Full validation
./validate-monorepo.sh --all
```

### Monitoring
```bash
# Tail CloudWatch logs
aws logs tail /aws/lambda/recipes --follow

# Get recent errors
aws logs tail /aws/lambda/recipes --follow --filter-pattern "ERROR"

# Check function metrics
aws lambda get-function --function-name recipes
```

---

## Success Criteria

- [ ] All Go files < 500 lines
- [ ] All tests passing
- [ ] Linting clean (no golangci-lint errors)
- [ ] No unused imports
- [ ] Lambda cold start time unchanged (within 10%)
- [ ] No production errors in CloudWatch
- [ ] Full monorepo validation passing
- [ ] Git history clean (one commit per file extracted)

---

## Notes for Claude Code/Web

When resuming this work:

1. **Read this plan first** to understand the full scope
2. **Work on ONE file at a time** - complete extraction, testing, deployment before moving on
3. **Follow the validation protocol** - don't skip steps
4. **Start with lowest-risk files** (GET handlers) to build confidence
5. **Use the rollback strategy** if anything breaks
6. **Update this document** as you progress with actual findings/adjustments

Good luck! This refactoring will significantly improve LLM context efficiency. 🚀
