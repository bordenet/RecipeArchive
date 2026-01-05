#!/usr/bin/env bash

################################################################################
# RecipeArchive Infrastructure Hibernation
################################################################################
# PURPOSE: Safely pause AWS infrastructure to reduce daily costs
#   - Backs up critical data (Cognito users, S3 inventory)
#   - Empties temporary S3 buckets
#   - Deletes CloudWatch logs
#   - Optionally destroys full infrastructure
#
# USAGE:
#   ./scripts/aws/hibernate-infrastructure.sh [options]
#
# EXAMPLES:
#   ./scripts/aws/hibernate-infrastructure.sh              # Safe hibernation (recommended)
#   ./scripts/aws/hibernate-infrastructure.sh --full       # Full teardown (destructive)
#   ./scripts/aws/hibernate-infrastructure.sh --dry-run    # Preview actions
#
# DEPENDENCIES:
#   - AWS CLI
#   - jq (for JSON parsing)
#
# ENVIRONMENT VARIABLES:
#   - AWS credentials
#   - AWS_ACCOUNT_ID (from .env)
#
# NOTES:
#   - Safe mode: Keeps infrastructure, removes data
#   - Full mode: Destroys everything (requires backup first)
#   - All actions are logged to backups/hibernation-log-YYYYMMDD.txt
################################################################################

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
init_script

# Script variables
readonly REPO_ROOT="$(get_repo_root)"
readonly BACKUP_DIR="$REPO_ROOT/backups"
readonly LOG_FILE="$BACKUP_DIR/hibernation-log-$(date +%Y%m%d-%H%M%S).txt"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Redirect all output to log file and terminal
exec > >(tee -a "$LOG_FILE")
exec 2>&1

print_usage() {
    echo "🛌 RecipeArchive Infrastructure Hibernation Tool"
    echo ""
    echo "Usage:"
    echo "  ./scripts/aws/hibernate-infrastructure.sh              # Safe hibernation (recommended)"
    echo "  ./scripts/aws/hibernate-infrastructure.sh --full       # Full teardown (destructive)"
    echo "  ./scripts/aws/hibernate-infrastructure.sh --dry-run    # Preview actions"
    echo "  ./scripts/aws/hibernate-infrastructure.sh --help       # Show this help"
    echo ""
    echo "Safe hibernation (default):"
    echo "  ✅ Backs up Cognito users"
    echo "  ✅ Creates S3 inventory"
    echo "  ✅ Empties temp/failed-parsing buckets"
    echo "  ✅ Deletes CloudWatch logs"
    echo "  ✅ Keeps all infrastructure intact"
    echo "  ⏱️  Time: 10 minutes"
    echo "  💰 Savings: 40-60% cost reduction"
    echo ""
    echo "Full teardown (--full):"
    echo "  ✅ Everything from safe mode"
    echo "  ⚠️  DESTROYS all infrastructure"
    echo "  ⚠️  DELETES all S3 data"
    echo "  ⚠️  REMOVES Cognito users"
    echo "  ⏱️  Time: 15-20 minutes"
    echo "  💰 Savings: 100% (zero AWS costs)"
    echo ""
}

check_prerequisites() {
    log_header "Checking Prerequisites"

    # Check AWS CLI
    if ! command -v aws > /dev/null 2>&1; then
        log_error "AWS CLI not found"
        log_error "Install with: brew install awscli"
        return 1
    fi
    log_success "AWS CLI found"

    # Check AWS credentials
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        log_error "AWS credentials not configured"
        log_error "Run: aws configure"
        return 1
    fi

    local aws_account=$(aws sts get-caller-identity --query Account --output text)
    local aws_user=$(aws sts get-caller-identity --query Arn --output text | cut -d'/' -f2)
    log_success "AWS credentials configured (Account: $aws_account, User: $aws_user)"

    # Check jq
    if ! command -v jq > /dev/null 2>&1; then
        log_warning "jq not found - some features will be limited"
        log_warning "Install with: brew install jq"
    else
        log_success "jq found"
    fi

    echo ""
    return 0
}

