# S3 Bucket Setup Guide

## Overview

This guide explains how to set up the S3 bucket for storing test evidence (screenshots, logs, and reports) in the AI-Powered Automated Testing Platform. The bucket implements tenant-specific folder structures to ensure data isolation and security.

## Bucket Purpose

The S3 bucket stores:
- **Screenshots**: Captured during test execution at each step
- **Logs**: Execution logs in JSON format
- **Reports**: Generated test reports

## Folder Structure

```
s3://ai-testing-evidence-{environment}-{account-id}/
├── {tenantId}/
│   ├── screenshots/
│   │   ├── {resultId}/
│   │   │   ├── step-1-{timestamp}.png
│   │   │   ├── step-2-{timestamp}.png
│   │   │   └── failure-{timestamp}.png
│   ├── logs/
│   │   ├── {resultId}/
│   │   │   └── execution-log.json
│   └── reports/
│       ├── {reportId}.json
```

### Folder Naming Conventions

- **tenantId**: UUID identifying the tenant (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- **resultId**: UUID identifying the test execution result
- **reportId**: UUID identifying the generated report
- **timestamp**: Unix timestamp in milliseconds

## Security Configuration

### Encryption
- **Encryption at Rest**: SSE-S3 (Server-Side Encryption with S3-Managed Keys)
- All objects are automatically encrypted when stored

### Access Control
- **Block Public Access**: All public access is blocked
- **IAM-Based Access**: Only authorized Lambda functions can access the bucket
- **Tenant Isolation**: Enforced through IAM policies and application logic

### Versioning
- Versioning is disabled to reduce storage costs
- Objects are immutable once created

## Lifecycle Policies

### Archive Policy
- **Rule**: archive-old-evidence
- **Action**: Transition to Glacier storage class after 90 days
- **Purpose**: Reduce storage costs for older evidence

### Deletion Policy
- **Rule**: delete-very-old-evidence
- **Action**: Delete objects after 365 days
- **Purpose**: Comply with data retention policies

## CORS Configuration

CORS is configured to allow frontend applications to access presigned URLs:

```json
{
  "AllowedMethods": ["GET", "PUT"],
  "AllowedOrigins": ["*"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}
```

**Note**: In production, restrict `AllowedOrigins` to your actual frontend domains.

## Manual Setup

### Prerequisites
- AWS CLI installed and configured
- Appropriate IAM permissions to create S3 buckets
- AWS account ID

### Using AWS CLI Script

Run the provided script to create the bucket:

```bash
cd infrastructure/scripts
chmod +x create-s3-bucket.sh
./create-s3-bucket.sh <environment> <aws-account-id>
```

**Example**:
```bash
./create-s3-bucket.sh dev 123456789012
```

### Supported Environments
- `dev`: Development environment
- `staging`: Staging environment
- `prod`: Production environment

## CDK Deployment

The bucket is automatically created when deploying the infrastructure using AWS CDK:

```bash
cd infrastructure
npm install
cdk deploy --all
```

The CDK stack (`S3Stack`) is defined in `infrastructure/lib/stacks/s3-stack.ts`.

## Accessing Evidence

### Presigned URLs

Lambda functions generate presigned URLs for secure, temporary access to evidence:

```typescript
const presignedUrl = await s3Client.getSignedUrl('getObject', {
  Bucket: bucketName,
  Key: `${tenantId}/screenshots/${resultId}/step-1.png`,
  Expires: 3600 // 1 hour
});
```

### URL Expiration
- Presigned URLs expire after 1 hour
- Users must request new URLs after expiration

## Tenant Isolation

### Application-Level Enforcement
- All S3 operations include tenantId from JWT token
- Lambda functions validate tenantId before generating presigned URLs
- Users can only access evidence belonging to their tenant

### IAM Policy Example

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::ai-testing-evidence-*/${aws:PrincipalTag/tenantId}/*"
    }
  ]
}
```

## Monitoring

### CloudWatch Metrics
- **BucketSizeBytes**: Total bucket size
- **NumberOfObjects**: Total object count
- **AllRequests**: Total request count

### CloudWatch Alarms
- Alert when bucket size exceeds threshold
- Alert on high error rates

## Cost Optimization

### Storage Classes
- **Standard**: Active evidence (0-90 days)
- **Glacier**: Archived evidence (90-365 days)
- **Deleted**: Evidence older than 365 days

### Estimated Costs
- Standard storage: $0.023 per GB/month
- Glacier storage: $0.004 per GB/month
- PUT requests: $0.005 per 1,000 requests
- GET requests: $0.0004 per 1,000 requests

## Troubleshooting

### Bucket Already Exists
If the bucket name is already taken, modify the bucket name in the script or CDK stack.

### Access Denied Errors
Verify that:
1. Lambda execution roles have appropriate S3 permissions
2. Bucket policies allow access from Lambda functions
3. TenantId in the request matches the S3 key prefix

### Lifecycle Policy Not Working
- Verify lifecycle rules are enabled
- Check that objects have appropriate timestamps
- Allow 24-48 hours for lifecycle transitions to take effect

## Best Practices

1. **Always use presigned URLs** for client access to evidence
2. **Never expose bucket name** or keys directly to clients
3. **Validate tenantId** before all S3 operations
4. **Use structured logging** for all S3 operations
5. **Monitor bucket size** and set up cost alerts
6. **Test lifecycle policies** in dev environment first
7. **Implement retry logic** for S3 operations
8. **Use multipart upload** for large files (>5MB)

## References

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [S3 Lifecycle Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html)
- [S3 Encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html)
