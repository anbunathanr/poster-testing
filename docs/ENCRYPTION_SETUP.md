# Encryption at Rest Setup

## Overview

This document describes the encryption at rest configuration for the AI-Powered Automated Testing Platform. All data stored in DynamoDB tables and S3 buckets is encrypted to ensure data security and compliance with industry standards.

## DynamoDB Encryption

### Configuration

All DynamoDB tables use **AWS-managed encryption** (SSE-DynamoDB) for encryption at rest:

- **Users Table**: `ai-testing-users-{environment}`
- **Tests Table**: `ai-testing-tests-{environment}`
- **TestResults Table**: `ai-testing-results-{environment}`
- **Environments Table**: `ai-testing-environments-{environment}`

### Encryption Details

**Encryption Type**: AWS-managed keys (SSE-DynamoDB)

**Key Management**:
- AWS automatically manages encryption keys
- Keys are rotated automatically by AWS
- No manual key management required
- Keys are unique per table and region

**What is Encrypted**:
- All table data at rest
- Global Secondary Indexes (GSIs)
- Local Secondary Indexes (LSIs)
- Streams data
- Backups and point-in-time recovery snapshots

**Performance Impact**: Minimal - encryption/decryption happens transparently with negligible latency impact

### CDK Configuration

```typescript
const table = new dynamodb.Table(this, 'TableName', {
  tableName: `ai-testing-table-${environment}`,
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: true,
});
```

### Verification Steps

#### 1. Verify Encryption via AWS Console

1. Navigate to DynamoDB in AWS Console
2. Select a table (e.g., `ai-testing-users-dev`)
3. Go to the "Additional settings" tab
4. Verify "Encryption type" shows "AWS owned key"

#### 2. Verify Encryption via AWS CLI

```bash
# Check encryption status for Users table
aws dynamodb describe-table \
  --table-name ai-testing-users-dev \
  --query 'Table.SSEDescription' \
  --output json

# Expected output:
# {
#   "Status": "ENABLED",
#   "SSEType": "KMS"
# }
```

#### 3. Verify All Tables

```bash
# List all tables and check encryption
for table in ai-testing-users-dev ai-testing-tests-dev ai-testing-results-dev ai-testing-environments-dev; do
  echo "Checking $table..."
  aws dynamodb describe-table --table-name $table --query 'Table.SSEDescription.Status' --output text
done
```

## S3 Encryption

### Configuration

The S3 evidence bucket uses **Server-Side Encryption with S3-managed keys** (SSE-S3):

- **Bucket Name**: `ai-testing-evidence-{environment}-{account-id}`
- **Encryption**: SSE-S3 (AES-256)

### Encryption Details

**Encryption Type**: Server-Side Encryption with Amazon S3-managed keys (SSE-S3)

**Key Management**:
- AWS S3 automatically manages encryption keys
- Each object is encrypted with a unique key
- Keys are rotated regularly by AWS
- No manual key management required

**What is Encrypted**:
- All objects stored in the bucket
- Screenshots (`.png` files)
- Execution logs (`.json` files)
- Test reports (`.json` files)
- All object metadata

**Encryption Algorithm**: AES-256

**Performance Impact**: Minimal - encryption/decryption happens transparently

### CDK Configuration

```typescript
const bucket = new s3.Bucket(this, 'EvidenceBucket', {
  bucketName: `ai-testing-evidence-${environment}-${cdk.Aws.ACCOUNT_ID}`,
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  versioned: false,
});
```

### Verification Steps

#### 1. Verify Encryption via AWS Console

1. Navigate to S3 in AWS Console
2. Select the bucket `ai-testing-evidence-{environment}-{account-id}`
3. Go to the "Properties" tab
4. Scroll to "Default encryption"
5. Verify "Encryption type" shows "Server-side encryption with Amazon S3 managed keys (SSE-S3)"

#### 2. Verify Encryption via AWS CLI

