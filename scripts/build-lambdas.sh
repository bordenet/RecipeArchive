#!/bin/bash

# Build Lambda functions for RecipeArchive
set -e

echo "🔨 Building Lambda functions..."

# Create dist directory
mkdir -p /Users/matt/GitHub/RecipeArchive/aws-backend/functions/dist

# Build each Lambda function
FUNCTIONS_DIR="/Users/matt/GitHub/RecipeArchive/aws-backend/functions"

build_lambda() {
    local func_name=$1
    echo "  📦 Building $func_name..."
    
    # Create package directory
    mkdir -p "$FUNCTIONS_DIR/dist/${func_name}-package"
    
    # Download dependencies and build the Go binary for Linux
    cd "$FUNCTIONS_DIR/$func_name"
    go mod tidy
    go mod download
    GOOS=linux GOARCH=amd64 go build -o "$FUNCTIONS_DIR/dist/${func_name}-package/bootstrap" main.go
    
    echo "  ✅ $func_name built successfully"
}

# Build all functions
build_lambda "health"
build_lambda "recipes" 
build_lambda "image-upload"

echo "🎉 All Lambda functions built successfully!"
echo ""
echo "📁 Built packages:"
ls -la "$FUNCTIONS_DIR/dist/"