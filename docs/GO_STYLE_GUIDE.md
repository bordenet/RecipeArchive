# RecipeArchive Go Style Guide

This document defines the Go coding standards for the RecipeArchive project. All Go code must follow these conventions to ensure consistency and maintainability.

## 1. Import Organization

Imports must be grouped in three sections, separated by blank lines:

```go
import (
	// Standard library
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	// Third-party packages
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"

	// Local packages
	"recipe-archive/db"
	"recipe-archive/models"
	"recipe-archive/utils"
)
```

Within each group, imports are sorted alphabetically. Use `goimports` to auto-format.

## 2. Naming Conventions

### Variables and Functions
- Use **camelCase** for unexported names
- Use **PascalCase** for exported names
- Use descriptive names (avoid single-letter except loop counters)
- Acronyms should be all caps (e.g., `userID`, `httpClient`, `URLParser`)

```go
// Good
var bucketName string
var s3Client *s3.Client
func fetchHTMLFromURL(ctx context.Context, urlStr string) (string, error)

// Bad
var bucket_name string
var S3Client *s3.Client
func FetchHtmlFromUrl(ctx context.Context, url string) (string, error)
```

### Constants
- Use **PascalCase** for exported constants
- Use **camelCase** for unexported constants
- Group related constants together

```go
const (
	defaultTimeout  = 15 * time.Second
	maxRetries      = 3
	DefaultBucketName = "recipe-storage"
)
```

### Types and Structs
- Use **PascalCase** for type names
- Use descriptive field names
- Add JSON tags for serialization

```go
type NormalizationMessage struct {
	RecipeID string `json:"recipeId"`
	UserID   string `json:"userId"`
	Action   string `json:"action"`
}
```

## 3. Function Documentation

All exported functions and types must have documentation comments:

```go
// FetchRecipe retrieves a recipe from S3 by ID.
//
// It returns an error if the recipe does not exist or if
// there's a problem accessing S3.
func FetchRecipe(ctx context.Context, recipeID string) (*models.Recipe, error) {
	// Implementation
}
```

Documentation comments:
- Start with the function/type name
- Use complete sentences
- Explain what the function does, not how
- Document parameters and return values when not obvious
- Use empty line between summary and details

## 4. Error Handling

### Error Wrapping
Always wrap errors with context using `fmt.Errorf` and `%w`:

```go
if err != nil {
	return nil, fmt.Errorf("failed to fetch recipe %s: %w", recipeID, err)
}
```

### Error Messages
- Start with lowercase (wrapped errors)
- Be specific about what failed
- Include relevant identifiers (IDs, names)

```go
// Good
return fmt.Errorf("failed to parse recipe ID %s: %w", id, err)

// Bad
return fmt.Errorf("Error: %v", err)
return errors.New("something went wrong")
```

### Logging Errors
Use structured logging with context:

```go
log.Printf("ERROR: Failed to normalize recipe %s: %v", recipeID, err)
```

## 5. Structured Logging

### Use log/slog for Structured Logging
For all new Go code, use the standard `log/slog` package (Go 1.21+) for structured logging. This provides better CloudWatch integration and easier log parsing.

```go
import (
	"context"
	"log/slog"
	"os"
)

var logger *slog.Logger

func init() {
	// JSON handler for Lambda functions (CloudWatch Logs Insights compatible)
	logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	// Text handler for CLI tools (human-readable)
	// logger = slog.New(slog.NewTextHandler(os.Stdout, nil))
}
```

### Logging Levels
- `Debug()` - Detailed diagnostic information (development/troubleshooting only)
- `Info()` - Normal operation milestones, request tracking
- `Warn()` - Recoverable issues, degraded functionality
- `Error()` - Critical failures, data loss, service disruption

```go
// Good - structured fields
logger.Info("recipe normalized",
	"recipeID", recipeID,
	"userID", userID,
	"duration", duration,
)

// Good - error context
logger.Error("failed to normalize recipe",
	"recipeID", recipeID,
	"error", err,
)

// Bad - unstructured string formatting
log.Printf("INFO: Recipe %s normalized by user %s", recipeID, userID)
```

### Context Propagation
Pass logger through context for request-scoped logging:

