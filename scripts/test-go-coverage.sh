#!/bin/bash
# Test all Go modules with coverage and merge results

set -e

echo "🧪 Running Go tests with coverage..."

# Navigate to functions directory
cd "$(dirname "$0")/../aws-backend/functions"

# Find all directories with test files
test_dirs=$(find . -name "*_test.go" -type f -exec dirname {} \; | sort -u)

if [ -z "$test_dirs" ]; then
  echo "⚠️  No Go test files found"
  exit 0
fi

# Create coverage directory
mkdir -p coverage

# Get absolute path to functions directory
functions_dir=$(pwd)

# Run tests in each directory and collect coverage
coverage_files=()
for dir in $test_dirs; do
  echo "📦 Testing: $dir"
  cd "$functions_dir/$dir"

  # Generate unique coverage file name
  module_name=$(basename "$dir")
  coverage_file="$functions_dir/coverage/${module_name}.out"

  # Run tests with coverage
  if go test -v -coverprofile="$coverage_file" -covermode=atomic .; then
    echo "✅ $module_name tests passed"
    coverage_files+=("$coverage_file")
  else
    echo "❌ $module_name tests failed"
    exit 1
  fi
done

# Return to functions directory
cd "$functions_dir"

# Merge coverage files
echo ""
echo "📊 Merging coverage reports..."

# Create merged coverage file
merged_coverage="coverage.out"
echo "mode: atomic" > "$merged_coverage"

for file in "${coverage_files[@]}"; do
  # Skip the first line (mode declaration) and append to merged file
  tail -n +2 "$file" >> "$merged_coverage"
done

echo "✅ Coverage reports merged into: $merged_coverage"
echo ""
echo "📈 Overall Go coverage summary:"
go tool cover -func="$merged_coverage" | tail -1

# Optional: Generate HTML report
if [ "$1" == "--html" ]; then
  echo ""
  echo "🌐 Generating HTML coverage report..."
  go tool cover -html="$merged_coverage" -o coverage/coverage.html
  echo "✅ HTML report: aws-backend/functions/coverage/coverage.html"
fi

