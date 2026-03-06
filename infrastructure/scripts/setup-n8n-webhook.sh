#!/bin/bash

# Script to set up n8n webhook subscription for SNS notifications
# This script subscribes an n8n webhook endpoint to the SNS topic for test notifications

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  n8n Webhook Setup for SNS Notifications${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

# Check if required environment variables are set
check_environment() {
    if [ -z "$ENVIRONMENT" ]; then
        print_error "ENVIRONMENT variable is not set"
        echo "Please set it to one of: dev, staging, prod"
        echo "Example: export ENVIRONMENT=dev"
        exit 1
    fi

    if [ -z "$AWS_REGION" ]; then
        print_warning "AWS_REGION not set, using default: us-east-1"
        export AWS_REGION="us-east-1"
    fi

    print_success "Environment: $ENVIRONMENT"
    print_success "AWS Region: $AWS_REGION"
}

# Find the SNS topic ARN
find_topic_arn() {
    print_info "Looking for SNS topic: ai-testing-notifications-${ENVIRONMENT}..."
    
    TOPIC_ARN=$(aws sns list-topics --region "$AWS_REGION" --output json | \
        jq -r ".Topics[].TopicArn | select(contains(\"ai-testing-notifications-${ENVIRONMENT}\"))")
    
    if [ -z "$TOPIC_ARN" ]; then
        print_error "Could not find SNS topic for environment: $ENVIRONMENT"
        echo ""
        echo "Available topics:"
        aws sns list-topics --region "$AWS_REGION" --output json | jq -r '.Topics[].TopicArn'
        exit 1
    fi
    
    print_success "Found SNS topic: $TOPIC_ARN"
}

# Validate webhook URL
validate_webhook_url() {
    local url=$1
    
    # Check if URL starts with https://
    if [[ ! $url =~ ^https:// ]]; then
        print_error "Webhook URL must use HTTPS protocol"
        return 1
    fi
    
    # Check if URL is accessible
    print_info "Testing webhook endpoint..."
    if curl -s -o /dev/null -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d '{"test":"message"}' | grep -q "200\|404\|405"; then
        print_success "Webhook endpoint is accessible"
        return 0
    else
        print_warning "Could not reach webhook endpoint (this may be normal if it requires specific headers)"
        return 0
    fi
}

# Subscribe webhook to SNS topic
subscribe_webhook() {
    local webhook_url=$1
    
    print_info "Subscribing webhook to SNS topic..."
    
    SUBSCRIPTION_ARN=$(aws sns subscribe \
        --topic-arn "$TOPIC_ARN" \
        --protocol https \
        --notification-endpoint "$webhook_url" \
        --region "$AWS_REGION" \
        --output json | jq -r '.SubscriptionArn')
    
    if [ "$SUBSCRIPTION_ARN" == "pending confirmation" ]; then
        print_success "Webhook subscription created (pending confirmation)"
        echo ""
        print_warning "IMPORTANT: The subscription needs to be confirmed!"
        echo ""
        echo "SNS will send a SubscriptionConfirmation message to your n8n webhook."
        echo "Your n8n workflow must:"
        echo "  1. Receive the message"
        echo "  2. Extract the 'SubscribeURL' from the payload"
        echo "  3. Make a GET request to that URL to confirm"
        echo ""
        echo "See the n8n webhook setup guide for automatic confirmation workflow."
        return 0
    elif [ -n "$SUBSCRIPTION_ARN" ]; then
        print_success "Webhook subscription created: $SUBSCRIPTION_ARN"
        return 0
    else
        print_error "Failed to create webhook subscription"
        return 1
    fi
}

# List existing subscriptions
list_subscriptions() {
    print_info "Current webhook subscriptions for this topic:"
    echo ""
    
    aws sns list-subscriptions-by-topic \
        --topic-arn "$TOPIC_ARN" \
        --region "$AWS_REGION" \
        --output json | \
        jq -r '.Subscriptions[] | select(.Protocol == "https") | "  • \(.Endpoint) - Status: \(.SubscriptionArn)"'
    
    echo ""
}

# Main script
main() {
    print_header
    
    # Check environment
    check_environment
    
    # Find SNS topic
    find_topic_arn
    
    echo ""
    print_info "This script will subscribe an n8n webhook to receive test notifications."
    echo ""
    
    # Prompt for webhook URL
    read -p "Enter your n8n webhook URL (must be HTTPS): " WEBHOOK_URL
    
    if [ -z "$WEBHOOK_URL" ]; then
        print_error "Webhook URL cannot be empty"
        exit 1
    fi
    
    # Validate webhook URL
    if ! validate_webhook_url "$WEBHOOK_URL"; then
        read -p "Continue anyway? (y/n): " CONTINUE
        if [ "$CONTINUE" != "y" ]; then
            print_info "Aborted"
            exit 0
        fi
    fi
    
    echo ""
    
    # Subscribe webhook
    if subscribe_webhook "$WEBHOOK_URL"; then
        echo ""
        print_success "Webhook subscription setup complete!"
        echo ""
        
        # List all subscriptions
        list_subscriptions
        
        # Next steps
        echo ""
        print_info "Next Steps:"
        echo ""
        echo "1. Ensure your n8n workflow is active and listening"
        echo "2. Confirm the subscription (see n8n webhook setup guide)"
        echo "3. Verify subscription status:"
        echo "   aws sns list-subscriptions-by-topic \\"
        echo "     --topic-arn $TOPIC_ARN \\"
        echo "     --region $AWS_REGION"
        echo ""
        echo "4. Test the integration:"
        echo "   aws sns publish \\"
        echo "     --topic-arn $TOPIC_ARN \\"
        echo "     --message '{\"resultId\":\"test-123\",\"testId\":\"test-456\",\"status\":\"PASS\",\"duration\":45000,\"testName\":\"Test notification\",\"timestamp\":$(date +%s)000}' \\"
        echo "     --subject \"Test Notification\" \\"
        echo "     --region $AWS_REGION"
        echo ""
        echo "5. Check n8n workflow executions to verify the message was received"
        echo ""
        print_info "For detailed setup instructions, see: docs/N8N_WEBHOOK_SETUP.md"
        echo ""
    else
        print_error "Failed to set up webhook subscription"
        exit 1
    fi
}

# Run main function
main
