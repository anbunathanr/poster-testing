#!/bin/bash

# AI Testing Platform - IAM Roles Setup Script
# This script creates all required IAM roles for the platform

set -e

echo "=========================================="
echo "AI Testing Platform - IAM Setup"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials are not configured${NC}"
    echo "Please run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓ AWS CLI is configured${NC}"
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"
echo ""

# Directory containing IAM policies
POLICY_DIR="infrastructure/iam-policies"

if [ ! -d "$POLICY_DIR" ]; then
    echo -e "${RED}Error: Policy directory not found: $POLICY_DIR${NC}"
    exit 1
fi

# Function to create IAM role
create_role() {
    local role_name=$1
    local policy_file=$2
    local description=$3
    
    echo -e "${YELLOW}Creating role: $role_name${NC}"
    
    # Check if role already exists
    if aws iam get-role --role-name "$role_name" &> /dev/null; then
        echo -e "${YELLOW}  Role already exists, skipping creation${NC}"
    else
        # Create the role
        aws iam create-role \
            --role-name "$role_name" \
            --assume-role-policy-document "file://$POLICY_DIR/trust-policy-lambda.json" \
            --description "$description" \
            > /dev/null
        
        echo -e "${GREEN}  ✓ Role created${NC}"
        
        # Wait for role to be available (IAM eventual consistency)
        sleep 2
    fi
    
    # Attach or update the policy
    echo -e "${YELLOW}  Attaching policy: $policy_file${NC}"
    aws iam put-role-policy \
        --role-name "$role_name" \
        --policy-name "${role_name}-permissions" \
        --policy-document "file://$POLICY_DIR/$policy_file" \
        > /dev/null
    
    echo -e "${GREEN}  ✓ Policy attached${NC}"
    echo ""
}

# Create all IAM roles
echo "=========================================="
echo "Creating IAM Roles"
echo "=========================================="
echo ""

create_role \
    "ai-testing-platform-auth-lambda-role" \
    "auth-lambda-policy.json" \
    "IAM role for Auth Lambda function"

create_role \
    "ai-testing-platform-testgen-lambda-role" \
    "testgen-lambda-policy.json" \
    "IAM role for Test Generation Lambda function"

create_role \
    "ai-testing-platform-testexec-lambda-role" \
    "testexec-lambda-policy.json" \
    "IAM role for Test Execution Lambda function"

create_role \
    "ai-testing-platform-storage-lambda-role" \
    "storage-lambda-policy.json" \
    "IAM role for Storage Lambda function"

create_role \
    "ai-testing-platform-report-lambda-role" \
    "report-lambda-policy.json" \
    "IAM role for Report Lambda function"

create_role \
    "ai-testing-platform-authorizer-lambda-role" \
    "authorizer-lambda-policy.json" \
    "IAM role for API Gateway Lambda Authorizer"

echo "=========================================="
echo "Verification"
echo "=========================================="
echo ""

echo "Listing created roles:"
aws iam list-roles \
    --query 'Roles[?contains(RoleName, `ai-testing-platform`)].RoleName' \
    --output table

echo ""
echo -e "${GREEN}=========================================="
echo "✓ IAM Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Review the created roles in AWS IAM Console"
echo "2. Proceed to Task 1.2: Create DynamoDB tables"
echo "3. Proceed to Task 1.3: Create S3 bucket"
echo ""
echo "Role ARNs (for reference):"
echo "  Auth Lambda: arn:aws:iam::$ACCOUNT_ID:role/ai-testing-platform-auth-lambda-role"
echo "  TestGen Lambda: arn:aws:iam::$ACCOUNT_ID:role/ai-testing-platform-testgen-lambda-role"
echo "  TestExec Lambda: arn:aws:iam::$ACCOUNT_ID:role/ai-testing-platform-testexec-lambda-role"
echo "  Storage Lambda: arn:aws:iam::$ACCOUNT_ID:role/ai-testing-platform-storage-lambda-role"
echo "  Report Lambda: arn:aws:iam::$ACCOUNT_ID:role/ai-testing-platform-report-lambda-role"
echo "  Authorizer Lambda: arn:aws:iam::$ACCOUNT_ID:role/ai-testing-platform-authorizer-lambda-role"
echo ""
