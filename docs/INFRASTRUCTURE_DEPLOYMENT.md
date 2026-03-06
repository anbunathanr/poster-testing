# Infrastructure Deployment Guide

This guide provides step-by-step instructions for deploying the AI Testing Platform infrastructure using AWS CDK.

## Prerequisites

### Required Tools

1. **Node.js 18.x or later**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

2. **AWS CLI**
   ```bash
   aws --version
   aws configure  # Set up your AWS credentials
   ```

3. **AWS CDK CLI**
   ```bash
   npm install -g aws-cdk
   cdk --version
   ```

### AWS Account Setup

1. **IAM Permissions**: Ensure your AWS user/role has permissions to:
   - Create CloudFormation stacks
   - Create/manage DynamoDB tables
   - Create/manage S3 buckets
   - Create/manage Lambda functions
   - Create/manage API Gateway
   - Create/manage IAM roles and policies
   - Create/manage CloudWatch resources
   - Create/manage SNS topics

2. **AWS Region**: Choose your deployment region (default: us-east-1)

## Initial Setup

### 1. Install Dependencies

```bash
# Install project dependencies
npm install

# Verify CDK installation
cd infrastructure
npm install
```

### 2. Bootstrap CDK

Bootstrap CDK in your AWS account (one-time per account/region):

```bash
cdk bootstrap aws://YOUR-ACCOUNT-ID/YOUR-REGION
```

Example:
```bash
cdk bootstrap aws://123456789012/us-east-1
```

### 3. Build Lambda Code

Before deploying, build the Lambda function code:

```bash
# From project root
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Deployment Environments

The infrastructure supports three environments:
- **dev**: Development environment
- **staging**: Pre-production environment
- **prod**: Production environment

Each environment creates separate resources with environment-specific naming.

## Deployment Steps

### Development Environment

1. **Synthesize CloudFormation Template** (optional, for review):
   ```bash
   npm run cdk:synth
   ```

2. **Preview Changes**:
   ```bash
   npm run cdk:diff
   ```

3. **Deploy**:
   ```bash
   npm run cdk:deploy:dev
   ```

   Or with email notifications:
   ```bash
   cd infrastructure
   cdk deploy \
     --context environment=dev \
     --context notificationEmail=your-email@example.com \
     --context alarmEmail=admin@example.com
   ```

4. **Confirm Deployment**:
   - Review the changes shown in the terminal
   - Type 'y' to confirm deployment
   - Wait for deployment to complete (5-10 minutes)

5. **Note the Outputs**:
   After deployment, CDK will output important values:
   ```
   Outputs:
   AiTestingPlatform-dev.ApiEndpoint = https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/
   AiTestingPlatform-dev.EvidenceBucketName = ai-testing-evidence-dev-123456789012
   AiTestingPlatform-dev.NotificationTopicArn = arn:aws:sns:us-east-1:123456789012:...
   ```

### Staging Environment

```bash
npm run cdk:deploy:staging
```

### Production Environment

Production deployment requires manual approval for security changes:

```bash
npm run cdk:deploy:prod
```

## Post-Deployment Configuration

### 1. Confirm SNS Email Subscriptions

If you provided email addresses during deployment:
1. Check your email inbox
2. Click the confirmation link in the SNS subscription email
3. Verify subscription is active in AWS Console

### 2. Update JWT Secret

The default JWT secret should be changed in production:

1. Create a secret in AWS Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name ai-testing-jwt-secret-prod \
     --secret-string "your-secure-random-secret"
   ```

2. Update Lambda environment variables to reference the secret

### 3. Configure Environment Settings

Create initial environment configurations in DynamoDB:

```bash
# Example: Add DEV environment configuration
aws dynamodb put-item \
  --table-name ai-testing-environments-dev \
  --item '{
    "tenantId": {"S": "default-tenant"},
    "environment": {"S": "DEV"},
    "baseUrl": {"S": "https://dev.example.com"},
    "configuration": {"M": {}},
    "createdAt": {"N": "1707753600000"},
    "updatedAt": {"N": "1707753600000"}
  }'
```

### 4. Test API Endpoints

Test the deployed API:

```bash
# Get API endpoint from CDK outputs
API_ENDPOINT="https://xxxxx.execute-api.us-east-1.amazonaws.com/dev"

# Test health/registration endpoint
curl -X POST $API_ENDPOINT/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "tenantId": "default-tenant"
  }'
```

## Updating Infrastructure

### Making Changes

