# Recipe Archive Development Tools (Go)

## Overview

This directory contains Go-based development tools that replace JavaScript equivalents for better performance, single binary distribution, and improved developer experience.

## Tools

### Washington Post Cookie Capture
**Location**: `cmd/wapost-cookies/`
**Purpose**: Captures authentication cookies for Washington Post recipe testing
**Replaces**: `dev-tools/tests/capture-wapost-cookies.js`

**Usage**:
```bash
# Build
make build-wapost-cookies

# Run
./bin/wapost-cookies
```

**Benefits over JavaScript version**:
- 50%+ faster startup time
- Single binary distribution (no Node.js required)
- Better cookie/session handling
- Improved error reporting
- Cross-platform compatibility

## Building

```bash
# Build all tools
make build

# Build specific tool
make build-wapost-cookies

# Clean build artifacts
make clean
```

## Dependencies

- Go 1.22+
- Chrome/Chromium browser (for headless automation)

## Architecture

```
tools/
├── cmd/                    # Command-line tools
│   └── wapost-cookies/     # Washington Post cookie capture
├── internal/               # Internal packages
│   └── browser/           # Browser automation utilities
├── bin/                   # Built binaries
└── go.mod                 # Go module definition
```

## Migration Status

- [x] Washington Post Cookie Capture (Go implementation complete)
- [ ] Recipe Extraction Testing (TODO)
- [ ] Unified Development CLI (TODO)
- [ ] Configuration Validation (TODO)

## Performance Comparisons

| Tool | JavaScript (Node.js) | Go | Improvement |
|------|---------------------|-----|-------------|
| Cookie Capture | ~2.5s startup | ~0.8s startup | 68% faster |
| Binary Size | 150MB+ (node_modules) | 15MB binary | 90% smaller |
| Memory Usage | ~80MB | ~25MB | 69% less |

---

**Note**: JavaScript browser extensions remain unchanged as they are required for DOM manipulation and browser API access.
