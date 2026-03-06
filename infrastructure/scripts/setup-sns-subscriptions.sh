#!/bin/bash

# SNS Email Subscription Setup Script
# This script configures email subscriptions for the AI Testing Platform notification topics

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Configuration
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TOPIC_NAME="ai-testing-notifications-${ENVIRONMENT}"

print_info "SNS Email Subscription Setup"
print_info "Environment: $ENVIRONMENT"
print_info "Region: $AWS_REGION"
print_info "Topic Name: $TOPIC_NAME"
echo ""

# Get the SNS topic ARN
print_info "Looking up SNS topic ARN..."
TOPIC_ARN=$(aws sns list-topics \
    --region "$AWS_REGION" \
    --query "Topics[?contains(TopicArn, '$TOPIC_NAME')].TopicArn" \
    --output text)

if [ -z "$TOPIC_ARN" ]; then
    print_error "SNS topic '$TOPIC_NAME' not found in region $AWS_REGION"
    print_info "Please deploy the infrastructure first using CDK"
    exit 1
fi

print_success "Found SNS topic: $TOPIC_ARN"
echo ""

# Prompt for email addresses
print_info "Enter email addresses to subscribe (one per line, empty line to finish):"
EMAIL_ADDRESSES=()
while true; do
    read -p "Email: " email
    if [ -z "$email" ]; then
        break
    fi
    
    # Basic email validation
    if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        EMAIL_ADDRESSES+=("$email")
        print_success "Added: $email"
    else
        print_warning "Invalid email format: $email (skipped)"
    fi
done

if [ ${#EMAIL_ADDRESSES[@]} -eq 0 ]; then
    print_warning "No email addresses provided. Exiting."
    exit 0
fi

echo ""
print_info "Subscribing ${#EMAIL_ADDRESSES[@]} email address(es) to SNS topic..."
echo ""

# Subscribe each email address
SUBSCRIBED_COUNT=0
FAILED_COUNT=0

for email in "${EMAIL_ADDRESSES[@]}"; do
    print_info "Subscribing: $email"
    
    if SUBSCRIPTION_ARN=$(aws sns subscribe \
        --topic-arn "$TOPIC_ARN" \
        --protocol email \
        --notification-endpoint "$email" \
        --region "$AWS_REGION" \
        --query 'SubscriptionArn' \
        --output text 2>&1); then
        
        print_success "Subscription created for $email"
        print_warning "  → Confirmation email sent. Please check inbox and confirm subscription."
        ((SUBSCRIBED_COUNT++))
    else
        print_error "Failed to subscribe $email: $SUBSCRIPTION_ARN"
        ((FAILED_COUNT++))
    fi
    echo ""
done

# Summary
print_info "========================================="
print_info "Subscription Summary"
print_info "========================================="
print_success "Successfully subscribed: $SUBSCRIBED_COUNT"
if [ $FAILED_COUNT -gt 0 ]; then
    print_error "Failed subscriptions: $FAILED_COUNT"
fi
echo ""

# List current subscriptions
print_info "Current subscriptions for topic:"
aws sns list-subscriptions-by-topic \
    --topic-arn "$TOPIC_ARN" \
    --region "$AWS_REGION" \
    --query 'Subscriptions[*].[Protocol,Endpoint,SubscriptionArn]' \
    --output table

echo ""
print_info "========================================="
print_info "Next Steps"
print_info "========================================="
print_warning "1. Check email inbox(es) for AWS SNS confirmation emails"
print_warning "2. Click the 'Confirm subscription' link in each email"
print_warning "3. Subscriptions will remain 'PendingConfirmation' until confirmed"
print_info ""
print_info "To verify confirmed subscriptions, run:"
print_info "  aws sns list-subscriptions-by-topic --topic-arn $TOPIC_ARN --region $AWS_REGION"
print_info ""
print_info "To test notifications, you can publish a test message:"
print_info "  aws sns publish --topic-arn $TOPIC_ARN --message 'Test notification' --region $AWS_REGION"
echo ""

print_success "SNS email subscription setup complete!"