1. Modify CDK code in `infrastructure/lib/`
2. Review changes:
   ```bash
   npm run cdk:diff
   ```
3. Deploy updates:
   ```bash
   npm run cdk:deploy:dev
   ```

### Rolling Back

If deployment fails or issues occur:

1. **Rollback via CloudFormation**:
   - Go to AWS CloudFormation Console
   - Select the stack
   - Choose "Stack actions" > "Roll back"

2. **Redeploy Previous Version**:
   ```bash
   git checkout <previous-commit>
   npm run cdk:deploy:dev
   ```

## Monitoring Deployment

### CloudFormation Console

1. Go to AWS CloudFormation Console
2. Find stack: `AiTestingPlatform-{environment}`
3. Monitor "Events" tab for deployment progress
4. Check "Resources" tab for created resources

### CDK Output

Watch the terminal output during deployment:
- Green checkmarks indicate successful resource creation
- Red errors indicate failures
- Yellow warnings indicate potential issues

## Troubleshooting

### Common Issues

#### 1. Bootstrap Error

**Error**: "This stack uses assets, so the toolkit stack must be deployed"

**Solution**:
```bash
cdk bootstrap aws://YOUR-ACCOUNT-ID/YOUR-REGION
```

#### 2. Insufficient Permissions

**Error**: "User is not authorized to perform: cloudformation:CreateStack"

**Solution**: Ensure your IAM user/role has necessary permissions

#### 3. Resource Already Exists

**Error**: "Resource already exists"

**Solution**: 
- Check if resources from previous deployment exist
- Use different environment name
- Delete existing resources manually

#### 4. Lambda Code Not Found

**Error**: "Cannot find asset at path: dist/lambdas/..."

**Solution**:
```bash
npm run build  # Build Lambda code first
```

#### 5. Stack Rollback

**Error**: Stack creation failed and rolled back

**Solution**:
1. Check CloudFormation events for specific error
2. Fix the issue in CDK code
3. Delete the failed stack:
   ```bash
   cdk destroy --context environment=dev
   ```
4. Redeploy

### Viewing Logs

#### CloudFormation Logs
```bash
aws cloudformation describe-stack-events \
  --stack-name AiTestingPlatform-dev \
  --max-items 20
```

#### Lambda Logs
```bash
aws logs tail /aws/lambda/ai-testing-auth-dev --follow
```

## Cleanup

### Remove Development Environment

```bash
npm run cdk:destroy:dev
```

**Warning**: This will delete:
- All DynamoDB tables and data
- S3 bucket and all evidence (if autoDeleteObjects is enabled)
- All Lambda functions
- API Gateway
- CloudWatch logs and dashboards

### Remove Specific Resources

To keep some resources while removing others, modify the CDK code to set appropriate `removalPolicy` values.

## Cost Estimation

### Development Environment (Low Usage)

- DynamoDB: ~$1-5/month (on-demand)
- Lambda: ~$5-10/month (1M requests)
- S3: ~$1-3/month (10GB storage)
- API Gateway: ~$3-5/month (1M requests)
- CloudWatch: ~$2-5/month (logs and metrics)

**Total**: ~$12-28/month

### Production Environment (Moderate Usage)

- DynamoDB: ~$50-100/month
- Lambda: ~$50-100/month
- S3: ~$10-20/month
- API Gateway: ~$30-50/month
- CloudWatch: ~$10-20/month

**Total**: ~$150-290/month

Use AWS Cost Explorer and set up budgets to monitor actual costs.

## Security Best Practices

### Before Production Deployment

1. **Review IAM Policies**: Ensure least privilege access
2. **Enable CloudTrail**: For audit logging
3. **Configure VPC**: Deploy Lambda in VPC if needed
4. **Restrict CORS**: Update API Gateway CORS to specific domains
5. **Enable WAF**: Add AWS WAF for API protection
6. **Secrets Management**: Move all secrets to AWS Secrets Manager
7. **Enable MFA**: For AWS account access
8. **Set Up Backups**: Configure DynamoDB point-in-time recovery

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'infrastructure/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm run cdk:deploy:staging
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Next Steps

After successful deployment:

1. ✅ Verify all resources in AWS Console
2. ✅ Test API endpoints
3. ✅ Configure monitoring alerts
4. ✅ Set up CI/CD pipeline
5. ✅ Document API for frontend team
6. ✅ Create test data in DynamoDB
7. ✅ Perform security review
8. ✅ Set up backup procedures

## Support Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)
- [Project README](../README.md)
- [Infrastructure README](../infrastructure/README.md)
