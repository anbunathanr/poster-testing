#!/bin/bash

# CloudWatch Setup Script for AI Testing Automation Platform
# This script creates CloudWatch log groups, metric namespaces, alarms, and dashboards

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if environment is provided
if [ -z "$1" ]; then
    print_error "Environment parameter is required"
    echo "Usage: ./setup-cloudwatch.sh <environment> [alarm-email]"
    echo "Example: ./setup-cloudwatch.sh dev admin@example.com"
    exit 1
fi

ENVIRONMENT=$1
ALARM_EMAIL=${2:-""}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

print_info "Setting up CloudWatch for environment: $ENVIRONMENT"
print_info "AWS Region: $AWS_REGION"
print_info "AWS Account ID: $AWS_ACCOUNT_ID"

# Lambda function names
LAMBDA_FUNCTIONS=(
    "ai-testing-auth-${ENVIRONMENT}"
    "ai-testing-test-generation-${ENVIRONMENT}"
    "ai-testing-test-execution-${ENVIRONMENT}"
    "ai-testing-storage-${ENVIRONMENT}"
    "ai-testing-report-${ENVIRONMENT}"
)

# DynamoDB table names
DYNAMODB_TABLES=(
    "ai-testing-users-${ENVIRONMENT}"
    "ai-testing-tests-${ENVIRONMENT}"
    "ai-testing-test-results-${ENVIRONMENT}"
    "ai-testing-environments-${ENVIRONMENT}"
)

# Step 1: Create Log Groups
print_info "Creating CloudWatch Log Groups..."

for FUNCTION_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
    LOG_GROUP_NAME="/aws/lambda/${FUNCTION_NAME}"
    
    if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP_NAME" --query "logGroups[?logGroupName=='$LOG_GROUP_NAME']" --output text | grep -q "$LOG_GROUP_NAME"; then
        print_warning "Log group $LOG_GROUP_NAME already exists, skipping..."
    else
        aws logs create-log-group --log-group-name "$LOG_GROUP_NAME"
        print_info "Created log group: $LOG_GROUP_NAME"
    fi
    
    # Set retention policy to 30 days
    aws logs put-retention-policy \
        --log-group-name "$LOG_GROUP_NAME" \
        --retention-in-days 30
    print_info "Set retention policy for $LOG_GROUP_NAME to 30 days"
done

# Step 2: Create SNS Topic for Alarms
print_info "Creating SNS topic for alarms..."

SNS_TOPIC_NAME="ai-testing-alarms-${ENVIRONMENT}"
SNS_TOPIC_ARN=$(aws sns create-topic --name "$SNS_TOPIC_NAME" --query 'TopicArn' --output text 2>/dev/null || aws sns list-topics --query "Topics[?contains(TopicArn, '$SNS_TOPIC_NAME')].TopicArn" --output text)

print_info "SNS Topic ARN: $SNS_TOPIC_ARN"

# Subscribe email if provided
if [ -n "$ALARM_EMAIL" ]; then
    print_info "Subscribing email $ALARM_EMAIL to SNS topic..."
    aws sns subscribe \
        --topic-arn "$SNS_TOPIC_ARN" \
        --protocol email \
        --notification-endpoint "$ALARM_EMAIL" \
        --output text > /dev/null
    print_warning "Please check $ALARM_EMAIL and confirm the SNS subscription"
fi

# Step 3: Create Lambda Error Rate Alarms
print_info "Creating Lambda error rate alarms..."

for FUNCTION_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
    ALARM_NAME="${FUNCTION_NAME}-error-rate"
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "$ALARM_NAME" \
        --alarm-description "Alert when $FUNCTION_NAME error rate exceeds threshold" \
        --metric-name Errors \
        --namespace AWS/Lambda \
        --statistic Sum \
        --period 300 \
        --evaluation-periods 2 \
        --threshold 5 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=FunctionName,Value="$FUNCTION_NAME" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --treat-missing-data notBreaching
    
    print_info "Created alarm: $ALARM_NAME"
done

# Step 4: Create API Gateway Alarms
print_info "Creating API Gateway alarms..."

API_NAME="ai-testing-platform-${ENVIRONMENT}"

