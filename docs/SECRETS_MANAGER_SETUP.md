# AWS Secrets Manager Setup Guide

This guide provides instructions for configuring AWS Secrets Manager to securely store and manage sensitive credentials for the AI-Powered Automated Testing Platform.

## Overview

AWS Secrets Manager is used to store and manage sensitive credentials including:

- **JWT Secret Key** - Used for signing and verifying authentication tokens
- **Environment-Specific Credentials** - Target application credentials for test execution
- **Database Connection Strings** - If using external databases
- **Third-Party API Keys** - External service integrations

All secrets are encrypted at rest using AWS KMS and can be automatically rotated to enhance security.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Secret Structure](#secret-structure)
3. [Deployment Options](#deployment-options)
4. [IAM Permissions](#iam-permissions)
5. [Secret Rotation](#secret-rotation)
6. [Accessing Secrets from Lambda](#accessing-secrets-from-lambda)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- AWS CLI installed and configured
- IAM permissions to create and manage secrets
- AWS account with Secrets Manager enabled
- KMS key for encryption (optional, uses default if not specified)

---

## Secret Structure

### 1. JWT Secret Key

**Secret Name**: `ai-testing/jwt-secret`

**Purpose**: Sign and verify JWT tokens for user authentication

**Format**: String

**Example Value**:
```
your-super-secure-random-jwt-secret-key-min-32-chars
```

**Used By**:
- Auth Lambda (token generation)
- API Gateway Lambda Authorizer (token validation)

**Rotation**: Recommended every 90 days

---

### 2. Environment Credentials

**Secret Name Pattern**: `ai-testing/env/{environment}/{tenant-id}`

**Purpose**: Store target application credentials for test execution

**Format**: JSON

**Example Value**:
```json
{
  "baseUrl": "https://dev.example.com",
  "username": "test-user@example.com",
  "password": "test-password-123",
  "apiKey": "dev-api-key-xyz",
  "additionalConfig": {
    "timeout": 30000,
    "retries": 3
  }
}
```

**Used By**:
- Test Execution Lambda (accessing target applications)
- Test Generation Lambda (environment-specific configuration)

**Rotation**: Recommended every 30-60 days

---

### 3. Database Connection Strings

**Secret Name**: `ai-testing/database/connection`

**Purpose**: Store database credentials if using external databases (optional)

**Format**: JSON

**Example Value**:
```json
{
  "host": "database.example.com",
  "port": 5432,
  "database": "ai_testing",
  "username": "db_user",
  "password": "db_password_secure",
  "ssl": true
}
```

**Used By**:
- Storage Lambda (if using external database)

**Rotation**: Recommended every 90 days

---

### 4. Third-Party API Keys

**Secret Name Pattern**: `ai-testing/api-keys/{service-name}`

**Purpose**: Store API keys for external services (e.g., n8n, monitoring tools)

**Format**: JSON

**Example Value**:
```json
{
  "apiKey": "service-api-key-xyz",
  "apiSecret": "service-api-secret-abc",
  "webhookUrl": "https://webhook.example.com/notify"
}
```

**Used By**:
- Notification Service (n8n integration)
- Monitoring services

**Rotation**: As required by service provider

---

## Deployment Options

### Option 1: AWS CLI Script (Recommended)

Use the provided script to create all required secrets:

```bash
cd infrastructure/scripts
chmod +x setup-secrets-manager.sh
./setup-secrets-manager.sh <environment>
```

Replace `<environment>` with: `dev`, `staging`, or `prod`

Example:
```bash
./setup-secrets-manager.sh dev
```

The script will:
1. Create all required secrets
2. Set initial placeholder values
3. Configure encryption settings
4. Set up tags for organization
5. Display secret ARNs for reference

---

### Option 2: AWS Console

#### Create JWT Secret

1. Navigate to AWS Secrets Manager console
2. Click "Store a new secret"
3. Select "Other type of secret"
4. Choose "Plaintext" tab
5. Enter your JWT secret key (minimum 32 characters)
6. Click "Next"
7. Secret name: `ai-testing/jwt-secret`
8. Description: "JWT secret key for token signing and verification"
9. Configure automatic rotation (optional)
10. Click "Next" and "Store"

#### Create Environment Credentials

1. Click "Store a new secret"
2. Select "Other type of secret"
3. Choose "Plaintext" tab
4. Enter JSON configuration (see format above)
5. Secret name: `ai-testing/env/dev/default` (adjust for environment)
6. Description: "Development environment credentials"
7. Click "Next" and "Store"

---

### Option 3: AWS CDK

Secrets are defined in the CDK infrastructure code. To deploy:

```bash
cd infrastructure
npm install
cdk deploy --all
```

The CDK stack will create secrets with placeholder values that you must update manually.

---

## IAM Permissions

### Lambda Functions Accessing Secrets

Each Lambda function that needs to access secrets requires the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:ai-testing/*"
      ]
    },
    {
      "Sid": "KMSDecrypt",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:*:*:key/*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.*.amazonaws.com"
        }
      }
    }
  ]
}
```

### Required Permissions by Lambda Function

| Lambda Function | Secrets Required |
|----------------|------------------|
| Auth Lambda | `ai-testing/jwt-secret` |
| API Gateway Authorizer | `ai-testing/jwt-secret` |
| Test Generation Lambda | `ai-testing/env/*` |
| Test Execution Lambda | `ai-testing/env/*`, `ai-testing/api-keys/*` |
| Storage Lambda | `ai-testing/database/*` (if applicable) |

---

## Secret Rotation

### Automatic Rotation

AWS Secrets Manager supports automatic rotation for enhanced security.

#### Enable Rotation for JWT Secret

```bash
# Create rotation Lambda function first (see AWS documentation)
# Then enable rotation:

aws secretsmanager rotate-secret \
  --secret-id ai-testing/jwt-secret \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:SecretsManagerRotation \
  --rotation-rules AutomaticallyAfterDays=90
```

#### Rotation Strategy

1. **JWT Secret Rotation**:
   - Generate new secret
   - Update secret in Secrets Manager
   - Deploy new secret to all Lambda functions
   - Maintain old secret for grace period (24 hours)
   - Remove old secret after grace period

2. **Environment Credentials Rotation**:
   - Coordinate with target application administrators
   - Update credentials in target system
   - Update secret in Secrets Manager
   - Test with new credentials
   - Monitor for authentication failures

### Manual Rotation

To manually update a secret:

```bash
# Update JWT secret
aws secretsmanager update-secret \
  --secret-id ai-testing/jwt-secret \
  --secret-string "new-jwt-secret-key-here"

# Update environment credentials
aws secretsmanager update-secret \
  --secret-id ai-testing/env/dev/default \
  --secret-string '{
    "baseUrl": "https://dev.example.com",
    "username": "new-user@example.com",
    "password": "new-password-123"
  }'
```

---

## Accessing Secrets from Lambda

### Node.js Example

```javascript
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getSecret(secretName) {
  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName
    });
    
    const response = await client.send(command);
    
    // Parse JSON secrets
    if (response.SecretString) {
      return JSON.parse(response.SecretString);
    }
    
    // Handle binary secrets
    if (response.SecretBinary) {
      return Buffer.from(response.SecretBinary, 'base64').toString('ascii');
    }
  } catch (error) {
    console.error('Error retrieving secret:', error);
    throw error;
  }
}

// Usage in Auth Lambda
async function getJwtSecret() {
  const secret = await getSecret('ai-testing/jwt-secret');
  return secret; // Returns string
}

// Usage in Test Execution Lambda
async function getEnvironmentCredentials(environment, tenantId) {
  const secretName = `ai-testing/env/${environment}/${tenantId}`;
  const credentials = await getSecret(secretName);
  return credentials; // Returns JSON object
}
```

### Caching Secrets

To improve performance and reduce API calls, cache secrets in Lambda:

```javascript
let cachedSecret = null;
let cacheExpiry = null;
const CACHE_TTL = 300000; // 5 minutes

async function getCachedSecret(secretName) {
  const now = Date.now();
  
  if (cachedSecret && cacheExpiry && now < cacheExpiry) {
    return cachedSecret;
  }
  
  cachedSecret = await getSecret(secretName);
  cacheExpiry = now + CACHE_TTL;
  
  return cachedSecret;
}
```

### Error Handling

```javascript
async function getSecretWithRetry(secretName, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getSecret(secretName);
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        throw new Error(`Secret not found: ${secretName}`);
      }
      
      if (error.name === 'AccessDeniedException') {
        throw new Error(`Access denied to secret: ${secretName}`);
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

---

## Security Best Practices

### 1. Use Least Privilege Access

- Grant Lambda functions access only to secrets they need
- Use resource-based policies to restrict access
- Avoid wildcard permissions in IAM policies

### 2. Enable Encryption

- Use AWS KMS customer-managed keys for additional control
- Enable encryption at rest (enabled by default)
- Rotate KMS keys regularly

### 3. Enable Audit Logging

```bash
# Enable CloudTrail for Secrets Manager API calls
aws cloudtrail create-trail \
  --name secrets-manager-audit \
  --s3-bucket-name audit-logs-bucket

aws cloudtrail start-logging \
  --name secrets-manager-audit
```

### 4. Monitor Secret Access

Set up CloudWatch alarms for:
- Unauthorized access attempts
- Unusual access patterns
- Failed secret retrievals

```bash
# Create CloudWatch alarm for failed secret access
aws cloudwatch put-metric-alarm \
  --alarm-name secrets-manager-access-denied \
  --alarm-description "Alert on Secrets Manager access denied" \
  --metric-name AccessDenied \
  --namespace AWS/SecretsManager \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

### 5. Implement Secret Rotation

- Rotate JWT secrets every 90 days
- Rotate environment credentials every 30-60 days
- Automate rotation where possible
- Test rotation process in non-production environments

### 6. Use Tags for Organization

```bash
aws secretsmanager tag-resource \
  --secret-id ai-testing/jwt-secret \
  --tags Key=Environment,Value=production \
         Key=Application,Value=ai-testing-platform \
         Key=ManagedBy,Value=terraform
```

### 7. Implement Secret Versioning

- Secrets Manager automatically versions secrets
- Use version stages (AWSCURRENT, AWSPREVIOUS)
- Maintain previous versions for rollback

### 8. Restrict Network Access

- Use VPC endpoints for Secrets Manager
- Restrict Lambda functions to private subnets
- Use security groups to control access

---

## Troubleshooting

### Issue: "ResourceNotFoundException"

**Cause**: Secret does not exist or name is incorrect

**Solution**:
```bash
# List all secrets
aws secretsmanager list-secrets

# Verify secret name
aws secretsmanager describe-secret --secret-id ai-testing/jwt-secret
```

---

### Issue: "AccessDeniedException"

**Cause**: Lambda function lacks IAM permissions

**Solution**:
1. Check Lambda execution role has `secretsmanager:GetSecretValue` permission
2. Verify resource ARN in IAM policy matches secret ARN
3. Check KMS key policy allows Lambda role to decrypt

```bash
# Test IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/lambda-role \
  --action-names secretsmanager:GetSecretValue \
  --resource-arns arn:aws:secretsmanager:us-east-1:123456789012:secret:ai-testing/jwt-secret
```

---

### Issue: "DecryptionFailure"

**Cause**: KMS key permissions issue

**Solution**:
1. Verify Lambda execution role has `kms:Decrypt` permission
2. Check KMS key policy allows the role
3. Ensure KMS key is in the same region

```bash
# Check KMS key policy
aws kms get-key-policy \
  --key-id <key-id> \
  --policy-name default
```

---

### Issue: Slow Lambda Cold Starts

**Cause**: Retrieving secrets on every invocation

**Solution**:
- Implement secret caching (see example above)
- Use Lambda environment variables for non-sensitive config
- Consider using Lambda extensions for secret caching

---

### Issue: Secret Rotation Failures

**Cause**: Rotation Lambda function errors or permissions issues

**Solution**:
1. Check rotation Lambda CloudWatch logs
2. Verify rotation Lambda has required permissions
3. Test rotation function manually
4. Ensure grace period is sufficient

```bash
# Check rotation status
aws secretsmanager describe-secret \
  --secret-id ai-testing/jwt-secret \
  --query 'RotationEnabled'

# View rotation configuration
aws secretsmanager describe-secret \
  --secret-id ai-testing/jwt-secret \
  --query 'RotationRules'
```

---

## Cost Optimization

### Secrets Manager Pricing

- **Secret Storage**: $0.40 per secret per month
- **API Calls**: $0.05 per 10,000 API calls

### Cost Reduction Strategies

1. **Cache Secrets**: Reduce API calls by caching in Lambda
2. **Consolidate Secrets**: Store related credentials in single JSON secret
3. **Use Environment Variables**: For non-sensitive configuration
4. **Monitor Usage**: Review CloudWatch metrics for optimization opportunities

### Example Cost Calculation

For a typical deployment:
- 5 secrets × $0.40 = $2.00/month
- 100,000 API calls × $0.05/10,000 = $0.50/month
- **Total**: ~$2.50/month

---

## Monitoring and Alerts

### CloudWatch Metrics

Monitor these key metrics:
- `GetSecretValue` - Number of secret retrievals
- `PutSecretValue` - Number of secret updates
- `RotateSecret` - Number of rotation attempts

### CloudWatch Logs

Enable logging for:
- Secret access patterns
- Rotation events
- Access denied attempts

### Recommended Alarms

```bash
# High secret access rate
aws cloudwatch put-metric-alarm \
  --alarm-name high-secret-access \
  --metric-name GetSecretValue \
  --namespace AWS/SecretsManager \
  --statistic Sum \
  --period 300 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold

# Rotation failures
aws cloudwatch put-metric-alarm \
  --alarm-name secret-rotation-failure \
  --metric-name RotationFailed \
  --namespace AWS/SecretsManager \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold
```

---

## Integration with Other Services

### DynamoDB

Store secret ARNs in DynamoDB for dynamic secret retrieval:

```javascript
// Store secret reference in DynamoDB
await dynamodb.putItem({
  TableName: 'ai-testing-environments',
  Item: {
    tenantId: 'tenant-123',
    environment: 'DEV',
    secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:ai-testing/env/dev/tenant-123'
  }
});

// Retrieve and use secret
const envConfig = await dynamodb.getItem({
  TableName: 'ai-testing-environments',
  Key: { tenantId: 'tenant-123', environment: 'DEV' }
});

const credentials = await getSecret(envConfig.Item.secretArn);
```

### Lambda Layers

Create a Lambda layer for shared secret retrieval logic:

```javascript
// /opt/nodejs/secrets-helper.js
module.exports = {
  getSecret: async (secretName) => {
    // Shared secret retrieval logic
  },
  getCachedSecret: async (secretName) => {
    // Shared caching logic
  }
};
```

---

## Migration from Environment Variables

If migrating from environment variables to Secrets Manager:

1. **Identify Secrets**: List all sensitive environment variables
2. **Create Secrets**: Store each in Secrets Manager
3. **Update Code**: Replace `process.env.SECRET` with `getSecret()` calls
4. **Test**: Verify functionality in dev environment
5. **Deploy**: Roll out to staging, then production
6. **Clean Up**: Remove environment variables after verification

---

## Additional Resources

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [AWS SDK for JavaScript v3 - Secrets Manager](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-secrets-manager/)
- [Rotating AWS Secrets Manager Secrets](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)

---

## Next Steps

After completing Secrets Manager setup:

1. ✅ Update Lambda function code to retrieve secrets
2. ✅ Update IAM roles with Secrets Manager permissions
3. ✅ Test secret retrieval in dev environment
4. ✅ Implement secret rotation policies
5. ✅ Set up CloudWatch monitoring and alarms
6. ✅ Document secret names and purposes for team reference

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: AI Testing Platform Team