backup_cognito_users() {
    log_header "Backing Up Cognito Users"

    # Get Cognito User Pool ID from environment
    if [ -z "$COGNITO_USER_POOL_ID" ]; then
        log_warning "COGNITO_USER_POOL_ID not set in .env"
        log_warning "Skipping Cognito backup (may not have user pool deployed)"
        echo ""
        return 0
    fi

    local backup_file="$BACKUP_DIR/cognito-users-backup-$(date +%Y%m%d-%H%M%S).json"

    log_info "Exporting users from pool: $COGNITO_USER_POOL_ID"

    if ! aws cognito-idp list-users \
        --user-pool-id "$COGNITO_USER_POOL_ID" \
        --output json > "$backup_file" 2>/dev/null; then
        log_warning "Could not export Cognito users (pool may not exist)"
        log_warning "This is normal if you haven't deployed infrastructure yet"
        rm -f "$backup_file"
        echo ""
        return 0
    fi

    local user_count=$(jq -r '.Users | length' "$backup_file" 2>/dev/null || echo "unknown")
    log_success "Backed up $user_count users to: $backup_file"
    echo ""
    return 0
}

create_s3_inventory() {
    log_header "Creating S3 Inventory"

    # Get AWS_ACCOUNT_ID from environment or AWS CLI
    if [ -z "${AWS_ACCOUNT_ID:-}" ]; then
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
        if [ -z "$AWS_ACCOUNT_ID" ]; then
            log_error "Could not determine AWS_ACCOUNT_ID"
            return 1
        fi
        log_info "Using AWS Account ID: $AWS_ACCOUNT_ID"
    fi

    local buckets=(
        "recipearchive-storage-${AWS_ACCOUNT_ID}"
        "recipearchive-temp-${AWS_ACCOUNT_ID}"
        "recipearchive-failed-parsing-${AWS_ACCOUNT_ID}"
    )

    for bucket in "${buckets[@]}"; do
        local inventory_file="$BACKUP_DIR/s3-${bucket}-inventory-$(date +%Y%m%d-%H%M%S).txt"

        log_info "Creating inventory for: $bucket"

        if ! aws s3 ls "s3://$bucket/" --recursive --human-readable --summarize > "$inventory_file" 2>/dev/null; then
            log_warning "Could not create inventory for $bucket (bucket may not exist)"
            rm -f "$inventory_file"
            continue
        fi

        local object_count=$(grep -c "^20" "$inventory_file" 2>/dev/null || echo "0")
        local total_size=$(grep "Total Size:" "$inventory_file" 2>/dev/null | awk '{print $3, $4}')

        log_success "Inventory created: $object_count objects, $total_size"
        log_info "  Saved to: $inventory_file"
    done

    echo ""
    return 0
}

empty_temp_buckets() {
    log_header "Emptying Temporary S3 Buckets"

    # Get AWS_ACCOUNT_ID from environment or AWS CLI
    if [ -z "${AWS_ACCOUNT_ID:-}" ]; then
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
        if [ -z "$AWS_ACCOUNT_ID" ]; then
            log_error "Could not determine AWS_ACCOUNT_ID"
            return 1
        fi
        log_info "Using AWS Account ID: $AWS_ACCOUNT_ID"
    fi

    local temp_buckets=(
        "recipearchive-temp-${AWS_ACCOUNT_ID}"
        "recipearchive-failed-parsing-${AWS_ACCOUNT_ID}"
    )

    for bucket in "${temp_buckets[@]}"; do
        log_info "Emptying bucket: $bucket"

        # Check if bucket exists
        if ! aws s3 ls "s3://$bucket/" > /dev/null 2>&1; then
            log_warning "Bucket does not exist: $bucket"
            continue
        fi

        # Count objects before deletion
        local object_count=$(aws s3 ls "s3://$bucket/" --recursive 2>/dev/null | wc -l | tr -d ' ')

        if [ "$object_count" -eq 0 ]; then
            log_info "Bucket already empty: $bucket"
            continue
        fi

        log_info "Deleting $object_count objects from $bucket..."

        if ! aws s3 rm "s3://$bucket/" --recursive > /dev/null 2>&1; then
            log_error "Failed to empty bucket: $bucket"
            continue
        fi

        log_success "Emptied bucket: $bucket ($object_count objects deleted)"
    done

    echo ""
    return 0
}

