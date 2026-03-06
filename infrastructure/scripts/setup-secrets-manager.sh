#!/bin/bash

# AI Testing Platform - AWS Secrets Manager Setup Script
# This script creates all required secrets for the platform

set -e

echo "=========================================="
echo "AI Testing Platform - Secrets Manager Setup"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if environment parameter is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Environment parameter is required${NC}"
    echo "Usage: ./setup-secrets-manager.sh <environment>"
    echo "Example: ./setup-secrets-manager.sh dev"
    echo ""
    echo "Valid environments: dev, staging, prod"
    exit 1
fi

ENVIRONMENT=$1

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
    echo "Valid environments: dev, staging, prod"
    exit 1
fi

echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo ""

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

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

if [ -z "$AWS_REGION" ]; then
    AWS_REGION="us-east-1"
    echo -e "${YELLOW}Warning: No default region set, using us-east-1${NC}"
fi

echo "AWS Account ID: $ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo ""

# Function to generate random string
generate_random_string() {
    local length=$1
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to create or update secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    echo -e "${YELLOW}Processing secret: $secret_name${NC}"
    
    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$AWS_REGION" &> /dev/null; then
        echo -e "${YELLOW}  Secret already exists${NC}"
        
        # Ask user if they want to update
        read -p "  Do you want to update this secret? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            aws secretsmanager update-secret \
                --secret-id "$secret_name" \
                --secret-string "$secret_value" \
                --region "$AWS_REGION" \
                > /dev/null
            
            echo -e "${GREEN}  ✓ Secret updated${NC}"
        else
            echo -e "${YELLOW}  Skipped update${NC}"
        fi
    else
        # Create new secret
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --description "$description" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION" \
            --tags Key=Environment,Value="$ENVIRONMENT" \
                   Key=Application,Value=ai-testing-platform \
                   Key=ManagedBy,Value=script \
            > /dev/null
        
        echo -e "${GREEN}  ✓ Secret created${NC}"
    fi
    
    # Get secret ARN
    SECRET_ARN=$(aws secretsmanager describe-secret \
        --secret-id "$secret_name" \
        --region "$AWS_REGION" \
        --query 'ARN' \
        --output text)
    
    echo -e "${BLUE}  ARN: $SECRET_ARN${NC}"
    echo ""
}

# Function to create secret with user input
create_secret_with_input() {
    local secret_name=$1
    local description=$2
    local prompt_message=$3
    local default_value=$4
    
    echo -e "${YELLOW}Creating secret: $secret_name${NC}"
    echo -e "${BLUE}$description${NC}"
    
    if [ -n "$default_value" ]; then
        read -p "$prompt_message [$default_value]: " user_input
        secret_value="${user_input:-$default_value}"
    else
        read -p "$prompt_message: " secret_value
    fi
    
    if [ -z "$secret_value" ]; then
        echo -e "${RED}  Error: Secret value cannot be empty${NC}"
        return 1
    fi
    
    create_or_update_secret "$secret_name" "$secret_value" "$description"
}

echo "=========================================="
echo "Creating Secrets"
echo "=========================================="
echo ""

# 1. JWT Secret Key
echo -e "${BLUE}[1/4] JWT Secret Key${NC}"
echo "This secret is used for signing and verifying JWT authentication tokens."
echo ""

# Generate a secure random JWT secret
JWT_SECRET=$(generate_random_string 64)

create_or_update_secret \
    "ai-testing/jwt-secret" \
    "$JWT_SECRET" \
    "JWT secret key for token signing and verification - $ENVIRONMENT"

# 2. Default Environment Credentials
echo -e "${BLUE}[2/4] Default Environment Credentials${NC}"
echo "These credentials are used for test execution against target applications."
echo ""

# Create default environment credentials template
ENV_CREDENTIALS='{
  "baseUrl": "https://example.com",
  "username": "test-user@example.com",
  "password": "CHANGE_ME_PLACEHOLDER",
  "apiKey": "CHANGE_ME_PLACEHOLDER",
  "additionalConfig": {
    "timeout": 30000,
    "retries": 3
  }
}'

create_or_update_secret \
    "ai-testing/env/$ENVIRONMENT/default" \
    "$ENV_CREDENTIALS" \
    "Default environment credentials for $ENVIRONMENT"

echo -e "${YELLOW}⚠️  IMPORTANT: Update the placeholder values in this secret!${NC}"
echo ""

# 3. Database Connection String (Optional)
echo -e "${BLUE}[3/4] Database Connection String (Optional)${NC}"
echo "This secret stores database credentials if using external databases."
echo ""

