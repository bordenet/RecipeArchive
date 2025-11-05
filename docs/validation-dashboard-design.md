# Validation Dashboard Design

## Overview

The monorepo validator features a real-time terminal UI with progress tracking, structured logging, and immediate error feedback. This design doc explains the architecture and design decisions.

## Visual Design

### Dashboard Layout

```
  ═══ RecipeArchive Monorepo Validator ═══

  ✓ Prerequisites:  ██████████████████████████████████████████████████  1/1
  ✓ Dependencies:   ██████████████████████████████████████████████████  1/1
  ✓ P1:             ██████████████████████████████████████████████████  3/3
  ⋯ Mobile:         ██████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  1/3
  ⋯ Tools:          ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0/2

  Elapsed: 12s

❌ Build Android failed (timeout after 5m)
  📄 Log: .validation-logs/20251105-001234_Build_Android.log
```

**Key Features:**
- **Static dashboard**: Updates in place using ANSI escape codes (no scrolling)
- **Labeled sections**: Prerequisites, Dependencies, P1, Mobile, Tools, Infra
- **Status icons**: ⋯ (in progress), ✓ (complete), ✗ (failed)
- **Progress bars**: Beautiful styled bars using [Charm Bubbles](https://github.com/charmbracelet/bubbles)
- **Real-time errors**: Scroll below dashboard as they occur
- **Periodic updates**: Dashboard refreshes every 2 seconds to show it's alive

## Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────────┐
│                     validate-monorepo.sh                 │
│  - Builds Go validator                                   │
│  - Runs with appropriate flags (--p1, --all, etc.)      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                monorepo-validator-go (main.go)           │
│  - Parses command-line flags                            │
│  - Determines validation scope                          │
│  - Orchestrates parallel execution                      │
│  - Manages progress dashboard                           │
└─────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────┐
│   ui.go         │  │validator.go │  │validations  │
│  - Dashboard    │  │  - Logging  │  │  - Tasks    │
│  - Progress bars│  │  - Results  │  │  - Checks   │
│  - Styling      │  │  - Summary  │  │             │
└─────────────────┘  └─────────────┘  └─────────────┘
```

### Parallel Execution Model

```go
// Simplified execution flow
validations := [...] // List of ValidationTask structs
resultChan := make(chan TaskResult, len(validations))

// Launch all validations in parallel
for _, validation := range validations {
    go func(v ValidationTask) {
        result := validator.RunValidationSilent(v.Name, v.Function, projectRoot)
        resultChan <- TaskResult{Section: v.Section, Result: result}
    }(validation)
}

// Monitor progress with periodic updates
ticker := time.NewTicker(2 * time.Second)
go func() {
    for {
        select {
        case result := <-resultChan:
            dashboard.IncrementSection(result.Section, result.Success)
            redrawDashboard()
            if !result.Success {
                printError(result) // Scrolls below dashboard
            }
        case <-ticker.C:
            redrawDashboard() // Periodic refresh
        }
    }
}()
```

## Structured Logging

### Design Philosophy

**Problem:** Long-running validations need visibility without cluttering the terminal.

**Solution:** All validation output goes to timestamped log files, while the terminal shows only:
1. Clean progress dashboard
2. Real-time error notifications (with log file links)
3. Final summary with results

### Log File Structure

```
.validation-logs/
├── 20251105-001234_Prerequisite_Checks.log
├── 20251105-001234_Install_Dependencies.log
├── 20251105-001234_Build_Go_Binaries.log
├── 20251105-001234_Build_TypeScript.log
└── ...
```

**Log File Format:**
```
=== Validation: Build Go Binaries ===
Started: 2025-11-05T00:12:34-08:00
======================

[... full stdout/stderr output from validation ...]

======================
Completed: 2025-11-05T00:12:36-08:00
Duration: 2s
Success: true
```

### Implementation Details

```go
func RunValidationSilent(name string, validationFunc func(string) bool, projectRoot string) ValidationResult {
    // Create timestamped log file
    logPath := filepath.Join(projectRoot, ".validation-logs",
        fmt.Sprintf("%s_%s.log", timestamp, sanitizeFilename(name)))
    logFile, _ := os.Create(logPath)
    defer logFile.Close()

    // Redirect stdout/stderr to log file
    oldStdout, oldStderr := os.Stdout, os.Stderr
    os.Stdout, os.Stderr = logFile, logFile

    // Run validation (all output goes to log)
    success := validationFunc(projectRoot)

    // Restore stdout/stderr
    os.Stdout, os.Stderr = oldStdout, oldStderr

    return ValidationResult{...}
}
```

## UI Update Strategy

### ANSI Escape Sequence Usage

The dashboard updates in place using ANSI cursor control:

```go
func redrawDashboard() {
    // Calculate total lines (sections + headers + errors)
    moveUp := numLines + errorLines

    // Move cursor up to dashboard start
    fmt.Print(fmt.Sprintf("\033[%dA", moveUp))

    // Clear from cursor to end of screen
    fmt.Print("\033[J")

    // Redraw complete dashboard
    fmt.Println(dashboard.View())
}
```

**Key Insight:** Errors print below the dashboard and stay visible. Each new error increases `errorLines`, so we move up further to redraw the dashboard above all errors.

### Periodic Refresh

A ticker fires every 2 seconds to refresh the dashboard even when no tasks complete:

```go
ticker := time.NewTicker(2 * time.Second)

select {
case <-ticker.C:
    redrawDashboard() // Shows we're still alive
}
```

This is critical for long-running validations (e.g., Android builds taking 5+ minutes).

## Error Display Strategy

### Real-Time Error Scrolling with Log Context

**Design Decision:** For long-running validations (`--all` can take 10+ minutes), users want immediate feedback when something fails, with enough context to understand the error without opening log files.

**Structured Logging Approach:**
1. **All output goes to log files** - Every validation writes complete output to `.validation-logs/`
2. **Errors display log excerpts** - When a validation fails, show the error message + last 5 lines from the log file
3. **Log file paths included** - Full path for detailed investigation
4. **Errors scroll naturally** - Accumulate below the dashboard as they occur
5. **Final summary** - Repeats all errors for visibility

**Implementation:**
```go
// When a validation fails:
1. Display error message: "Build Android failed (timeout)"
2. Show log file path: "📄 Log: .validation-logs/..."
3. Read last 5 lines from log file using getLogTail()
4. Display excerpt in dimmed style with separators
5. Update errorLines count to maintain proper dashboard positioning
```

**Example Output:**
```
  ✓ Prerequisites:  ██████████████████████████████████████████████████  1/1
  ✓ Dependencies:   ██████████████████████████████████████████████████  1/1
  ⋯ P1:             ██████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  2/3

❌ Lint TypeScript failed (exit code 1)
  📄 Log: .validation-logs/20251105-001234_Lint_TypeScript.log
  ─────────────────────────────────────────────────────
  src/parser.ts:42:15 - error TS2345: Argument of type 'string'
    is not assignable to parameter of type 'number'.

  Found 1 error in src/parser.ts:42
  ─────────────────────────────────────────────────────

❌ Build Android failed (timeout after 5m)
  📄 Log: .validation-logs/20251105-001237_Build_Android.log
  ─────────────────────────────────────────────────────
  BUILD FAILED in 5m 0s

  * What went wrong:
  Execution failed for task ':app:mergeDebugResources'.
  > Resource compilation failed.
  ─────────────────────────────────────────────────────
```

**Benefits:**
- **Complete audit trail**: Everything is logged to files (nothing lost)
- **Immediate context**: See enough error detail to understand the problem
- **Deep investigation**: Full logs available via provided file paths
- **Clean presentation**: Dimmed excerpts don't overwhelm the dashboard
- **True structured logging**: Console display reads from structured log files

## Validation Tiers

The validator supports different scopes:

| Flag       | Scope                                      | Use Case                |
|------------|--------------------------------------------|-------------------------|
| `--p1`     | Prerequisites + Dependencies + Core Builds | Quick pre-commit checks |
| `--mobile` | Mobile builds (iOS + Android)              | Mobile development      |
| `--tools`  | Go tool compilation                        | Tool development        |
| `--infra`  | AWS infrastructure tests                   | Infrastructure changes  |
| `--all`    | Everything                                 | Pre-push validation     |

## Libraries Used

- **[lipgloss](https://github.com/charmbracelet/lipgloss)** - Terminal styling and colors
- **[bubbles](https://github.com/charmbracelet/bubbles)** - Progress bar components

These provide a professional, polished terminal UI that's consistent across platforms.

## Design Trade-offs

### ✅ Chosen Approach: Static Dashboard + Scrolling Errors

**Pros:**
- Clean, professional appearance
- Immediate error visibility
- Complete audit trail in log files
- No information loss

**Cons:**
- Requires ANSI escape sequence support
- Terminal height must fit dashboard + some errors

### ❌ Rejected: Suppress All Output Until End

**Why rejected:** Long-running validations (10+ minutes) feel unresponsive. Users want to know what's failing as it happens.

### ❌ Rejected: Live-Streaming All Output

**Why rejected:** Massive amounts of output (npm install, Go builds, etc.) make it impossible to see progress. Terminal becomes unusable.

## Performance Characteristics

- **Parallelization:** All tasks within a scope run concurrently
- **Overhead:** Minimal - progress updates are cheap ANSI operations
- **Scalability:** Tested with 20+ concurrent validations without issues
- **Timeout Protection:** Individual validations can timeout without blocking others

## Future Enhancements

1. **Colored progress bars** based on task health (green=passing, yellow=slow, red=failed)
2. **Time estimates** for long-running tasks based on historical data
3. **Interactive mode** to skip/retry individual validations
4. **Summary statistics** (average duration, slowest tasks, etc.)
5. **CI-friendly mode** with simpler output for GitHub Actions

## Related Documentation

- [validate-monorepo.sh](../validate-monorepo.sh) - Shell wrapper script
- [COMMANDS.md](../COMMANDS.md) - Usage examples and command reference
- [.validation-logs/](../.validation-logs/) - Log output directory (gitignored)