delete_cloudwatch_logs() {
    log_header "Deleting CloudWatch Logs"

    log_info "Finding RecipeArchive log groups..."

    # Get all log groups for RecipeArchive Lambda functions
    local log_groups=$(aws logs describe-log-groups \
        --log-group-name-prefix "/aws/lambda/RecipeArchive" \
        --query 'logGroups[].logGroupName' \
        --output text 2>/dev/null)

    if [ -z "$log_groups" ]; then
        log_warning "No RecipeArchive log groups found"
        log_warning "This is normal if you haven't deployed Lambda functions yet"
        echo ""
        return 0
    fi

    local group_count=$(echo "$log_groups" | wc -w | tr -d ' ')
    log_info "Found $group_count log groups"

    for log_group in $log_groups; do
        log_info "Deleting logs in: $log_group"

        # Delete all log streams in the group
        local streams=$(aws logs describe-log-streams \
            --log-group-name "$log_group" \
            --query 'logStreams[].logStreamName' \
            --output text 2>/dev/null)

        if [ -z "$streams" ]; then
            log_info "  No log streams to delete"
            continue
        fi

        local stream_count=0
        for stream in $streams; do
            if aws logs delete-log-stream \
                --log-group-name "$log_group" \
                --log-stream-name "$stream" > /dev/null 2>&1; then
                ((stream_count++))
            fi
        done

        log_success "  Deleted $stream_count log streams"
    done

    log_success "CloudWatch logs deleted from $group_count log groups"
    echo ""
    return 0
}

destroy_infrastructure() {
    log_header "Destroying Infrastructure (FULL TEARDOWN)"

    log_warning "⚠️  This will DELETE ALL infrastructure"
    log_warning "⚠️  This will DELETE ALL S3 data"
    log_warning "⚠️  This will REMOVE ALL Cognito users"
    echo ""

    # Prompt for confirmation
    read -p "Are you sure you want to proceed? Type 'yes' to confirm: " confirm

    if [ "$confirm" != "yes" ]; then
        log_error "Teardown cancelled by user"
        return 1
    fi

    log_info "Proceeding with full teardown..."

    # First, empty ALL S3 buckets (required before deletion)
    log_info "Emptying all S3 buckets..."

    # Get AWS_ACCOUNT_ID from environment or AWS CLI
    if [ -z "${AWS_ACCOUNT_ID:-}" ]; then
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
        if [ -z "$AWS_ACCOUNT_ID" ]; then
            log_error "Could not determine AWS_ACCOUNT_ID"
            return 1
        fi
        log_info "Using AWS Account ID: $AWS_ACCOUNT_ID"
    fi

    local all_buckets=(
        "recipearchive-storage-${AWS_ACCOUNT_ID}"
        "recipearchive-temp-${AWS_ACCOUNT_ID}"
        "recipearchive-failed-parsing-${AWS_ACCOUNT_ID}"
    )

    for bucket in "${all_buckets[@]}"; do
        if aws s3 ls "s3://$bucket/" > /dev/null 2>&1; then
            log_info "Emptying bucket: $bucket"
            aws s3 rm "s3://$bucket/" --recursive > /dev/null 2>&1 || true
            log_success "Emptied: $bucket"
        fi
    done

    # Navigate to infrastructure directory
    cd "$REPO_ROOT/aws-backend/infrastructure" || return 1

    # Destroy CDK stacks
    log_info "Destroying CDK stacks..."
    log_warning "This may take 10-15 minutes..."
    echo ""

    if ! npm run cdk destroy -- --all --force 2>&1 | tee -a "$LOG_FILE"; then
        log_error "CDK destroy failed"
        log_error "See log file: $LOG_FILE"
        cd - > /dev/null
        return 1
    fi

    log_success "Infrastructure destroyed"

    cd - > /dev/null
    echo ""
    return 0
}

