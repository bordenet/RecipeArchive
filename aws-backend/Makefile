# RecipeArchive AWS Backend Testing Makefile

# Configuration
TEST_USER_ID := test-user-001
DYNAMODB_TABLE_NAME := RecipeArchive-Recipes-Dev  
S3_STORAGE_BUCKET := recipearchive-storage-dev-990537043943
TEST_DATA_FILE := functions/testdata/test-recipes.json

# Build variables
GO_FILES := $(shell find functions -name "*.go" -type f)
TEST_TOOLS_DIR := functions/test-tools
TEST_TOOLS_BINARY := $(TEST_TOOLS_DIR)/test-tools

.PHONY: help build clean test-all load-test-data cleanup-all cleanup-s3 cleanup-dynamodb validate-crud list-recipes

# Default target
help:
	@echo "RecipeArchive AWS Backend Testing Commands"
	@echo "=========================================="
	@echo ""
	@echo "Setup and Build:"
	@echo "  build              - Build all Go binaries"
	@echo "  clean              - Clean all built binaries and temporary files"
	@echo ""
	@echo "Data Management:"
	@echo "  load-test-data     - Load test recipe data into DynamoDB"
	@echo "  list-recipes       - List all recipes for test user"
	@echo ""
	@echo "Testing:"
	@echo "  test-all           - Run complete test suite (build, load data, validate CRUD)"
	@echo "  validate-crud      - Run CRUD operation validation tests"
	@echo "  test-url-overwrite - Test URL-based recipe overwrite behavior"
	@echo "  test-backup        - Test backup functionality"
	@echo ""
	@echo "Cleanup:"
	@echo "  cleanup-all       - Clean both S3 and DynamoDB test data"
	@echo "  cleanup-s3        - Clean all objects from S3 bucket"
	@echo "  cleanup-dynamodb  - Clean all DynamoDB items for test user"
	@echo ""
	@echo "Configuration:"
	@echo "  TEST_USER_ID      = $(TEST_USER_ID)"
	@echo "  DYNAMODB_TABLE    = $(DYNAMODB_TABLE_NAME)"
	@echo "  S3_BUCKET         = $(S3_STORAGE_BUCKET)"

# Build the test tools binary
build: $(TEST_TOOLS_BINARY)

$(TEST_TOOLS_BINARY): $(GO_FILES)
	@echo "🔨 Building test tools..."
	cd $(TEST_TOOLS_DIR) && go build -o test-tools .

# Clean built binaries
clean:
	@echo "🧹 Cleaning built binaries..."
	rm -f $(TEST_TOOLS_BINARY)

# Load test data into DynamoDB
load-test-data: build
	@echo "📥 Loading test data into DynamoDB..."
	cd $(TEST_TOOLS_DIR) && \
		DYNAMODB_TABLE_NAME=$(DYNAMODB_TABLE_NAME) \
		S3_STORAGE_BUCKET=$(S3_STORAGE_BUCKET) \
		./test-tools -action=load-test-data -test-data=../testdata/test-recipes.json

# List all recipes for the test user
list-recipes: build
	@echo "📋 Listing recipes for test user..."
	cd $(TEST_TOOLS_DIR) && \
		DYNAMODB_TABLE_NAME=$(DYNAMODB_TABLE_NAME) \
		S3_STORAGE_BUCKET=$(S3_STORAGE_BUCKET) \
		./test-tools -action=list-recipes -user-id=$(TEST_USER_ID)

# Run CRUD validation tests
validate-crud: build
	@echo "🧪 Running CRUD validation tests..."
	cd $(TEST_TOOLS_DIR) && \
		DYNAMODB_TABLE_NAME=$(DYNAMODB_TABLE_NAME) \
		S3_STORAGE_BUCKET=$(S3_STORAGE_BUCKET) \
		./test-tools -action=validate-crud -user-id=$(TEST_USER_ID)

# Clean up all test data (S3 + DynamoDB)
cleanup-all: cleanup-s3 cleanup-dynamodb

# Clean up S3 bucket
cleanup-s3: build
	@echo "🧹 Cleaning up S3 bucket..."
	cd $(TEST_TOOLS_DIR) && \
		DYNAMODB_TABLE_NAME=$(DYNAMODB_TABLE_NAME) \
		S3_STORAGE_BUCKET=$(S3_STORAGE_BUCKET) \
		./test-tools -action=cleanup-s3

# Clean up DynamoDB test data
cleanup-dynamodb: build
	@echo "🧹 Cleaning up DynamoDB test data..."
	cd $(TEST_TOOLS_DIR) && \
		DYNAMODB_TABLE_NAME=$(DYNAMODB_TABLE_NAME) \
		S3_STORAGE_BUCKET=$(S3_STORAGE_BUCKET) \
		./test-tools -action=cleanup-dynamodb -user-id=$(TEST_USER_ID)

# Test URL-based recipe overwrite behavior
test-url-overwrite: build
	@echo "🔄 Testing URL-based recipe overwrite behavior..."
	cd $(TEST_TOOLS_DIR) && \
		S3_STORAGE_BUCKET=$(S3_STORAGE_BUCKET) \
		./test-tools -action=test-url-overwrite

# Test backup functionality
test-backup: build
	@echo "📦 Testing backup functionality..."
	cd $(TEST_TOOLS_DIR) && \
		S3_STORAGE_BUCKET=$(S3_STORAGE_BUCKET) \
		./test-tools -action=test-backup -user-id=$(TEST_USER_ID)

# Run complete test suite
test-all: build cleanup-all load-test-data validate-crud test-url-overwrite test-backup
	@echo ""
	@echo "✅ Complete test suite finished successfully!"
	@echo "📊 Test Summary:"
	@echo "  - Built test tools binary"
	@echo "  - Cleaned up existing test data"
	@echo "  - Loaded fresh test data (5 recipes)"
	@echo "  - Validated all CRUD operations"
	@echo "  - Tested URL-based recipe overwrite behavior"
	@echo "  - Validated backup functionality"
	@echo ""
	@echo "🎯 Next Steps:"
	@echo "  - Run 'make list-recipes' to see loaded data"
	@echo "  - Run 'make cleanup-all' when done testing"
	@echo "  - Deploy backup Lambda for production use"

# Development helpers
dev-reset: cleanup-all load-test-data
	@echo "🔄 Development environment reset complete"

# Show current test data status
status: build
	@echo "📊 Current Test Data Status:"
	@echo "============================"
	@make list-recipes

# Validate environment variables are set
check-env:
	@if [ -z "$(AWS_REGION)" ]; then echo "⚠️  AWS_REGION not set, using default"; fi
	@if [ -z "$(AWS_PROFILE)" ]; then echo "⚠️  AWS_PROFILE not set, using default"; fi
	@echo "🔧 Environment Configuration:"
	@echo "   AWS Region: $${AWS_REGION:-default}"
	@echo "   AWS Profile: $${AWS_PROFILE:-default}"
	@echo "   DynamoDB Table: $(DYNAMODB_TABLE_NAME)"
	@echo "   S3 Bucket: $(S3_STORAGE_BUCKET)"

# Quick test - just validate CRUD without full setup
quick-test: build validate-crud
	@echo "⚡ Quick CRUD validation complete"