```go
type contextKey string

const loggerKey contextKey = "logger"

// Add logger with request context
func withLogger(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey, logger)
}

// Get logger from context
func getLogger(ctx context.Context) *slog.Logger {
	if logger, ok := ctx.Value(loggerKey).(*slog.Logger); ok {
		return logger
	}
	return slog.Default()
}

// Lambda handler pattern
func HandleRequest(ctx context.Context, event events.APIGatewayProxyRequest) error {
	requestLogger := logger.With(
		"requestID", event.RequestContext.RequestID,
		"userID", event.RequestContext.Authorizer["userId"],
	)
	ctx = withLogger(ctx, requestLogger)

	// All subsequent logs include requestID and userID
	getLogger(ctx).Info("processing request", "path", event.Path)
	return processRequest(ctx, event)
}
```

### Structured Fields vs String Formatting
Always use structured fields instead of string interpolation:

```go
// Good - structured fields for filtering/aggregation
logger.Info("recipe created",
	"recipeID", recipeID,
	"source", source,
	"ingredientCount", len(ingredients),
)

// Bad - string formatting makes filtering difficult
logger.Info(fmt.Sprintf("Recipe %s created from %s with %d ingredients",
	recipeID, source, len(ingredients)))

// Good - error wrapping with structured context
if err != nil {
	logger.Error("database query failed",
		"query", "GetRecipe",
		"recipeID", recipeID,
		"error", err,
	)
	return fmt.Errorf("failed to fetch recipe %s: %w", recipeID, err)
}

// Bad - loses error type information
if err != nil {
	logger.Error(fmt.Sprintf("Database error: %v", err))
}
```

### Performance Considerations
Structured logging has minimal overhead, but follow these guidelines:

```go
// Good - log at appropriate level
if logger.Enabled(ctx, slog.LevelDebug) {
	logger.Debug("detailed state", "data", expensiveOperation())
}

// Bad - always evaluates expensive operation
logger.Debug("detailed state", "data", expensiveOperation())

// Good - reuse logger with common fields
recipeLogger := logger.With("recipeID", recipeID, "userID", userID)
recipeLogger.Info("starting normalization")
recipeLogger.Info("parsing ingredients")
recipeLogger.Info("normalization complete")

// Bad - repeat fields in every log
logger.Info("starting", "recipeID", recipeID, "userID", userID)
logger.Info("parsing", "recipeID", recipeID, "userID", userID)
logger.Info("complete", "recipeID", recipeID, "userID", userID)
```

### CloudWatch Logs Integration
Use JSON handler for Lambda functions to enable CloudWatch Logs Insights queries:

```go
// Lambda function initialization
func init() {
	logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
		AddSource: true, // Include source file/line for errors
	}))
}

// Enables CloudWatch Logs Insights queries like:
// fields @timestamp, recipeID, userID, duration
// | filter recipeID = "abc123"
// | sort @timestamp desc
```

### Emoji Usage (Console Tools Only)
Lambda functions: NO emojis (breaks JSON parsing, CloudWatch aggregation)
CLI tools: Emojis OK for user-facing output (stdout), not structured logs

```go
// Lambda function - NO emojis, JSON structured logs
logger.Info("recipe normalized", "recipeID", recipeID)

// CLI tool - emojis for user output, structured logs for debugging
fmt.Printf("✅ Recipe normalized successfully: %s\n", recipeID)
logger.Info("recipe normalized", "recipeID", recipeID)
```

### Legacy log Package
For existing code using the `log` package, maintain consistency:

```go
// Prefix-based levels for legacy code
log.Printf("ERROR: Failed to normalize recipe %s: %v", recipeID, err)
log.Printf("WARN: Retrying recipe normalization [recipeID=%s, attempt=%d]", recipeID, attempt)
log.Printf("INFO: Recipe normalized [recipeID=%s, duration=%s]", recipeID, duration)

// Include structured context in brackets
log.Printf("INFO: Processing batch [batchID=%s, size=%d, userID=%s]", batchID, size, userID)
```

**Migration Strategy**: Convert legacy logging to `log/slog` during refactoring, not as standalone changes.

## 6. Context Handling

Always pass `context.Context` as the first parameter:

```go
func ProcessRecipe(ctx context.Context, recipe *models.Recipe) error {
	// Use ctx for cancellation, deadlines, and timeouts
}
```

Use context for:
- HTTP requests
- AWS SDK calls
- Database operations
- Long-running operations

## 7. Testing

### Test File Naming
- Test files: `*_test.go`
- Place tests next to code they test

