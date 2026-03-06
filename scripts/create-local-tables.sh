#!/bin/bash

# Script to create local DynamoDB tables for development
# Usage: ./scripts/create-local-tables.sh

set -e

ENDPOINT="http://localhost:8000"
REGION="us-east-1"

echo "Creating local DynamoDB tables..."
echo "Endpoint: $ENDPOINT"
echo ""

# Create Users Table
echo "Creating Users table..."
aws dynamodb create-table \
  --table-name ai-testing-users-local \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=email,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    "[{\"IndexName\":\"tenantId-email-index\",\"KeySchema\":[{\"AttributeName\":\"tenantId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"email\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  > /dev/null 2>&1 && echo "✓ Users table created" || echo "✗ Users table already exists or error occurred"

# Create Tests Table
echo "Creating Tests table..."
aws dynamodb create-table \
  --table-name ai-testing-tests-local \
  --attribute-definitions \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=testId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=createdAt,AttributeType=N \
  --key-schema \
    AttributeName=tenantId,KeyType=HASH \
    AttributeName=testId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    "[{\"IndexName\":\"userId-createdAt-index\",\"KeySchema\":[{\"AttributeName\":\"userId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  > /dev/null 2>&1 && echo "✓ Tests table created" || echo "✗ Tests table already exists or error occurred"

# Create TestResults Table
echo "Creating TestResults table..."
aws dynamodb create-table \
  --table-name ai-testing-results-local \
  --attribute-definitions \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=resultId,AttributeType=S \
    AttributeName=testId,AttributeType=S \
    AttributeName=startTime,AttributeType=N \
  --key-schema \
    AttributeName=tenantId,KeyType=HASH \
    AttributeName=resultId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    "[{\"IndexName\":\"testId-startTime-index\",\"KeySchema\":[{\"AttributeName\":\"testId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"startTime\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  > /dev/null 2>&1 && echo "✓ TestResults table created" || echo "✗ TestResults table already exists or error occurred"

# Create Environments Table
echo "Creating Environments table..."
aws dynamodb create-table \
  --table-name ai-testing-environments-local \
  --attribute-definitions \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=environment,AttributeType=S \
  --key-schema \
    AttributeName=tenantId,KeyType=HASH \
    AttributeName=environment,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url $ENDPOINT \
  --region $REGION \
  > /dev/null 2>&1 && echo "✓ Environments table created" || echo "✗ Environments table already exists or error occurred"

echo ""
echo "Listing all local tables:"
aws dynamodb list-tables --endpoint-url $ENDPOINT --region $REGION

echo ""
echo "Local DynamoDB setup complete!"
echo "Tables are available at: $ENDPOINT"
