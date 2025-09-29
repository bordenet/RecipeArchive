# RecipeArchive Lambda Functions Makefile

.PHONY: build clean deploy test health-local

# Build all Lambda functions
build:
	@echo "Building Lambda functions..."
	@mkdir -p dist/health-package dist/recipes-package dist/image-upload-package dist/diagnostics-package dist/content-normalizer-package dist/background-normalizer-package dist/diagnostic-processor-package dist/invitation-manager-package dist/registration-handler-package dist/analytics-aggregator-package dist/flutter-console-diagnostics-package
	@cd health && GOOS=linux GOARCH=amd64 go build -o ../dist/health-package/bootstrap *.go
	@cd recipes && GOOS=linux GOARCH=amd64 go build -o ../dist/recipes-package/bootstrap *.go
	@cd image-upload && GOOS=linux GOARCH=amd64 go build -o ../dist/image-upload-package/bootstrap *.go
	@cd diagnostics && GOOS=linux GOARCH=amd64 go build -o ../dist/diagnostics-package/bootstrap *.go
	@cd content-normalizer && GOOS=linux GOARCH=amd64 go build -o ../dist/content-normalizer-package/bootstrap *.go
	@cd background-normalizer && GOOS=linux GOARCH=amd64 go build -o ../dist/background-normalizer-package/bootstrap *.go
	@cd diagnostic-processor && GOOS=linux GOARCH=amd64 go build -o ../dist/diagnostic-processor-package/bootstrap *.go
	@cd invitation-manager-s3 && GOOS=linux GOARCH=amd64 go build -o ../dist/invitation-manager-package/bootstrap *.go
	@cd registration-handler && GOOS=linux GOARCH=amd64 go build -o ../dist/registration-handler-package/bootstrap *.go
	@cd analytics-aggregator && GOOS=linux GOARCH=amd64 go build -o ../dist/analytics-aggregator-package/bootstrap *.go
	@cd flutter-console-diagnostics && GOOS=linux GOARCH=amd64 go build -o ../dist/flutter-console-diagnostics-package/bootstrap *.go
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