aws cloudwatch put-metric-alarm \
    --alarm-name "${API_NAME}-5xx-errors" \
    --alarm-description "Alert when API Gateway 5xx errors exceed threshold" \
    --metric-name 5XXError \
    --namespace AWS/ApiGateway \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=ApiName,Value="$API_NAME" \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --treat-missing-data notBreaching

print_info "Created alarm: ${API_NAME}-5xx-errors"

# Step 5: Create DynamoDB Throttling Alarms
print_info "Creating DynamoDB throttling alarms..."

for TABLE_NAME in "${DYNAMODB_TABLES[@]}"; do
    ALARM_NAME="${TABLE_NAME}-throttling"
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "$ALARM_NAME" \
        --alarm-description "Alert when $TABLE_NAME experiences throttling" \
        --metric-name UserErrors \
        --namespace AWS/DynamoDB \
        --statistic Sum \
        --period 300 \
        --evaluation-periods 2 \
        --threshold 1 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=TableName,Value="$TABLE_NAME" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --treat-missing-data notBreaching
    
    print_info "Created alarm: $ALARM_NAME"
done

# Step 6: Create Custom Metric Alarms
print_info "Creating custom metric alarms..."

# Test Failure Rate Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "test-failure-rate-${ENVIRONMENT}" \
    --alarm-description "Alert when test success rate drops below 80%" \
    --metric-name TestSuccessRate \
    --namespace AiTestingPlatform \
    --statistic Average \
    --period 300 \
    --evaluation-periods 3 \
    --threshold 0.8 \
    --comparison-operator LessThanThreshold \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --treat-missing-data notBreaching

print_info "Created alarm: test-failure-rate-${ENVIRONMENT}"

# Step 7: Create CloudWatch Dashboard
print_info "Creating CloudWatch Dashboard..."

DASHBOARD_NAME="ai-testing-platform-${ENVIRONMENT}"

