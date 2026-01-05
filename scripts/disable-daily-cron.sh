#!/usr/bin/env bash

################################################################################
# Disable Daily Parser Health Check (GitHub Action)
################################################################################
# PURPOSE: Comment out the cron schedule to stop daily runs
#
# USAGE:
#   ./scripts/disable-daily-cron.sh
#
# NOTES:
#   - Keeps workflow_dispatch (manual trigger) enabled
#   - Keeps push trigger on main branch
#   - Zero cost impact (GitHub Actions are free for public repos)
#   - Prevents unnecessary runs during hibernation
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKFLOW_FILE="$REPO_ROOT/.github/workflows/parser-health-check.yml"

echo "🛌 Disabling Daily Parser Health Check"
echo ""

if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Error: Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

echo "📝 Backing up original workflow..."
cp "$WORKFLOW_FILE" "$WORKFLOW_FILE.backup"
echo "✅ Backup created: $WORKFLOW_FILE.backup"
echo ""

echo "📝 Commenting out cron schedule..."

# Use sed to comment out the schedule section
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' -E '/^  schedule:/,/^    - cron:/ s/^/  # /' "$WORKFLOW_FILE"
else
    # Linux
    sed -i -E '/^  schedule:/,/^    - cron:/ s/^/  # /' "$WORKFLOW_FILE"
fi

echo "✅ Cron schedule disabled"
echo ""

echo "📋 Changes made to workflow:"
echo "────────────────────────────────────────"
git diff "$WORKFLOW_FILE" || cat "$WORKFLOW_FILE" | grep -A3 "^on:"
echo "────────────────────────────────────────"
echo ""

echo "✅ Daily parser health check disabled"
echo ""
echo "📋 Next steps:"
echo "  1. Review changes: git diff .github/workflows/parser-health-check.yml"
echo "  2. Commit changes: git add .github/workflows/parser-health-check.yml"
echo "  3. Push to GitHub: git commit -m 'chore: disable daily parser health check during hibernation' && git push"
echo ""
echo "To re-enable later:"
echo "  1. Restore from backup: cp $WORKFLOW_FILE.backup $WORKFLOW_FILE"
echo "  2. Or manually uncomment the schedule section"
echo ""