```bash
# Check bucket encryption configuration
aws s3api get-bucket-encryption \
  --bucket ai-testing-evidence-dev-$(aws sts get-caller-identity --query Account --output text)

# Expected output:
# {
#   "ServerSideEncryptionConfiguration": {
#     "Rules": [
#       {
#         "ApplyServerSideEncryptionByDefault": {
#           "SSEAlgorithm": "AES256"
#         },
#         "BucketKeyEnabled": false
#       }
#     ]
#   }
# }
```

#### 3. Verify Object Encryption

```bash
# Upload a test file and verify it's encrypted
echo "test" > test.txt
aws s3 cp test.txt s3://ai-testing-evidence-dev-$(aws sts get-caller-identity --query Account --output text)/test.txt

# Check object encryption
aws s3api head-object \
  --bucket ai-testing-evidence-dev-$(aws sts get-caller-identity --query Account --output text) \
  --key test.txt \
  --query 'ServerSideEncryption' \
  --output text

# Expected output: AES256

# Clean up
aws s3 rm s3://ai-testing-evidence-dev-$(aws sts get-caller-identity --query Account --output text)/test.txt
rm test.txt
```

## Key Rotation Policies

### DynamoDB (AWS-Managed Keys)

- **Automatic Rotation**: AWS automatically rotates encryption keys
- **Rotation Frequency**: Keys are rotated regularly by AWS (exact schedule not disclosed)
- **No Action Required**: Rotation is transparent and requires no manual intervention
- **Backward Compatibility**: Old data remains accessible after key rotation

### S3 (SSE-S3)

- **Automatic Rotation**: AWS automatically rotates S3-managed keys
- **Rotation Frequency**: Keys are rotated regularly by AWS
- **No Action Required**: Rotation is transparent and requires no manual intervention
- **Per-Object Keys**: Each object is encrypted with a unique data key

### Upgrading to Customer-Managed Keys (Optional)

If your organization requires customer-managed keys (CMK) for compliance:

#### DynamoDB - Switch to Customer-Managed KMS Keys

```typescript
import * as kms from 'aws-cdk-lib/aws-kms';

// Create KMS key
const dynamoKey = new kms.Key(this, 'DynamoDBKey', {
  description: 'KMS key for DynamoDB encryption',
  enableKeyRotation: true, // Automatic annual rotation
});

// Use in table
const table = new dynamodb.Table(this, 'TableName', {
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: dynamoKey,
});
```

#### S3 - Switch to Customer-Managed KMS Keys

```typescript
import * as kms from 'aws-cdk-lib/aws-kms';

// Create KMS key
const s3Key = new kms.Key(this, 'S3Key', {
  description: 'KMS key for S3 encryption',
  enableKeyRotation: true, // Automatic annual rotation
});

// Use in bucket
const bucket = new s3.Bucket(this, 'EvidenceBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: s3Key,
});
```

## Compliance and Audit

### Compliance Standards

The current encryption configuration supports compliance with:

- **GDPR**: Data protection through encryption at rest
- **HIPAA**: Encryption of electronic protected health information (ePHI)
- **PCI DSS**: Requirement 3.4 - Render PAN unreadable through encryption
- **SOC 2**: Security controls for data protection
- **ISO 27001**: Information security management

### Audit Requirements

#### CloudTrail Logging

All encryption-related API calls are logged in AWS CloudTrail:

```bash
# Query CloudTrail for DynamoDB encryption events
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::DynamoDB::Table \
  --max-results 10

# Query CloudTrail for S3 encryption events
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::S3::Bucket \
  --max-results 10
```

#### Compliance Verification Script

Create a script to verify encryption status across all resources:

```bash
#!/bin/bash
# verify-encryption.sh

echo "=== DynamoDB Encryption Status ==="
for table in ai-testing-users-dev ai-testing-tests-dev ai-testing-results-dev ai-testing-environments-dev; do
  status=$(aws dynamodb describe-table --table-name $table --query 'Table.SSEDescription.Status' --output text 2>/dev/null)
  if [ "$status" == "ENABLED" ]; then
    echo "✓ $table: ENCRYPTED"
  else
    echo "✗ $table: NOT ENCRYPTED"
  fi
done

echo ""
echo "=== S3 Encryption Status ==="
bucket="ai-testing-evidence-dev-$(aws sts get-caller-identity --query Account --output text)"
encryption=$(aws s3api get-bucket-encryption --bucket $bucket --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text 2>/dev/null)
if [ "$encryption" == "AES256" ] || [ "$encryption" == "aws:kms" ]; then
  echo "✓ $bucket: ENCRYPTED ($encryption)"
else
  echo "✗ $bucket: NOT ENCRYPTED"
fi
```

