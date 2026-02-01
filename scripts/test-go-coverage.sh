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

# Create merged coverage file with repo-relative paths for Codecov
# Go coverage files have paths relative to aws-backend/functions/
# Codecov needs paths relative to repo root
merged_coverage="coverage.out"
echo "mode: atomic" > "$merged_coverage"

for file in "${coverage_files[@]}"; do
  # Skip the first line (mode declaration) and prepend aws-backend/functions/ to paths
  tail -n +2 "$file" | sed 's|^|aws-backend/functions/|' >> "$merged_coverage"
done

echo "✅ Coverage reports merged into: $merged_coverage"
echo ""
echo "📈 Overall Go coverage summary:"
# Note: go tool cover won't work with modified paths, so we calculate manually
total_stmts=0
covered_stmts=0
while IFS=: read -r file rest; do
  if [[ "$rest" =~ ([0-9]+)$ ]]; then
    count="${BASH_REMATCH[1]}"
    # Each line represents one statement, count > 0 means covered
    ((total_stmts++)) || true
    if [ "$count" -gt 0 ]; then
      ((covered_stmts++)) || true
    fi
  fi
done < <(grep -v "^mode:" "$merged_coverage")
if [ "$total_stmts" -gt 0 ]; then
  coverage=$(awk "BEGIN {printf \"%.1f\", ($covered_stmts / $total_stmts) * 100}")
  echo "total: ${coverage}% of statements"
else
  echo "No coverage data found"
fi

# Optional: Generate HTML report
if [ "$1" == "--html" ]; then
  echo ""
  echo "🌐 Generating HTML coverage report..."
  go tool cover -html="$merged_coverage" -o coverage/coverage.html
  echo "✅ HTML report: aws-backend/functions/coverage/coverage.html"
fi

