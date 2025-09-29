#!/usr/bin/env bash

#===============================================================================
# RecipeArchive Extension Cleanup Script
#===============================================================================
# PURPOSE: Keep only the latest 2 versions of each browser extension
#
# USAGE:
#   ./scripts/cleanup-old-extensions.sh              # Interactive mode
#   ./scripts/cleanup-old-extensions.sh --dry-run    # Show what would be deleted
#   ./scripts/cleanup-old-extensions.sh --auto       # Auto-delete old versions
#
# SAFETY:
#   - Always preserves the 2 most recent versions of each platform
#   - Shows exactly what will be deleted before confirmation
#   - Includes --dry-run mode for safe testing
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m' # No Color

# Configuration
BUCKET_NAME="recipe-storage-0ea7007d57f67ecb-990537043943"
EXTENSIONS_PREFIX="extensions/"
KEEP_VERSIONS=2

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
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🧹 RecipeArchive Extension Cleanup${NC}"
echo "=================================="
echo "Bucket: s3://$BUCKET_NAME/$EXTENSIONS_PREFIX"
echo "Keeping: $KEEP_VERSIONS latest versions per platform"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Mode: DRY RUN (no files will be deleted)${NC}"
fi
echo ""

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
echo "📋 Scanning for extension files..."
mapfile -t all_files < <(aws s3 ls "s3://$BUCKET_NAME/$EXTENSIONS_PREFIX" | grep -E 'RecipeArchive-(Chrome|Safari)-v[0-9]+\.[0-9]+\.[0-9]+\.zip$' | awk '{print $4}')

if [ ${#all_files[@]} -eq 0 ]; then
    echo -e "${YELLOW}No extension files found in s3://$BUCKET_NAME/$EXTENSIONS_PREFIX${NC}"
    exit 0
fi

echo "Found ${#all_files[@]} extension files"

# Separate by platform and sort by version
declare -A chrome_files=()
declare -A safari_files=()

for file in "${all_files[@]}"; do
    version=$(extract_version "$file")
    if [[ -z "$version" ]]; then
        echo -e "${YELLOW}Warning: Could not extract version from $file${NC}"
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

    echo -e "${BLUE}$platform Extensions:${NC}"

    # Keep the latest KEEP_VERSIONS, mark the rest for deletion
    for i in "${!sorted_versions[@]}"; do
        local version="${sorted_versions[i]}"
        local file="${files_ref[$version]}"

        if [ $i -lt $KEEP_VERSIONS ]; then
            echo -e "  ${GREEN}✓ Keep:${NC} $file (v$version)"
        else
            echo -e "  ${RED}✗ Delete:${NC} $file (v$version)"
            files_to_delete+=("$file")
        fi
    done

    # Return the files to delete via a global array
    printf '%s\n' "${files_to_delete[@]}"
}

# Get files to delete for each platform
echo ""
echo "📊 Analysis Results:"
echo "==================="

mapfile -t chrome_to_delete < <(get_files_to_delete chrome_files "Chrome")
echo ""
mapfile -t safari_to_delete < <(get_files_to_delete safari_files "Safari")

# Combine all files to delete
all_to_delete=()
all_to_delete+=("${chrome_to_delete[@]}")
all_to_delete+=("${safari_to_delete[@]}")

echo ""
echo "📋 Summary:"
echo "==========="
echo "Total files to delete: ${#all_to_delete[@]}"

if [ ${#all_to_delete[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ No cleanup needed - all platforms have $KEEP_VERSIONS or fewer versions${NC}"
    exit 0
fi

# Show what will be deleted
echo ""
echo -e "${RED}Files to be deleted:${NC}"
for file in "${all_to_delete[@]}"; do
    echo "  - $file"
done

# Dry run mode - exit here
if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${YELLOW}✅ Dry run complete - no files were deleted${NC}"
    echo "Run without --dry-run to actually delete these files"
    exit 0
fi

# Confirmation (unless auto mode)
if [ "$AUTO_DELETE" != true ]; then
    echo ""
    echo -e "${YELLOW}⚠️  This will permanently delete ${#all_to_delete[@]} extension files${NC}"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled by user"
        exit 0
    fi
fi

# Perform deletion
echo ""
echo "🗑️  Deleting old extension files..."

deleted_count=0
for file in "${all_to_delete[@]}"; do
    echo "Deleting: $file"
    if aws s3 rm "s3://$BUCKET_NAME/$EXTENSIONS_PREFIX$file"; then
        ((deleted_count++))
    else
        echo -e "${RED}Failed to delete: $file${NC}"
    fi
done

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo "Deleted: $deleted_count files"
echo "Kept: $KEEP_VERSIONS latest versions per platform"