### Audit Trail

All data access is logged and can be audited:

1. **DynamoDB Access**: CloudTrail logs all API calls
2. **S3 Access**: S3 access logs and CloudTrail logs all operations
3. **Encryption Key Usage**: KMS logs all key usage (if using CMK)

### Data Residency

- **DynamoDB**: Data is stored in the AWS region where tables are created
- **S3**: Data is stored in the AWS region where the bucket is created
- **Encryption Keys**: Keys are region-specific and never leave the region

## Security Best Practices

### Current Implementation

✅ **Encryption at rest enabled** for all DynamoDB tables
✅ **Encryption at rest enabled** for S3 bucket
✅ **Block public access** enabled on S3 bucket
✅ **Point-in-time recovery** enabled for DynamoDB tables
✅ **Lifecycle policies** configured for S3 data retention
✅ **HTTPS-only** access enforced via API Gateway

### Additional Recommendations

1. **Enable S3 Access Logging**:
   ```typescript
   const logBucket = new s3.Bucket(this, 'LogBucket', {
     encryption: s3.BucketEncryption.S3_MANAGED,
   });
   
   evidenceBucket.addToResourcePolicy(new iam.PolicyStatement({
     actions: ['s3:PutObject'],
     resources: [logBucket.arnForObjects('*')],
     principals: [new iam.ServicePrincipal('logging.s3.amazonaws.com')],
   }));
   ```

2. **Enable DynamoDB Streams Encryption**:
   - Streams are automatically encrypted when table encryption is enabled

3. **Implement Bucket Policies**:
   - Enforce encryption on upload
   - Deny unencrypted object uploads

4. **Regular Security Audits**:
   - Run the verification script monthly
   - Review CloudTrail logs for unauthorized access attempts
   - Monitor AWS Config for compliance drift

## Troubleshooting

### Issue: "Access Denied" when accessing encrypted data

**Cause**: IAM role lacks permissions to use encryption keys

**Solution**: Ensure Lambda execution roles have appropriate permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ai-testing-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::ai-testing-evidence-*/*"
    }
  ]
}
```

### Issue: Performance degradation after enabling encryption

**Cause**: Encryption overhead (rare with AWS-managed keys)

**Solution**: 
- AWS-managed encryption has minimal performance impact
- If using customer-managed keys, ensure KMS key is in the same region
- Monitor CloudWatch metrics for latency

### Issue: Cannot verify encryption status

**Cause**: Insufficient IAM permissions

**Solution**: Ensure your IAM user/role has these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "s3:GetBucketEncryption",
        "s3:GetEncryptionConfiguration"
      ],
      "Resource": "*"
    }
  ]
}
```

## References

- [DynamoDB Encryption at Rest](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/EncryptionAtRest.html)
- [S3 Server-Side Encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/serv-side-encryption.html)
- [AWS KMS Key Rotation](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)
- [AWS CDK DynamoDB Encryption](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb.TableEncryption.html)
- [AWS CDK S3 Encryption](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.BucketEncryption.html)

## Summary

Both DynamoDB and S3 encryption at rest are fully configured and operational:

- **DynamoDB**: AWS-managed encryption (SSE-DynamoDB) on all 4 tables
- **S3**: Server-side encryption (SSE-S3) on the evidence bucket
- **Key Rotation**: Automatic, managed by AWS
- **Compliance**: Supports GDPR, HIPAA, PCI DSS, SOC 2, ISO 27001
- **Verification**: Use AWS Console or CLI commands provided above
- **Audit**: CloudTrail logs all encryption-related activities

No additional configuration is required unless your organization mandates customer-managed keys (CMK).
