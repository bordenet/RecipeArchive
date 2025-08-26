# RecipeArchive Lambda Functions Makefile

.PHONY: build clean deploy test health-local

# Build all Lambda functions
build:
	@echo "Building Lambda functions..."
	@mkdir -p dist/health-package dist/recipes-package
	@cd health && GOOS=linux GOARCH=amd64 go build -o ../dist/health-package/bootstrap main.go
	@cd recipes && GOOS=linux GOARCH=amd64 go build -o ../dist/recipes-package/bootstrap main.go
	@echo "✅ Build complete"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf bin/ dist/
	@echo "✅ Clean complete"

# Install dependencies
deps:
	@echo "Installing dependencies..."
	@go mod tidy
	@go mod download
	@echo "✅ Dependencies installed"

# Run tests
test:
	@echo "Running tests..."
	@go test ./...
	@echo "✅ Tests complete"

# Run health check locally (for testing)
health-local:
	@echo "Running health check locally..."
	@cd health && go run main.go

# Create deployment packages
package: build
	@echo "Creating deployment packages..."
	@echo "✅ Bootstrap binary ready in dist/"

# Deploy to AWS (requires CDK)
deploy:
	@echo "Deploying to AWS..."
	@cd ../infrastructure && npx cdk deploy
	@echo "✅ Deployment complete"

# Development workflow - build and package
dev: clean deps build package
	@echo "✅ Development build complete"

# Production workflow - test, build, and package
prod: clean deps test build package
	@echo "✅ Production build complete"