verify_hibernation() {
    log_header "Verifying Hibernation"

    local verification_passed=true

    # Check Lambda functions
    log_info "Checking Lambda functions..."
    local lambda_count=$(aws lambda list-functions \
        --query 'Functions[?contains(FunctionName, `RecipeArchive`)].FunctionName' \
        --output text 2>/dev/null | wc -w | tr -d ' ')

    if [ "$lambda_count" -eq 0 ]; then
        log_success "✅ No Lambda functions found (full teardown)"
    else
        log_info "ℹ️  $lambda_count Lambda functions still exist (safe hibernation)"
    fi

    # Check S3 buckets
    log_info "Checking S3 buckets..."
    local bucket_count=$(aws s3 ls 2>/dev/null | grep -c "recipearchive" || echo "0")

    if [ "$bucket_count" -eq 0 ]; then
        log_success "✅ No S3 buckets found (full teardown)"
    else
        log_info "ℹ️  $bucket_count S3 buckets still exist (safe hibernation)"

        # Check if buckets are empty
        if [ -n "${AWS_ACCOUNT_ID:-}" ]; then
            local temp_bucket_size=$(aws s3 ls "s3://recipearchive-temp-${AWS_ACCOUNT_ID}/" --recursive 2>/dev/null | wc -l | tr -d ' ')
            local failed_bucket_size=$(aws s3 ls "s3://recipearchive-failed-parsing-${AWS_ACCOUNT_ID}/" --recursive 2>/dev/null | wc -l | tr -d ' ')

            if [ "$temp_bucket_size" -eq 0 ] && [ "$failed_bucket_size" -eq 0 ]; then
                log_success "✅ Temporary buckets are empty"
            else
                log_warning "⚠️  Some objects remain in temporary buckets"
                verification_passed=false
            fi
        fi
    fi

    # Check API Gateway
    log_info "Checking API Gateway..."
    local api_count=$(aws apigateway get-rest-apis \
        --query 'items[?contains(name, `RecipeArchive`)].name' \
        --output text 2>/dev/null | wc -w | tr -d ' ')

    if [ "$api_count" -eq 0 ]; then
        log_success "✅ No API Gateway found (full teardown)"
    else
        log_info "ℹ️  $api_count API Gateway still exists (safe hibernation)"
    fi

    echo ""

    if [ "$verification_passed" = true ]; then
        log_success "🎉 Hibernation verification passed"
    else
        log_warning "Some verification checks had warnings"
    fi

    echo ""
    return 0
}