# Generate dashboard JSON
DASHBOARD_BODY=$(cat <<EOF
{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Auth Invocations"}, {"dimensions": {"FunctionName": "ai-testing-auth-${ENVIRONMENT}"}}],
                    [".", "Errors", {"stat": "Sum", "label": "Auth Errors"}, {"dimensions": {"FunctionName": "ai-testing-auth-${ENVIRONMENT}"}}],
                    [".", "Duration", {"stat": "Average", "label": "Auth Duration", "yAxis": "right"}, {"dimensions": {"FunctionName": "ai-testing-auth-${ENVIRONMENT}"}}]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Auth Lambda Metrics",
                "period": 300,
                "yAxis": {
                    "left": {"label": "Count"},
                    "right": {"label": "Milliseconds"}
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Test Gen Invocations"}, {"dimensions": {"FunctionName": "ai-testing-test-generation-${ENVIRONMENT}"}}],
                    [".", "Errors", {"stat": "Sum", "label": "Test Gen Errors"}, {"dimensions": {"FunctionName": "ai-testing-test-generation-${ENVIRONMENT}"}}],
                    [".", "Duration", {"stat": "Average", "label": "Test Gen Duration", "yAxis": "right"}, {"dimensions": {"FunctionName": "ai-testing-test-generation-${ENVIRONMENT}"}}]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Test Generation Lambda Metrics",
                "period": 300,
                "yAxis": {
                    "left": {"label": "Count"},
                    "right": {"label": "Milliseconds"}
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Test Exec Invocations"}, {"dimensions": {"FunctionName": "ai-testing-test-execution-${ENVIRONMENT}"}}],
                    [".", "Errors", {"stat": "Sum", "label": "Test Exec Errors"}, {"dimensions": {"FunctionName": "ai-testing-test-execution-${ENVIRONMENT}"}}],
                    [".", "Duration", {"stat": "Average", "label": "Test Exec Duration", "yAxis": "right"}, {"dimensions": {"FunctionName": "ai-testing-test-execution-${ENVIRONMENT}"}}]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Test Execution Lambda Metrics",
                "period": 300,
                "yAxis": {
                    "left": {"label": "Count"},
                    "right": {"label": "Milliseconds"}
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Storage Invocations"}, {"dimensions": {"FunctionName": "ai-testing-storage-${ENVIRONMENT}"}}],
                    [".", "Errors", {"stat": "Sum", "label": "Storage Errors"}, {"dimensions": {"FunctionName": "ai-testing-storage-${ENVIRONMENT}"}}],
                    [".", "Duration", {"stat": "Average", "label": "Storage Duration", "yAxis": "right"}, {"dimensions": {"FunctionName": "ai-testing-storage-${ENVIRONMENT}"}}]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Storage Lambda Metrics",
                "period": 300,
                "yAxis": {
                    "left": {"label": "Count"},
                    "right": {"label": "Milliseconds"}
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Report Invocations"}, {"dimensions": {"FunctionName": "ai-testing-report-${ENVIRONMENT}"}}],
                    [".", "Errors", {"stat": "Sum", "label": "Report Errors"}, {"dimensions": {"FunctionName": "ai-testing-report-${ENVIRONMENT}"}}],
                    [".", "Duration", {"stat": "Average", "label": "Report Duration", "yAxis": "right"}, {"dimensions": {"FunctionName": "ai-testing-report-${ENVIRONMENT}"}}]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Report Lambda Metrics",
                "period": 300,
                "yAxis": {
                    "left": {"label": "Count"},
                    "right": {"label": "Milliseconds"}
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/ApiGateway", "Count", {"stat": "Sum", "label": "Requests"}, {"dimensions": {"ApiName": "${API_NAME}"}}],
                    [".", "4XXError", {"stat": "Sum", "label": "4xx Errors"}, {"dimensions": {"ApiName": "${API_NAME}"}}],
                    [".", "5XXError", {"stat": "Sum", "label": "5xx Errors"}, {"dimensions": {"ApiName": "${API_NAME}"}}],
                    [".", "Latency", {"stat": "Average", "label": "Latency", "yAxis": "right"}, {"dimensions": {"ApiName": "${API_NAME}"}}]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "API Gateway Metrics",
                "period": 300,
                "yAxis": {
                    "left": {"label": "Count"},
                    "right": {"label": "Milliseconds"}
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AiTestingPlatform", "TestSuccessRate", {"stat": "Average", "label": "Success Rate"}],
                    [".", "TestExecutionDuration", {"stat": "Average", "label": "Execution Duration", "yAxis": "right"}],
                    [".", "TestGenerationDuration", {"stat": "Average", "label": "Generation Duration", "yAxis": "right"}]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Test Execution Metrics",
                "period": 300,
                "yAxis": {
                    "left": {"label": "Percent"},
                    "right": {"label": "Milliseconds"}
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/DynamoDB", "UserErrors", {"stat": "Sum", "label": "Users Table"}, {"dimensions": {"TableName": "ai-testing-users-${ENVIRONMENT}"}}],
                    ["...", {"dimensions": {"TableName": "ai-testing-tests-${ENVIRONMENT}"}, "label": "Tests Table"}],
                    ["...", {"dimensions": {"TableName": "ai-testing-test-results-${ENVIRONMENT}"}, "label": "TestResults Table"}],
                    ["...", {"dimensions": {"TableName": "ai-testing-environments-${ENVIRONMENT}"}, "label": "Environments Table"}]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "DynamoDB Throttling",
                "period": 300,
                "yAxis": {
                    "left": {"label": "Count"}
                }
            }
        }
    ]
}
EOF
)

aws cloudwatch put-dashboard \
    --dashboard-name "$DASHBOARD_NAME" \
    --dashboard-body "$DASHBOARD_BODY"

print_info "Created dashboard: $DASHBOARD_NAME"

# Summary
print_info "========================================="
print_info "CloudWatch Setup Complete!"
print_info "========================================="
print_info "Environment: $ENVIRONMENT"
print_info "Region: $AWS_REGION"
print_info ""
print_info "Created Resources:"
print_info "  - ${#LAMBDA_FUNCTIONS[@]} Log Groups (30-day retention)"
print_info "  - SNS Topic: $SNS_TOPIC_NAME"
print_info "  - $((${#LAMBDA_FUNCTIONS[@]} + ${#DYNAMODB_TABLES[@]} + 2)) CloudWatch Alarms"
print_info "  - Dashboard: $DASHBOARD_NAME"
print_info ""
print_info "Next Steps:"
print_info "  1. Confirm SNS email subscription (if provided)"
print_info "  2. View dashboard: https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=${DASHBOARD_NAME}"
print_info "  3. Deploy Lambda functions to start logging"
print_info "  4. Publish custom metrics from Lambda code"
print_info ""
print_info "Documentation: docs/CLOUDWATCH_SETUP.md"
print_info "========================================="
