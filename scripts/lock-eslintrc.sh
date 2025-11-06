#!/usr/bin/env bash
# Lock .eslintrc.cjs files to prevent deletion by build processes
# Run this after editing ESLint configurations

set -e

ESLINTRC_FILES=(
  ".eslintrc.cjs"
  "extensions/.eslintrc.cjs"
  "tools/linting/.eslintrc.cjs"
)

echo "🔒 Making .eslintrc.cjs files immutable..."

for file in "${ESLINTRC_FILES[@]}"; do
  if [ -f "$file" ]; then
    sudo chflags uchg "$file"
    echo "   ✓ $file is now immutable"
  else
    echo "   ⚠️  $file not found, skipping"
  fi
done

echo ""
echo "✅ ESLint config files are now protected from deletion"
echo ""
echo "To edit these files again, run: ./scripts/edit-eslintrc.sh"
