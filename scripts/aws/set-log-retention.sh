#!/usr/bin/env bash

################################################################################
# Set CloudWatch Log Retention Policies
################################################################################
# PURPOSE: Set automatic log expiration to reduce CloudWatch storage costs
#
# USAGE:
#   ./scripts/aws/set-log-retention.sh [days]
#
# EXAMPLES:
#   ./scripts/aws/set-log-retention.sh        # Set 7-day retention (default)
#   ./scripts/aws/set-log-retention.sh 14     # Set 14-day retention
#   ./scripts/aws/set-log-retention.sh 30     # Set 30-day retention
#
# VALID RETENTION PERIODS:
#   1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653
#
# NOTES:
#   - This is MUCH better than manually deleting logs
#   - Logs automatically expire after the retention period
#   - Reduces ongoing CloudWatch storage costs
#   - Can be reverted by setting a longer retention period
################################################################################

set -euo pipefail

# Default retention: 7 days
RETENTION_DAYS=${1:-7}

# Validate retention period
VALID_PERIODS=(1 3 5 7 14 30 60 90 120 150 180 365 400 545 731 1096 1827 2192 2557 2922 3288 3653)
if [[ ! " ${VALID_PERIODS[@]} " =~ " ${RETENTION_DAYS} " ]]; then
    echo "❌ Invalid retention period: $RETENTION_DAYS"
    echo ""
    echo "Valid periods: ${VALID_PERIODS[@]}"
    exit 1
fi

echo "📝 Setting CloudWatch Log Retention to $RETENTION_DAYS days"
echo ""

# Check AWS CLI
if ! command -v aws > /dev/null 2>&1; then
    echo "❌ AWS CLI not found"
    echo "Install with: brew install awscli"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS credentials not configured"
    echo "Run: aws configure"
    exit 1
fi

echo "🔍 Finding all RecipeArchive-related log groups..."
echo ""

# Search multiple prefixes to catch all RecipeArchive log groups
# This catches: RecipeArchive-*, RecipeArchiveStack-*, recipe-*, and related API Gateway logs
PREFIXES=(
    "/aws/lambda/RecipeArchive"
    "/aws/lambda/RecipeArchiveStack"
    "/aws/lambda/recipe-"
    "/aws/lambda/invitation-manager"
    "/aws/lambda/RecipeAnalytics"
    "/aws/apigateway/"
)

all_log_groups=""
for prefix in "${PREFIXES[@]}"; do
    # AWS CLI outputs tab-separated values, convert to newlines
    groups=$(aws logs describe-log-groups \
        --log-group-name-prefix "$prefix" \
        --query 'logGroups[].logGroupName' \
        --output text 2>/dev/null | tr '\t' '\n' || true)
    if [ -n "$groups" ]; then
        all_log_groups="$all_log_groups"$'\n'"$groups"
    fi
done

# Deduplicate and convert to space-separated list
log_groups=$(echo "$all_log_groups" | sort -u | grep -v '^$' | tr '\n' ' ')

if [ -z "$log_groups" ] || [ "$log_groups" = " " ]; then
    echo "⚠️  No RecipeArchive log groups found"
    echo "This is normal if you haven't deployed Lambda functions yet"
    exit 0
fi

log_count=$(echo "$log_groups" | wc -w | tr -d ' ')
echo "📊 Found $log_count log groups"
echo ""

success_count=0
error_count=0
already_set=0

for log_group in $log_groups; do
    # Check current retention
    current_retention=$(aws logs describe-log-groups \
        --log-group-name-prefix "$log_group" \
        --query "logGroups[?logGroupName=='$log_group'].retentionInDays | [0]" \
        --output text 2>/dev/null || echo "None")

    if [ "$current_retention" = "$RETENTION_DAYS" ]; then
        echo "⏭️  Skipping (already $RETENTION_DAYS days): $log_group"
        already_set=$((already_set + 1))
        continue
    fi

    echo "⏱️  Setting retention for: $log_group"
    echo "   (was: ${current_retention:-None} → $RETENTION_DAYS days)"

    if aws logs put-retention-policy \
        --log-group-name "$log_group" \
        --retention-in-days "$RETENTION_DAYS" > /dev/null 2>&1; then
        echo "   ✅ Success"
        success_count=$((success_count + 1))
    else
        echo "   ❌ Failed"
        error_count=$((error_count + 1))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Total log groups: $log_count"
echo "✅ Retention updated: $success_count"
echo "⏭️  Already configured: $already_set"

if [ "$error_count" -gt 0 ]; then
    echo "❌ Failed: $error_count"
fi

echo ""
echo "💰 Cost Impact:"
echo "   • Logs older than $RETENTION_DAYS days will be automatically deleted"
echo "   • Estimated savings: \$1-2/month (depending on log volume)"
echo "   • Ongoing: Logs auto-expire, no manual cleanup needed"
echo ""
echo "📊 To verify retention policies:"
echo "   aws logs describe-log-groups --query 'logGroups[?contains(logGroupName,\`Recipe\`) || contains(logGroupName,\`recipe\`)].{Name:logGroupName,Retention:retentionInDays}' --output table"
echo ""
