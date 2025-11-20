#!/usr/bin/env bash

################################################################################
# RecipeArchive Extension Cleanup
################################################################################
# PURPOSE: Keep only the latest 2 versions of each browser extension
#   - Scans S3 bucket for extension files
#   - Analyzes versions by platform (Chrome, Safari)
#   - Preserves specified number of latest versions
#   - Deletes older versions (with confirmation or --auto)
#
# USAGE:
#   ./scripts/cleanup-old-extensions.sh              # Interactive mode
#   ./scripts/cleanup-old-extensions.sh --dry-run    # Show what would be deleted
#   ./scripts/cleanup-old-extensions.sh --auto       # Auto-delete old versions
#
# EXAMPLES:
#   ./scripts/cleanup-old-extensions.sh --dry-run
#   ./scripts/cleanup-old-extensions.sh --auto
#
# DEPENDENCIES:
#   - AWS CLI
#
# ENVIRONMENT VARIABLES:
#   - S3_RECIPE_STORAGE_BUCKET (optional, can override default bucket)
#
# NOTES:
#   - Always preserves the 2 most recent versions of each platform
#   - Includes --dry-run mode for safe testing
#   - Requires confirmation unless --auto is specified
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly BUCKET_NAME="${S3_RECIPE_STORAGE_BUCKET:-recipe-storage-<RANDOM_ID>-<ACCOUNT_ID>}"
readonly EXTENSIONS_PREFIX="extensions/"
readonly KEEP_VERSIONS=2

# Command line options
DRY_RUN=false
AUTO_DELETE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --auto)
            AUTO_DELETE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--dry-run] [--auto] [--help]"
            echo "  --dry-run   Show what would be deleted without actually deleting"
            echo "  --auto      Delete automatically without confirmation"
            echo "  --help      Show this help message"
            exit 0
            ;;
        *)
            die "Unknown option: $1"
            ;;
    esac
done

log_header "Extension Cleanup"

log_info "Bucket: s3://$BUCKET_NAME/$EXTENSIONS_PREFIX"
log_info "Keeping: $KEEP_VERSIONS latest versions per platform"
if [[ "$DRY_RUN" == true ]]; then
    log_warning "Mode: DRY RUN (no files will be deleted)"
fi
echo ""

# Validate dependencies
require_command "aws" "brew install awscli"

# Function to extract version from filename
extract_version() {
    local filename="$1"
    # Extract version from patterns like "RecipeArchive-Chrome-v0.3.9.zip"
    echo "$filename" | sed -n 's/.*-v\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)\.zip$/\1/p'
}

# Function to compare semantic versions
version_compare() {
    local v1="$1"
    local v2="$2"

    # Split versions into arrays
    IFS='.' read -ra V1 <<< "$v1"
    IFS='.' read -ra V2 <<< "$v2"

    # Compare major, minor, patch
    for i in {0..2}; do
        local n1=${V1[i]:-0}
        local n2=${V2[i]:-0}

        if ((n1 > n2)); then
            return 1  # v1 > v2
        elif ((n1 < n2)); then
            return 2  # v1 < v2
        fi
    done

    return 0  # v1 == v2
}

# Get all extension files
log_section "Scanning for Extension Files"

mapfile -t all_files < <(aws s3 ls "s3://$BUCKET_NAME/$EXTENSIONS_PREFIX" 2>/dev/null | grep -E 'RecipeArchive-(Chrome|Safari)-v[0-9]+\.[0-9]+\.[0-9]+\.zip$' | awk '{print $4}')

if [[ ${#all_files[@]} -eq 0 ]]; then
    log_warning "No extension files found in s3://$BUCKET_NAME/$EXTENSIONS_PREFIX"
    exit 0
fi

log_info "Found ${#all_files[@]} extension files"

# Separate by platform and sort by version
declare -A chrome_files=()
declare -A safari_files=()

for file in "${all_files[@]}"; do
    version=$(extract_version "$file")
    if [[ -z "$version" ]]; then
        log_warning "Could not extract version from $file"
        continue
    fi

    if [[ "$file" == *"Chrome"* ]]; then
        chrome_files["$version"]="$file"
    elif [[ "$file" == *"Safari"* ]]; then
        safari_files["$version"]="$file"
    fi
done

# Function to get files to delete for a platform
get_files_to_delete() {
    local -n files_ref=$1
    local platform="$2"
    local -a versions=()
    local -a files_to_delete=()

    # Get all versions and sort them
    for version in "${!files_ref[@]}"; do
        versions+=("$version")
    done

    # Sort versions in descending order (newest first)
    IFS=$'\n' sorted_versions=($(sort -t. -k1,1nr -k2,2nr -k3,3nr <<< "${versions[*]}"))

    log_info "$platform Extensions:"

    # Keep the latest KEEP_VERSIONS, mark the rest for deletion
    for i in "${!sorted_versions[@]}"; do
        local version="${sorted_versions[i]}"
        local file="${files_ref[$version]}"

        if [[ $i -lt $KEEP_VERSIONS ]]; then
            log_success "  Keep: $file (v$version)"
        else
            log_error "  Delete: $file (v$version)"
            files_to_delete+=("$file")
        fi
    done

    # Return the files to delete via a global array
    printf '%s\n' "${files_to_delete[@]}"
}

# Get files to delete for each platform
log_section "Analysis Results"

mapfile -t chrome_to_delete < <(get_files_to_delete chrome_files "Chrome")
echo ""
mapfile -t safari_to_delete < <(get_files_to_delete safari_files "Safari")

# Combine all files to delete
all_to_delete=()
all_to_delete+=("${chrome_to_delete[@]}")
all_to_delete+=("${safari_to_delete[@]}")

log_section "Summary"
log_info "Total files to delete: ${#all_to_delete[@]}"

if [[ ${#all_to_delete[@]} -eq 0 ]]; then
    log_success "No cleanup needed - all platforms have $KEEP_VERSIONS or fewer versions"
    exit 0
fi

# Show what will be deleted
echo ""
log_warning "Files to be deleted:"
for file in "${all_to_delete[@]}"; do
    echo "  - $file"
done

# Dry run mode - exit here
if [[ "$DRY_RUN" == true ]]; then
    echo ""
    log_success "Dry run complete - no files were deleted"
    log_info "Run without --dry-run to actually delete these files"
    exit 0
fi

# Confirmation (unless auto mode)
if [[ "$AUTO_DELETE" != true ]]; then
    echo ""
    log_warning "This will permanently delete ${#all_to_delete[@]} extension files"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cancelled by user"
        exit 0
    fi
fi

# Perform deletion
log_section "Deleting Old Extension Files"

deleted_count=0
for file in "${all_to_delete[@]}"; do
    log_info "Deleting: $file"
    if aws s3 rm "s3://$BUCKET_NAME/$EXTENSIONS_PREFIX$file" 2>/dev/null; then
        ((deleted_count++))
    else
        log_error "Failed to delete: $file"
    fi
done

log_success "Cleanup complete!"
log_info "Deleted: $deleted_count files"
log_info "Kept: $KEEP_VERSIONS latest versions per platform"