read -p "Do you want to create a database connection secret? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DB_CONNECTION='{
  "host": "database.example.com",
  "port": 5432,
  "database": "ai_testing",
  "username": "db_user",
  "password": "CHANGE_ME_PLACEHOLDER",
  "ssl": true
}'
    
    create_or_update_secret \
        "ai-testing/database/connection" \
        "$DB_CONNECTION" \
        "Database connection credentials for $ENVIRONMENT"
    
    echo -e "${YELLOW}⚠️  IMPORTANT: Update the placeholder values in this secret!${NC}"
else
    echo -e "${YELLOW}  Skipped database connection secret${NC}"
fi
echo ""

# 4. Third-Party API Keys (Optional)
echo -e "${BLUE}[4/4] Third-Party API Keys (Optional)${NC}"
echo "This secret stores API keys for external services (e.g., n8n, monitoring)."
echo ""

read -p "Do you want to create a third-party API keys secret? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    API_KEYS='{
  "n8n": {
    "apiKey": "CHANGE_ME_PLACEHOLDER",
    "webhookUrl": "https://webhook.example.com/notify"
  },
  "monitoring": {
    "apiKey": "CHANGE_ME_PLACEHOLDER"
  }
}'
    
    create_or_update_secret \
        "ai-testing/api-keys/services" \
        "$API_KEYS" \
        "Third-party API keys for $ENVIRONMENT"
    
    echo -e "${YELLOW}⚠️  IMPORTANT: Update the placeholder values in this secret!${NC}"
else
    echo -e "${YELLOW}  Skipped third-party API keys secret${NC}"
fi
echo ""

echo "=========================================="
echo "Configuring Secret Rotation (Optional)"
echo "=========================================="
echo ""

echo "Secret rotation enhances security by automatically updating secrets periodically."
echo ""

read -p "Do you want to enable automatic rotation for JWT secret? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Note: Automatic rotation requires a Lambda function to handle rotation logic.${NC}"
    echo "For now, we'll set up a rotation schedule. You'll need to implement the rotation Lambda."
    echo ""
    
    # Note: Actual rotation requires a Lambda function
    # This is a placeholder for the rotation configuration
    echo -e "${BLUE}Rotation schedule: Every 90 days${NC}"
    echo -e "${YELLOW}⚠️  TODO: Implement rotation Lambda function${NC}"
    echo "See: https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html"
else
    echo -e "${YELLOW}  Skipped automatic rotation setup${NC}"
fi
echo ""

echo "=========================================="
echo "Verification"
echo "=========================================="
echo ""

echo "Listing created secrets:"
aws secretsmanager list-secrets \
    --region "$AWS_REGION" \
    --query "SecretList[?contains(Name, 'ai-testing')].{Name:Name,Description:Description}" \
    --output table

echo ""
echo -e "${GREEN}=========================================="
echo "✓ Secrets Manager Setup Complete!"
echo "==========================================${NC}"
echo ""

echo "Created secrets:"
echo "  1. ai-testing/jwt-secret"
echo "  2. ai-testing/env/$ENVIRONMENT/default"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  3. ai-testing/database/connection"
    echo "  4. ai-testing/api-keys/services"
fi
echo ""

echo -e "${YELLOW}⚠️  IMPORTANT NEXT STEPS:${NC}"
echo ""
echo "1. Update placeholder values in secrets:"
echo "   - ai-testing/env/$ENVIRONMENT/default"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   - ai-testing/database/connection"
    echo "   - ai-testing/api-keys/services"
fi
echo ""
echo "2. Update IAM roles to grant Lambda functions access to secrets:"
echo "   - Auth Lambda needs: ai-testing/jwt-secret"
echo "   - Test Execution Lambda needs: ai-testing/env/*"
echo "   - Storage Lambda needs: ai-testing/database/* (if applicable)"
echo ""
echo "3. Update Lambda function code to retrieve secrets from Secrets Manager"
echo ""
echo "4. Test secret retrieval in dev environment before deploying to production"
echo ""
echo "5. Set up CloudWatch alarms for secret access monitoring"
echo ""
echo "6. Implement secret rotation policies (recommended every 90 days for JWT)"
echo ""

echo "To update a secret value:"
echo "  aws secretsmanager update-secret \\"
echo "    --secret-id ai-testing/jwt-secret \\"
echo "    --secret-string 'new-secret-value' \\"
echo "    --region $AWS_REGION"
echo ""

echo "To retrieve a secret value:"
echo "  aws secretsmanager get-secret-value \\"
echo "    --secret-id ai-testing/jwt-secret \\"
echo "    --region $AWS_REGION \\"
echo "    --query SecretString \\"
echo "    --output text"
echo ""

echo "For more information, see: docs/SECRETS_MANAGER_SETUP.md"
echo ""