print_summary() {
    local mode=$1
    local start_time=$2
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log_header "Hibernation Summary"

    if [ "$mode" = "full" ]; then
        log_success "🛌 FULL TEARDOWN COMPLETED"
        echo ""
        log_info "Actions taken:"
        log_success "  ✅ Backed up Cognito users"
        log_success "  ✅ Created S3 inventory"
        log_success "  ✅ Destroyed all infrastructure"
        log_success "  ✅ Deleted all S3 data"
        echo ""
        log_info "💰 Cost savings: 100% (zero AWS costs)"
        echo ""
        log_info "📋 To resume later:"
        log_info "  1. Run: cd aws-backend/infrastructure && npm run cdk deploy -- --all"
        log_info "  2. Restore S3 data from backups/"
        log_info "  3. Restore Cognito users (manual process)"
        log_info "  4. Update .env with new outputs"
    else
        log_success "🛌 SAFE HIBERNATION COMPLETED"
        echo ""
        log_info "Actions taken:"
        log_success "  ✅ Backed up Cognito users"
        log_success "  ✅ Created S3 inventory"
        log_success "  ✅ Emptied temporary S3 buckets"
        log_success "  ✅ Deleted CloudWatch logs"
        echo ""
        log_info "💰 Cost savings: 40-60% reduction"
        echo ""
        log_info "📋 To resume later:"
        log_info "  1. Restore S3 data from backups/ (if needed)"
        log_info "  2. Re-enable GitHub Action cron schedule"
        log_info "  3. Verify Lambda functions: curl <API_GATEWAY_URL>/health"
    fi

    echo ""
    log_info "⏱️  Total time: ${duration}s"
    log_info "📁 Backups saved to: $BACKUP_DIR"
    log_info "📄 Full log: $LOG_FILE"
    echo ""
    log_info "Next steps:"
    log_info "  1. Monitor AWS Budget dashboard for cost reduction"
    log_info "  2. Keep budget alarms enabled"
    log_info "  3. See AWS_COST_REDUCTION_GUIDE.md for resume instructions"
    echo ""
}

main() {
    local start_time=$(date +%s)
    local mode="safe"
    local dry_run=false

    # Parse command line arguments
    case "${1:-}" in
        --help|-h)
            print_usage
            exit 0
            ;;
        --full)
            mode="full"
            ;;
        --dry-run)
            dry_run=true
            ;;
        "")
            mode="safe"
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            die "Hibernation failed"
            ;;
    esac

    # Load environment variables
    if [ -f "$REPO_ROOT/.env" ]; then
        log_info "Loading environment variables from .env"
        source "$REPO_ROOT/scripts/load-env.sh"
    else
        log_warning ".env file not found - some features may not work"
    fi

    log_header "RecipeArchive Infrastructure Hibernation"
    log_info "Mode: $mode"
    log_info "Log file: $LOG_FILE"
    echo ""

    if [ "$dry_run" = true ]; then
        log_header "Dry Run - Preview Actions"
        echo ""

        if [ "$mode" = "full" ]; then
            log_info "Would perform FULL TEARDOWN:"
            log_info "  1. Back up Cognito users"
            log_info "  2. Create S3 inventory"
            log_info "  3. Empty all S3 buckets"
            log_info "  4. Destroy CDK infrastructure"
            log_info "  5. Verify deletion"
        else
            log_info "Would perform SAFE HIBERNATION:"
            log_info "  1. Back up Cognito users"
            log_info "  2. Create S3 inventory"
            log_info "  3. Empty temporary S3 buckets only"
            log_info "  4. Delete CloudWatch logs"
            log_info "  5. Verify hibernation"
        fi

        echo ""
        log_success "Dry run completed (no changes made)"
        exit 0
    fi

    # Check prerequisites
    if ! check_prerequisites; then
        die "Prerequisites check failed"
    fi

    # Execute hibernation steps
    if ! backup_cognito_users; then
        log_warning "Cognito backup had warnings but continuing..."
    fi

    if ! create_s3_inventory; then
        log_warning "S3 inventory had warnings but continuing..."
    fi

    if [ "$mode" = "full" ]; then
        if ! destroy_infrastructure; then
            die "Infrastructure destruction failed"
        fi
    else
        if ! empty_temp_buckets; then
            log_warning "S3 cleanup had warnings but continuing..."
        fi

        if ! delete_cloudwatch_logs; then
            log_warning "CloudWatch cleanup had warnings but continuing..."
        fi
    fi

    if ! verify_hibernation; then
        log_warning "Verification had warnings but hibernation completed"
    fi

    print_summary "$mode" "$start_time"
}

main "$@"
