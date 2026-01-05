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

echo "🔍 Finding RecipeArchive log groups..."
echo ""

# Get all log groups for RecipeArchive
log_groups=$(aws logs describe-log-groups \
    --log-group-name-prefix "/aws/lambda/RecipeArchive" \
    --query 'logGroups[].logGroupName' \
    --output text 2>/dev/null)

if [ -z "$log_groups" ]; then
    echo "⚠️  No RecipeArchive log groups found"
    echo "This is normal if you haven't deployed Lambda functions yet"
    exit 0
fi

log_count=$(echo "$log_groups" | wc -w | tr -d ' ')
echo "📊 Found $log_count log groups"
echo ""

success_count=0
error_count=0

for log_group in $log_groups; do
    echo "⏱️  Setting retention for: $log_group"

    if aws logs put-retention-policy \
        --log-group-name "$log_group" \
        --retention-in-days "$RETENTION_DAYS" > /dev/null 2>&1; then
        echo "   ✅ Success"
        ((success_count++))
    else
        echo "   ❌ Failed"
        ((error_count++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Retention set for $success_count log groups"

if [ "$error_count" -gt 0 ]; then
    echo "❌ Failed for $error_count log groups"
fi

echo ""
echo "💰 Cost Impact:"
echo "   • Logs older than $RETENTION_DAYS days will be automatically deleted"
echo "   • Estimated savings: \$1-2/month (depending on log volume)"
echo "   • Ongoing: Logs auto-expire, no manual cleanup needed"
echo ""
echo "📊 To verify retention policies:"
echo "   aws logs describe-log-groups --log-group-name-prefix '/aws/lambda/RecipeArchive' --query 'logGroups[].{Name:logGroupName,Retention:retentionInDays}'"
echo ""