### Test Function Naming
```go
func TestFetchRecipe_Success(t *testing.T)
func TestFetchRecipe_NotFound(t *testing.T)
func TestFetchRecipe_S3Error(t *testing.T)
```

### Table-Driven Tests
Use table-driven tests for multiple cases:

```go
func TestNormalizeTitle(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"lowercase", "pasta carbonara", "Pasta Carbonara"},
		{"all caps", "CHOCOLATE CAKE", "Chocolate Cake"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeTitle(tt.input)
			if got != tt.expected {
				t.Errorf("got %q, want %q", got, tt.expected)
			}
		})
	}
}
```

## 8. Function Organization

Organize functions in this order:
1. Package imports
2. Package-level variables and constants
3. `init()` function (if needed)
4. `main()` or handler function
5. Public functions (alphabetical)
6. Private functions (alphabetical)
7. Helper functions
8. Type definitions at the end (or top if central to package)

## 9. Code Formatting

### Use gofmt and goimports
All code must be formatted with `gofmt` and have imports organized with `goimports`:

```bash
# Format all Go files
gofmt -w .

# Organize imports
goimports -w .
```

### Line Length
- Keep lines under 120 characters
- Break long function calls across lines:

```go
recipe, err := recipeDB.GetRecipe(
	ctx,
	userID,
	recipeID,
	db.WithCache(true),
	db.WithTimeout(30*time.Second),
)
```

### Vertical Spacing
- One blank line between functions
- One blank line between logical blocks
- No blank lines at start/end of functions

## 10. AWS SDK Best Practices

### Client Initialization
Initialize AWS clients once in `init()` or at package level:

```go
var s3Client *s3.Client

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		panic(fmt.Sprintf("failed to load AWS config: %v", err))
	}
	s3Client = s3.NewFromConfig(cfg)
}
```

### Context Usage
Always pass context to AWS SDK calls:

```go
result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
	Bucket: aws.String(bucketName),
	Key:    aws.String(key),
})
```

### Error Handling
Check AWS-specific error types when needed:

```go
var nsk *types.NoSuchKey
if errors.As(err, &nsk) {
	return nil, fmt.Errorf("recipe not found: %w", err)
}
```

## 11. Performance Considerations

### Avoid Unnecessary Allocations
```go
// Good - reuse buffer
var buf bytes.Buffer
json.NewEncoder(&buf).Encode(data)

// Bad - creates new buffer each time
data := bytes.NewBuffer(nil)
```

### Use Appropriate Data Structures
```go
// Use map for lookups
recipeIndex := make(map[string]*Recipe, len(recipes))

// Use slice for ordered collections
recipeList := make([]*Recipe, 0, expectedCount)
```

## 12. Security Best Practices

### Input Validation
Always validate external input:

```go
func ValidateRecipeID(id string) error {
	if id == "" {
		return errors.New("recipe ID cannot be empty")
	}
	if !isValidUUID(id) {
		return fmt.Errorf("invalid recipe ID format: %s", id)
	}
	return nil
}
```

### No Secrets in Code
Use environment variables for sensitive data:

```go
apiKey := os.Getenv("OPENAI_API_KEY")
if apiKey == "" {
	return errors.New("OPENAI_API_KEY environment variable not set")
}
```

## 13. Comments

### When to Comment
- Explain WHY, not WHAT
- Document non-obvious behavior
- Explain complex algorithms
- Note important assumptions
- Reference tickets/ADRs for decisions

```go
// Use exponential backoff to avoid overwhelming OpenAI API during rate limits.
// See ADR-004 for retry strategy decisions.
func retryWithBackoff(ctx context.Context, fn func() error) error {
	// Implementation
}
```

### TODO Comments
```go
// TODO(username): Add caching layer for frequently accessed recipes
// See: https://github.com/org/repo/issues/123
```

## 14. Linting

Use `golangci-lint` with project configuration:

```bash
golangci-lint run ./...
```

Common enabled linters:
- `errcheck` - Check error handling
- `gofmt` - Code formatting
- `goimports` - Import organization
- `govet` - Go vet analysis
- `staticcheck` - Static analysis
- `unused` - Detect unused code

## Summary

This style guide ensures consistent, maintainable, and idiomatic Go code across the RecipeArchive project. When in doubt:

1. Follow standard Go idioms
2. Run `gofmt` and `goimports`
3. Use `golangci-lint`
4. Keep it simple and readable
5. Document exported APIs
6. Handle errors explicitly
