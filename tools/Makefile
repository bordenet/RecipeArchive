# Makefile for Recipe Archive Go Tools

.PHONY: build clean test build-wapost-cookies

# Default target
all: build

# Build all tools
build: build-wapost-cookies build-recipe-extract-test build-recipe-cli

# Build Washington Post cookie capture tool
build-wapost-cookies:
	@echo "Building Washington Post cookie capture tool..."
	@mkdir -p bin
	go build -o bin/wapost-cookies ./cmd/wapost-cookies
	@echo "✅ Built: bin/wapost-cookies"

# Build recipe extraction testing tool
build-recipe-extract-test:
	@echo "Building recipe extraction testing tool..."
	@mkdir -p bin
	go build -o bin/recipe-extract-test ./cmd/recipe-extract-test
	@echo "✅ Built: bin/recipe-extract-test"

# Build unified recipe CLI (includes test single functionality)
build-recipe-cli:
	@echo "Building unified recipe CLI..."
	@mkdir -p bin
	go build -o bin/recipe-cli ./cmd/recipe-cli
	@echo "✅ Built: bin/recipe-cli (includes test single functionality)"

# Legacy individual tools (use recipe-cli instead)
build-test-single-recipe:
	@echo "⚠️  DEPRECATED: Use 'recipe-cli test single <url>' instead"
	@echo "Building legacy single recipe test tool..."
	@mkdir -p bin
	go build -o bin/test-single-recipe ./cmd/test-single-recipe
	@echo "✅ Built: bin/test-single-recipe (DEPRECATED - use recipe-cli test single)"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	@echo "✅ Cleaned"

# Run tests
test:
	@echo "Running Go tests..."
	go test -v ./...
	@echo "✅ All tests passed"

# Format code
fmt:
	go fmt ./...

# Run linter
lint:
	golangci-lint run

# Check dependencies
deps:
	go mod tidy
	go mod verify

# Install development dependencies
dev-deps:
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Show help
help:
	@echo "Available targets:"
	@echo "  build              - Build all tools"
	@echo "  build-wapost-cookies - Build Washington Post cookie tool"
	@echo "  build-recipe-extract-test - Build recipe extraction testing tool"
	@echo "  clean              - Clean build artifacts"
	@echo "  test               - Run tests"
	@echo "  fmt                - Format code"
	@echo "  lint               - Run linter"
	@echo "  deps               - Tidy and verify dependencies"
	@echo "  dev-deps           - Install development dependencies"
	@echo "  help               - Show this help"
