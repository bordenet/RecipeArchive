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

---

**Note**: JavaScript browser extensions remain unchanged as they are required for DOM manipulation and browser API access.
