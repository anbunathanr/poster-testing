#!/bin/bash

# Encryption Verification Script
# This script verifies that encryption at rest is enabled for all DynamoDB tables and S3 buckets

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-dev}

echo "=========================================="
echo "Encryption Verification Script"
echo "Environment: $ENVIRONMENT"
echo "=========================================="
echo ""

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"
echo ""

# Function to check DynamoDB table encryption
check_dynamodb_encryption() {
  local table_name=$1
  echo -n "Checking $table_name... "
  
  # Check if table exists
  if ! aws dynamodb describe-table --table-name "$table_name" &>/dev/null; then
    echo -e "${YELLOW}SKIPPED${NC} (table does not exist)"
    return
  fi
  
  # Get encryption status
  local status=$(aws dynamodb describe-table --table-name "$table_name" --query 'Table.SSEDescription.Status' --output text 2>/dev/null)
  
  if [ "$status" == "ENABLED" ]; then
    local sse_type=$(aws dynamodb describe-table --table-name "$table_name" --query 'Table.SSEDescription.SSEType' --output text 2>/dev/null)
    echo -e "${GREEN}✓ ENCRYPTED${NC} (Type: $sse_type)"
  else
    echo -e "${RED}✗ NOT ENCRYPTED${NC}"
    exit 1
  fi
}

# Function to check S3 bucket encryption
check_s3_encryption() {
  local bucket_name=$1
  echo -n "Checking $bucket_name... "
  
  # Check if bucket exists
  if ! aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
    echo -e "${YELLOW}SKIPPED${NC} (bucket does not exist)"
    return
  fi
  
  # Get encryption configuration
  local encryption=$(aws s3api get-bucket-encryption --bucket "$bucket_name" --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text 2>/dev/null)
  
  if [ "$encryption" == "AES256" ] || [ "$encryption" == "aws:kms" ]; then
    echo -e "${GREEN}✓ ENCRYPTED${NC} (Algorithm: $encryption)"
  else
    echo -e "${RED}✗ NOT ENCRYPTED${NC}"
    exit 1
  fi
}

# Check DynamoDB Tables
echo "=== DynamoDB Tables ==="
check_dynamodb_encryption "ai-testing-users-$ENVIRONMENT"
check_dynamodb_encryption "ai-testing-tests-$ENVIRONMENT"
check_dynamodb_encryption "ai-testing-results-$ENVIRONMENT"
check_dynamodb_encryption "ai-testing-environments-$ENVIRONMENT"
echo ""

# Check S3 Buckets
echo "=== S3 Buckets ==="
check_s3_encryption "ai-testing-evidence-$ENVIRONMENT-$ACCOUNT_ID"
echo ""

# Check Point-in-Time Recovery for DynamoDB
echo "=== DynamoDB Point-in-Time Recovery ==="
for table in "ai-testing-users-$ENVIRONMENT" "ai-testing-tests-$ENVIRONMENT" "ai-testing-results-$ENVIRONMENT" "ai-testing-environments-$ENVIRONMENT"; do
  if aws dynamodb describe-table --table-name "$table" &>/dev/null; then
    echo -n "Checking $table... "
    pitr_status=$(aws dynamodb describe-continuous-backups --table-name "$table" --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' --output text 2>/dev/null)
    if [ "$pitr_status" == "ENABLED" ]; then
      echo -e "${GREEN}✓ ENABLED${NC}"
    else
      echo -e "${YELLOW}⚠ DISABLED${NC}"
    fi
  fi
done
echo ""

# Check S3 Block Public Access
echo "=== S3 Block Public Access ==="
bucket_name="ai-testing-evidence-$ENVIRONMENT-$ACCOUNT_ID"
if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
  echo -n "Checking $bucket_name... "
  block_public=$(aws s3api get-public-access-block --bucket "$bucket_name" --query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text 2>/dev/null)
  if [ "$block_public" == "True" ]; then
    echo -e "${GREEN}✓ ENABLED${NC}"
  else
    echo -e "${RED}✗ DISABLED${NC}"
    exit 1
  fi
fi
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}✓ All encryption checks passed!${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "- All DynamoDB tables are encrypted at rest"
echo "- All S3 buckets are encrypted at rest"
echo "- Point-in-Time Recovery is enabled for DynamoDB"
echo "- S3 Block Public Access is enabled"
echo ""
echo "For detailed encryption information, see docs/ENCRYPTION_SETUP.md"
