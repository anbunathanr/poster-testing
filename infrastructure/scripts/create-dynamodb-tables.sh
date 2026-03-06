#!/bin/bash

# Script to create DynamoDB tables for AI Testing Platform
# Usage: ./create-dynamodb-tables.sh <environment>
# Example: ./create-dynamodb-tables.sh dev

set -e

# Check if environment parameter is provided
if [ -z "$1" ]; then
  echo "Error: Environment parameter is required"
  echo "Usage: ./create-dynamodb-tables.sh <environment>"
  echo "Example: ./create-dynamodb-tables.sh dev"
  exit 1
fi

ENVIRONMENT=$1
REGION=${AWS_REGION:-us-east-1}

echo "=========================================="
echo "Creating DynamoDB Tables"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "=========================================="
echo ""

# Function to check if table exists
table_exists() {
  aws dynamodb describe-table --table-name "$1" --region "$REGION" &>/dev/null
}

# Function to wait for table to be active
wait_for_table() {
  echo "Waiting for table $1 to become active..."
  aws dynamodb wait table-exists --table-name "$1" --region "$REGION"
  echo "Table $1 is now active"
}

# 1. Create Users Table
echo "Creating Users Table..."
USERS_TABLE="ai-testing-users-${ENVIRONMENT}"

if table_exists "$USERS_TABLE"; then
  echo "Table $USERS_TABLE already exists. Skipping..."
else
  aws dynamodb create-table \
    --table-name "$USERS_TABLE" \
    --attribute-definitions \
      AttributeName=userId,AttributeType=S \
      AttributeName=tenantId,AttributeType=S \
      AttributeName=email,AttributeType=S \
    --key-schema \
      AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true \
    --tags Key=Component,Value=Database Key=Environment,Value="$ENVIRONMENT" \
    --region "$REGION" \
    > /dev/null

  wait_for_table "$USERS_TABLE"

  # Add GSI for tenant-based queries
  echo "Adding GSI to Users Table..."
  aws dynamodb update-table \
    --table-name "$USERS_TABLE" \
    --attribute-definitions \
      AttributeName=tenantId,AttributeType=S \
      AttributeName=email,AttributeType=S \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"tenantId-email-index\",\"KeySchema\":[{\"AttributeName\":\"tenantId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"email\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
    --region "$REGION" \
    > /dev/null

  # Enable Point-in-Time Recovery
  echo "Enabling Point-in-Time Recovery for Users Table..."
  aws dynamodb update-continuous-backups \
    --table-name "$USERS_TABLE" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region "$REGION" \
    > /dev/null

  echo "✓ Users Table created successfully"
fi

echo ""

# 2. Create Tests Table
echo "Creating Tests Table..."
TESTS_TABLE="ai-testing-tests-${ENVIRONMENT}"

if table_exists "$TESTS_TABLE"; then
  echo "Table $TESTS_TABLE already exists. Skipping..."
else
  aws dynamodb create-table \
    --table-name "$TESTS_TABLE" \
    --attribute-definitions \
      AttributeName=tenantId,AttributeType=S \
      AttributeName=testId,AttributeType=S \
      AttributeName=userId,AttributeType=S \
      AttributeName=createdAt,AttributeType=N \
    --key-schema \
      AttributeName=tenantId,KeyType=HASH \
      AttributeName=testId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true \
    --tags Key=Component,Value=Database Key=Environment,Value="$ENVIRONMENT" \
    --region "$REGION" \
    > /dev/null

  wait_for_table "$TESTS_TABLE"

  # Add GSI for user-based queries
  echo "Adding GSI to Tests Table..."
  aws dynamodb update-table \
    --table-name "$TESTS_TABLE" \
    --attribute-definitions \
      AttributeName=userId,AttributeType=S \
      AttributeName=createdAt,AttributeType=N \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"userId-createdAt-index\",\"KeySchema\":[{\"AttributeName\":\"userId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
    --region "$REGION" \
    > /dev/null

  # Enable Point-in-Time Recovery
  echo "Enabling Point-in-Time Recovery for Tests Table..."
  aws dynamodb update-continuous-backups \
    --table-name "$TESTS_TABLE" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region "$REGION" \
    > /dev/null

  echo "✓ Tests Table created successfully"
