#!/bin/bash

# Script to create local S3 bucket using LocalStack
# Usage: ./scripts/create-local-s3.sh

set -e

ENDPOINT="http://localhost:4566"
BUCKET_NAME="ai-testing-evidence-local"

echo "Creating local S3 bucket..."
echo "Endpoint: $ENDPOINT"
echo "Bucket: $BUCKET_NAME"
echo ""

# Create bucket
aws s3 mb s3://$BUCKET_NAME \
  --endpoint-url $ENDPOINT \
  > /dev/null 2>&1 && echo "✓ S3 bucket created: $BUCKET_NAME" || echo "✗ S3 bucket already exists or error occurred"

# List buckets
echo ""
echo "Listing all local S3 buckets:"
aws s3 ls --endpoint-url $ENDPOINT

echo ""
echo "Local S3 setup complete!"
echo "Bucket is available at: $ENDPOINT"
