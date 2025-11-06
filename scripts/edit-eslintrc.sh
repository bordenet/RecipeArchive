#!/usr/bin/env bash
# Helper script to edit .eslintrc.cjs files
# These files are kept immutable to prevent deletion by build processes

set -e

ESLINTRC_FILES=(
  ".eslintrc.cjs"
  "extensions/.eslintrc.cjs"
  "tools/linting/.eslintrc.cjs"
)

echo "🔓 Making .eslintrc.cjs files writable for editing..."

for file in "${ESLINTRC_FILES[@]}"; do
  if [ -f "$file" ]; then
    sudo chflags nouchg "$file"
    echo "   ✓ $file is now writable"
  fi
done

echo ""
echo "📝 You can now edit the .eslintrc.cjs files"
echo ""
echo "⚠️  IMPORTANT: After making your changes, run:"
echo "   ./scripts/lock-eslintrc.sh"
echo "   to make the files immutable again and prevent deletion"
