#!/bin/bash

#===============================================================================
# RecipeArchive Lambda Package Builder for CDK Deployment
#===============================================================================
# PURPOSE: Build all Lambda function packages for AWS CDK deployment
#
# HOW IT WORKS:
#   1. Discovers all Lambda functions with main.go files
#   2. Builds each function for Linux (AWS Lambda runtime)
#   3. Creates properly structured packages in functions/dist/
#   4. Ready for CDK deployment via deploy-aws-infrastructure.sh
#
# USAGE:
#   ./scripts/build-lambda-packages.sh              # Build all packages
#   ./scripts/build-lambda-packages.sh analytics    # Build specific package
#   ./scripts/build-lambda-packages.sh --clean      # Clean all packages
#   ./scripts/build-lambda-packages.sh --list       # List available functions
#
# REQUIREMENTS: Go installed, functions with main.go files
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNCTIONS_DIR="$REPO_ROOT/aws-backend/functions"
DIST_DIR="$FUNCTIONS_DIR/dist"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "${BLUE}🚀 $1${NC}"
    echo "======================================"
}

# Get available Lambda functions (directories with main.go)
get_available_functions() {
    for dir in "$FUNCTIONS_DIR"/*/;
 do
        if [ -f "$dir/main.go" ]; then
            basename "$dir"
        fi
    done
}

# List available functions
list_functions() {
    log_header "Available Lambda Functions"
    echo ""
    printf "%25s %15s %30s\n" "Function Name" "Status" "Package Path"
    echo "$(printf '%.0s-' {1..75})"

    for func_name in $(get_available_functions);
 do
        package_path="$DIST_DIR/${func_name}-package"
        if [ -d "$package_path" ] && [ -f "$package_path/bootstrap" ]; then
            status="🟢 Built"
        else
            status="🔴 Not Built"
        fi
        printf "%25s %15s %30s\n" "$func_name" "$status" "${package_path/$REPO_ROOT/...}"
    done
    echo ""
}

# Clean all packages
clean_packages() {
    log_header "Cleaning Lambda Packages"

    if [ -d "$DIST_DIR" ]; then
        log_info "Removing existing packages..."
        rm -rf "$DIST_DIR"/*-package
        log_success "All packages cleaned"
    else
        log_info "No packages to clean"
    fi
    echo ""
}

# Build single Lambda package
build_package() {
    local func_name="$1"
    local func_dir="$FUNCTIONS_DIR/$func_name"
    local package_dir="$DIST_DIR/${func_name}-package"

    if [ ! -d "$func_dir" ]; then
        log_error "Function directory not found: $func_dir"
        return 1
    fi

    if [ ! -f "$func_dir/main.go" ]; then
        log_error "main.go not found in: $func_dir"
        return 1
    fi

    log_info "Building package for $func_name..."

    # Create package directory
    mkdir -p "$package_dir"

    # Navigate to function directory
    cd "$func_dir"

    # Build for AWS Lambda (Linux)
    log_info "Compiling Go binary for Linux..."
    if ! GOOS=linux GOARCH=amd64 go build -o bootstrap main.go > /tmp/build-lambda-packages.log 2>&1; then
        log_error "Build failed for $func_name. See /tmp/build-lambda-packages.log for details."
        return 1
    fi

    # Move binary to package directory
    mv bootstrap "$package_dir/"

    # Get file size for logging
    local file_size=$(ls -la "$package_dir/bootstrap" | awk '{print $5}')
    log_success "Built $func_name package ($file_size bytes)"

    # Return to original directory
    cd - > /dev/null
    return 0
}

# Build all packages
build_all_packages() {
    log_header "Building All Lambda Packages"

    local failed_builds=()
    local successful_builds=()
    local skipped_builds=()

    # Create dist directory if it doesn't exist
    mkdir -p "$DIST_DIR"

    for func_name in $(get_available_functions);
 do
        # Skip utility functions that aren't meant for AWS deployment
        case "$func_name" in
            "backup"|"local-server"|"s3-manager"|"test-tools")
                log_warning "Skipping utility function: $func_name"
                skipped_builds+=("$func_name")
                continue
                ;; 
        esac

        if build_package "$func_name"; then
            successful_builds+=("$func_name")
        else
            failed_builds+=("$func_name")
        fi
        echo ""
    done

    # Summary
    echo ""
    log_header "Build Summary"
    log_success "✅ Successful: ${#successful_builds[@]} (${successful_builds[*]})"

    if [ ${#skipped_builds[@]} -gt 0 ]; then
        log_warning "⏭️  Skipped: ${#skipped_builds[@]} (${skipped_builds[*]})"
    fi

    if [ ${#failed_builds[@]} -gt 0 ]; then
        log_error "❌ Failed: ${#failed_builds[@]} (${failed_builds[*]})"
        return 1
    fi

    log_success "🎉 All deployable Lambda packages built successfully!"
    return 0
}

# Check prerequisites
check_prerequisites() {
    # Check Go
    if ! command -v go > /tmp/build-lambda-packages.log 2>&1; then
        log_error "Go not found. Please install Go first."
        return 1
    fi

    return 0
}

# Print usage
print_usage() {
    echo "🚀 RecipeArchive Lambda Package Builder"
    echo ""
    echo "Usage:"
    echo "  ./scripts/build-lambda-packages.sh                # Build all packages"
    echo "  ./scripts/build-lambda-packages.sh <function>     # Build specific package"
    echo "  ./scripts/build-lambda-packages.sh --clean        # Clean all packages"
    echo "  ./scripts/build-lambda-packages.sh --list         # List available functions"
    echo "  ./scripts/build-lambda-packages.sh --help         # Show this help"
    echo ""
    echo "Available functions:"
    for func in $(get_available_functions);
 do
        echo "  - $func"
    done
}

# Main function
main() {
    local arg="${1:-}"

    case "$arg" in
        --help|-h)
            print_usage
            exit 0
            ;; 
        --list)
            list_functions
            exit 0
            ;; 
        --clean)
            clean_packages
            exit 0
            ;; 
        "")
            log_header "RecipeArchive Lambda Package Builder"
            if ! check_prerequisites; then
                exit 1
            fi
            build_all_packages
            exit $?
            ;; 
        *)
            # Check if it's a valid function name
            if echo "$(get_available_functions)" | grep -q "\b$arg\b"; then
                log_header "Building Single Package: $arg"
                if ! check_prerequisites; then
                    exit 1
                fi
                if build_package "$arg"; then
                    log_success "🎉 Package $arg built successfully!"
                    exit 0
                else
                    log_error "Failed to build package $arg"
                    exit 1
                fi
            else
                log_error "Unknown function: $arg"
                print_usage
                exit 1
            fi
            ;; 
    esac
}

# Run main function with all arguments
main "$@"
