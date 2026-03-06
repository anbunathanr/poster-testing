#!/bin/bash

# Script to create S3 bucket for AI Testing Platform evidence storage
# Usage: ./create-s3-bucket.sh <environment> <aws-account-id>
# Example: ./create-s3-bucket.sh dev 123456789012

set -e

# Color codes for output
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

# Check if required arguments are provided
if [ $# -ne 2 ]; then
    print_error "Usage: $0 <environment> <aws-account-id>"
    print_error "Example: $0 dev 123456789012"
    exit 1
fi

ENVIRONMENT=$1
AWS_ACCOUNT_ID=$2
BUCKET_NAME="ai-testing-evidence-${ENVIRONMENT}-${AWS_ACCOUNT_ID}"
REGION=$(aws configure get region)

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment. Must be one of: dev, staging, prod"
    exit 1
fi

# Validate AWS account ID format
if [[ ! "$AWS_ACCOUNT_ID" =~ ^[0-9]{12}$ ]]; then
    print_error "Invalid AWS account ID. Must be 12 digits."
    exit 1
fi

print_info "Creating S3 bucket: ${BUCKET_NAME}"
print_info "Region: ${REGION}"
print_info "Environment: ${ENVIRONMENT}"

# Check if bucket already exists
if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    print_info "Bucket does not exist. Creating..."
else
    print_warning "Bucket ${BUCKET_NAME} already exists. Skipping creation."
    print_info "Updating bucket configuration..."
fi

# Create bucket (with location constraint for regions other than us-east-1)
if [ "$REGION" == "us-east-1" ]; then
    aws s3api create-bucket \
        --bucket "${BUCKET_NAME}" \
        --region "${REGION}" 2>/dev/null || print_warning "Bucket may already exist"
else
    aws s3api create-bucket \
        --bucket "${BUCKET_NAME}" \
        --region "${REGION}" \
        --create-bucket-configuration LocationConstraint="${REGION}" 2>/dev/null || print_warning "Bucket may already exist"
fi

print_info "Configuring bucket encryption..."
aws s3api put-bucket-encryption \
    --bucket "${BUCKET_NAME}" \
    --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                },
                "BucketKeyEnabled": true
            }
        ]
    }'

print_info "Blocking public access..."
aws s3api put-public-access-block \
    --bucket "${BUCKET_NAME}" \
    --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

print_info "Configuring lifecycle policies..."
aws s3api put-bucket-lifecycle-configuration \
    --bucket "${BUCKET_NAME}" \
    --lifecycle-configuration '{
        "Rules": [
            {
                "Id": "archive-old-evidence",
                "Status": "Enabled",
                "Filter": {
                    "Prefix": ""
                },
                "Transitions": [
                    {
                        "Days": 90,
                        "StorageClass": "GLACIER"
                    }
                ]
            },
            {
                "Id": "delete-very-old-evidence",
                "Status": "Enabled",
                "Filter": {
                    "Prefix": ""
                },
                "Expiration": {
                    "Days": 365
                }
            }
        ]
    }'

print_info "Configuring CORS..."
aws s3api put-bucket-cors \
    --bucket "${BUCKET_NAME}" \
    --cors-configuration '{
        "CORSRules": [
            {
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "PUT"],
                "AllowedOrigins": ["*"],
                "MaxAgeSeconds": 3000
            }
        ]
    }'

print_info "Adding bucket tags..."
aws s3api put-bucket-tagging \
    --bucket "${BUCKET_NAME}" \
    --tagging "TagSet=[
        {Key=Environment,Value=${ENVIRONMENT}},
        {Key=Component,Value=Storage},
        {Key=Project,Value=AITestingPlatform}
    ]"

# Disable versioning (as per design)
print_info "Disabling versioning..."
aws s3api put-bucket-versioning \
    --bucket "${BUCKET_NAME}" \
    --versioning-configuration Status=Suspended

print_info "Creating folder structure examples..."
# Note: S3 doesn't have actual folders, but we can create placeholder objects
# These are just examples and will be created automatically by the application
print_info "Folder structure will be created automatically by the application:"
print_info "  {tenantId}/screenshots/{resultId}/"
print_info "  {tenantId}/logs/{resultId}/"
print_info "  {tenantId}/reports/"

print_info ""
print_info "✓ S3 bucket setup completed successfully!"
print_info ""
print_info "Bucket Name: ${BUCKET_NAME}"
print_info "Region: ${REGION}"
print_info "Encryption: SSE-S3 (AES256)"
print_info "Public Access: Blocked"
print_info "Versioning: Disabled"
print_info "Lifecycle: Archive to Glacier after 90 days, Delete after 365 days"
print_info ""
print_info "Next steps:"
print_info "1. Update Lambda IAM roles to grant access to this bucket"
print_info "2. Update application configuration with bucket name"
print_info "3. Test presigned URL generation"
print_info ""

# Verify bucket configuration
print_info "Verifying bucket configuration..."
aws s3api get-bucket-encryption --bucket "${BUCKET_NAME}" > /dev/null && print_info "✓ Encryption verified"
aws s3api get-public-access-block --bucket "${BUCKET_NAME}" > /dev/null && print_info "✓ Public access block verified"
aws s3api get-bucket-lifecycle-configuration --bucket "${BUCKET_NAME}" > /dev/null && print_info "✓ Lifecycle policies verified"
aws s3api get-bucket-cors --bucket "${BUCKET_NAME}" > /dev/null && print_info "✓ CORS configuration verified"

print_info ""
print_info "Bucket is ready for use!"