fi

echo ""

# 3. Create TestResults Table
echo "Creating TestResults Table..."
RESULTS_TABLE="ai-testing-results-${ENVIRONMENT}"

if table_exists "$RESULTS_TABLE"; then
  echo "Table $RESULTS_TABLE already exists. Skipping..."
else
  aws dynamodb create-table \
    --table-name "$RESULTS_TABLE" \
    --attribute-definitions \
      AttributeName=tenantId,AttributeType=S \
      AttributeName=resultId,AttributeType=S \
      AttributeName=testId,AttributeType=S \
      AttributeName=startTime,AttributeType=N \
    --key-schema \
      AttributeName=tenantId,KeyType=HASH \
      AttributeName=resultId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true \
    --tags Key=Component,Value=Database Key=Environment,Value="$ENVIRONMENT" \
    --region "$REGION" \
    > /dev/null

  wait_for_table "$RESULTS_TABLE"

  # Add GSI for test-based queries
  echo "Adding GSI to TestResults Table..."
  aws dynamodb update-table \
    --table-name "$RESULTS_TABLE" \
    --attribute-definitions \
      AttributeName=testId,AttributeType=S \
      AttributeName=startTime,AttributeType=N \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"testId-startTime-index\",\"KeySchema\":[{\"AttributeName\":\"testId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"startTime\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
    --region "$REGION" \
    > /dev/null

  # Enable Point-in-Time Recovery
  echo "Enabling Point-in-Time Recovery for TestResults Table..."
  aws dynamodb update-continuous-backups \
    --table-name "$RESULTS_TABLE" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region "$REGION" \
    > /dev/null

  echo "✓ TestResults Table created successfully"
fi

echo ""

# 4. Create Environments Table
echo "Creating Environments Table..."
ENVIRONMENTS_TABLE="ai-testing-environments-${ENVIRONMENT}"

if table_exists "$ENVIRONMENTS_TABLE"; then
  echo "Table $ENVIRONMENTS_TABLE already exists. Skipping..."
else
  aws dynamodb create-table \
    --table-name "$ENVIRONMENTS_TABLE" \
    --attribute-definitions \
      AttributeName=tenantId,AttributeType=S \
      AttributeName=environment,AttributeType=S \
    --key-schema \
      AttributeName=tenantId,KeyType=HASH \
      AttributeName=environment,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --sse-specification Enabled=true \
    --tags Key=Component,Value=Database Key=Environment,Value="$ENVIRONMENT" \
    --region "$REGION" \
    > /dev/null

  wait_for_table "$ENVIRONMENTS_TABLE"

  # Enable Point-in-Time Recovery
  echo "Enabling Point-in-Time Recovery for Environments Table..."
  aws dynamodb update-continuous-backups \
    --table-name "$ENVIRONMENTS_TABLE" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region "$REGION" \
    > /dev/null

  echo "✓ Environments Table created successfully"
fi

echo ""
echo "=========================================="
echo "DynamoDB Tables Creation Complete!"
echo "=========================================="
echo ""
echo "Created tables:"
echo "  - $USERS_TABLE"
echo "  - $TESTS_TABLE"
echo "  - $RESULTS_TABLE"
echo "  - $ENVIRONMENTS_TABLE"
echo ""
echo "All tables are configured with:"
echo "  - Billing Mode: On-demand (PAY_PER_REQUEST)"
echo "  - Encryption: AWS-managed (SSE)"
echo "  - Point-in-Time Recovery: Enabled"
echo "  - Global Secondary Indexes: Configured"
echo ""
echo "To verify tables, run:"
echo "  aws dynamodb list-tables --region $REGION"
echo ""
echo "To view table details, run:"
echo "  aws dynamodb describe-table --table-name <table-name> --region $REGION"
echo ""
