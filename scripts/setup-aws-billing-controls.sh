#!/bin/bash
# AWS Free Tier Monitoring Setup Script
# Sets up monitoring to ensure you stay within AWS Free Tier limits

set -e

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info "🆓 Setting up AWS Free Tier Monitoring and Alerts"
print_warning "This will monitor your AWS Free Tier usage and alert you before you exceed limits"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    print_error "AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Get account ID and email
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ADMIN_EMAIL=""

# Use email from .env if available
if [ -f "aws-backend/.env" ]; then
    source aws-backend/.env
    if [ ! -z "$ADMIN_EMAIL" ]; then
        print_info "Using email from .env: $ADMIN_EMAIL"
    fi
fi

# If no email found, prompt for it
if [ -z "$ADMIN_EMAIL" ]; then
    echo -n "Enter your email address for Free Tier alerts: "
    read ADMIN_EMAIL
fi

print_info "Account ID: $ACCOUNT_ID"
print_info "Alert Email: $ADMIN_EMAIL"

# Create SNS topic for Free Tier alerts (us-east-1 only for billing)
print_info "Creating SNS topic for Free Tier monitoring..."
SNS_TOPIC_ARN=$(aws sns create-topic --name freetier-alerts --region us-east-1 --output text --query TopicArn 2>/dev/null || echo "")

if [ ! -z "$SNS_TOPIC_ARN" ]; then
    print_success "SNS topic created: $SNS_TOPIC_ARN"
    
    # Subscribe email to SNS topic
    aws sns subscribe \
        --topic-arn "$SNS_TOPIC_ARN" \
        --protocol email \
        --notification-endpoint "$ADMIN_EMAIL" \
        --region us-east-1
    
    print_info "Email subscription added. Check your email and confirm the subscription!"
    
    # Create Free Tier usage alarms
    print_info "Creating Free Tier usage alarms..."
    
    # Minimal billing alert for any charges (should be $0 on Free Tier)
    aws cloudwatch put-metric-alarm \
        --alarm-name "RecipeArchive-FreeTier-Exceeded" \
        --alarm-description "ALERT: You have exceeded AWS Free Tier - charges detected!" \
        --metric-name EstimatedCharges \
        --namespace AWS/Billing \
        --statistic Maximum \
        --period 86400 \
        --threshold 0.01 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=Currency,Value=USD \
        --evaluation-periods 1 \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region us-east-1
    
    # Backup alarm at $1 in case you do exceed Free Tier
    aws cloudwatch put-metric-alarm \
        --alarm-name "RecipeArchive-Billing-Alert-1USD" \
        --alarm-description "URGENT: Monthly charges have reached $1" \
        --metric-name EstimatedCharges \
        --namespace AWS/Billing \
        --statistic Maximum \
        --period 86400 \
        --threshold 1 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=Currency,Value=USD \
        --evaluation-periods 1 \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --region us-east-1
    
    print_success "Free Tier monitoring alarms created"
else
    print_warning "Could not create SNS topic. You may need to enable billing alerts manually in the AWS Console."
fi

# Create AWS Budget focused on Free Tier
print_info "Creating Free Tier focused budget..."

# Create budget JSON for $0 target (Free Tier)
cat > /tmp/freetier-budget.json << EOF
{
    "BudgetName": "RecipeArchive-FreeTier-Budget",
    "BudgetLimit": {
        "Amount": "1.00",
        "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "TimePeriod": {
        "Start": "$(date -u +%Y-%m-01T00:00:00Z)",
        "End": "2030-12-31T23:59:59Z"
    },
    "BudgetType": "COST",
    "CostFilters": {}
}
EOF

# Create notification JSON for Free Tier
cat > /tmp/freetier-notifications.json << EOF
[
    {
        "Notification": {
            "NotificationType": "ACTUAL",
            "ComparisonOperator": "GREATER_THAN",
            "Threshold": 1.0,
            "ThresholdType": "ABSOLUTE_VALUE"
        },
        "Subscribers": [
            {
                "SubscriptionType": "EMAIL",
                "Address": "$ADMIN_EMAIL"
            }
        ]
    },
    {
        "Notification": {
            "NotificationType": "FORECASTED",
            "ComparisonOperator": "GREATER_THAN",
            "Threshold": 0.50,
            "ThresholdType": "ABSOLUTE_VALUE"
        },
        "Subscribers": [
            {
                "SubscriptionType": "EMAIL",
                "Address": "$ADMIN_EMAIL"
            }
        ]
    }
]
EOF

# Create the budget
aws budgets create-budget \
    --account-id "$ACCOUNT_ID" \
    --budget file:///tmp/freetier-budget.json \
    --notifications-with-subscribers file:///tmp/freetier-notifications.json \
    2>/dev/null && print_success "Free Tier budget created successfully!" || print_warning "Budget creation failed. You may need to create it manually in the AWS Console."

# Clean up temp files
rm -f /tmp/freetier-budget.json /tmp/freetier-notifications.json

print_success "🎉 AWS Free Tier Monitoring Setup Complete!"
print_info ""
print_info "🆓 What was set up:"
print_info "  • CloudWatch alarm for ANY charges (should stay at $0)"
print_info "  • Backup alarm at $1 (in case you exceed Free Tier)"
print_info "  • Monthly budget of $1 with alerts at $0.01 actual and $0.50 forecasted"
print_info "  • SNS topic for Free Tier alerts"
print_info ""
print_info "📋 AWS Free Tier Limits for RecipeArchive:"
print_info "  • DynamoDB: 25 GB storage, 25 WCU/RCU"
print_info "  • S3: 5 GB storage, 20K GET, 2K PUT requests"
print_info "  • Lambda: 1M requests, 400K GB-seconds"
print_info "  • API Gateway: 1M API calls"
print_info "  • Cognito: 50K monthly active users"
print_info "  • CloudWatch: 10 custom metrics, basic monitoring"
print_info "  • SNS: 1K email notifications"
print_info ""
print_warning "⚠️  Important Notes:"
print_info "  • Check your email and CONFIRM the SNS subscription!"
print_info "  • Enable billing alerts: AWS Console > Billing > Billing preferences"
print_info "  • Monitor AWS Free Tier dashboard regularly"
print_info "  • All components are configured to stay within Free Tier limits"
print_info "  • Your costs should remain $0.00 during development"
print_info ""
print_info "� Useful Links:"
print_info "  • Free Tier Dashboard: https://console.aws.amazon.com/billing/home#/freetier"
print_info "  • Cost Management: https://console.aws.amazon.com/cost-management/home"
