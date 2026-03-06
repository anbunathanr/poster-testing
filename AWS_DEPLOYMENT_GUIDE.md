# AWS Deployment Guide

Complete step-by-step guide to deploy the AI Testing Automation Platform to AWS.

## Prerequisites

Before deploying, ensure you have:

- ✅ AWS Account with admin access
- ✅ AWS CLI installed and configured
- ✅ Node.js 18.x or later
- ✅ AWS CDK CLI installed globally
- ✅ Project built successfully (`npm run build`)

## Quick Start (5 Steps)

### Step 1: Configure AWS Credentials

```powershell
# Configure AWS CLI with your credentials
aws configure

# You'll be prompted for:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., us-east-1)
# - Default output format (json)
```

### Step 2: Install AWS CDK

```powershell
# Install AWS CDK globally
npm install -g aws-cdk

# Verify installation
cdk --version
```

### Step 3: Bootstrap AWS CDK (First Time Only)

```powershell
# Bootstrap CDK in your AWS account
# This creates necessary resources for CDK deployments
cd infrastructure
cdk bootstrap
```

### Step 4: Set Environment Variables

Create a `.env` file in the project root:

```env
# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long

# AWS Region
AWS_REGION=us-east-1

# Environment
ENVIRONMENT=dev
```

**Generate a secure JWT secret:**
```powershell
# PowerShell command to generate a random secret
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### Step 5: Deploy to AWS

```powershell
# Deploy to Dev environment
cd infrastructure
npm run cdk:deploy:dev

# Or deploy to Staging
npm run cdk:deploy:staging

# Or deploy to Production (requires approval)
npm run cdk:deploy:prod
```

## Detailed Deployment Steps

### 1. AWS Account Setup

#### Create IAM User for Deployment

1. Go to AWS Console → IAM → Users
2. Click "Add User"
3. User name: `ai-testing-deployer`
4. Select "Programmatic access"
5. Attach policies:
   - `AdministratorAccess` (for initial setup)
   - Or create custom policy with required permissions
6. Save Access Key ID and Secret Access Key

#### Configure AWS CLI

```powershell
aws configure --profile ai-testing
# Enter your Access Key ID
# Enter your Secret Access Key
# Region: us-east-1 (or your preferred region)
# Output: json
```

### 2. Infrastructure Deployment

#### Review Infrastructure Code

The infrastructure is defined in `infrastructure/lib/`:
- `ai-testing-platform-stack.ts` - Main stack
- `stacks/dynamodb-stack.ts` - DynamoDB tables
- `stacks/s3-stack.ts` - S3 buckets
- `stacks/lambda-stack.ts` - Lambda functions
- `stacks/api-gateway-stack.ts` - API Gateway
- `stacks/monitoring-stack.ts` - CloudWatch
- `stacks/notification-stack.ts` - SNS topics

#### Synthesize CloudFormation Template

```powershell
cd infrastructure
cdk synth
```

This generates CloudFormation templates in `cdk.out/`.

#### Deploy Infrastructure

```powershell
# Deploy to Dev
cdk deploy --context environment=dev

# Deploy to Staging
cdk deploy --context environment=staging

# Deploy to Production (with approval)
cdk deploy --context environment=prod --require-approval broadening
```

#### Monitor Deployment

The deployment will:
1. Create DynamoDB tables (Users, Tests, TestResults, Environments)
2. Create S3 bucket for test evidence
3. Deploy Lambda functions (Auth, TestGen, TestExec, Storage, Report)
4. Create API Gateway with endpoints
5. Set up CloudWatch logs and metrics
6. Create SNS topics for notifications
7. Configure IAM roles and policies

### 3. Post-Deployment Configuration

#### Get API Gateway URL

```powershell
# Get the API Gateway URL from CDK output
aws cloudformation describe-stacks \
  --stack-name AiTestingPlatformStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

#### Configure Secrets Manager

```powershell
# Store JWT secret in Secrets Manager
aws secretsmanager create-secret \
  --name ai-testing/jwt-secret \
  --secret-string "your-super-secret-jwt-key-min-32-characters-long"

# Store Bedrock API configuration (if needed)
aws secretsmanager create-secret \
  --name ai-testing/bedrock-config \
  --secret-string '{"region":"us-east-1","model":"anthropic.claude-3-5-sonnet-20240620-v1:0"}'
```

#### Enable Bedrock Access

1. Go to AWS Console → Bedrock
2. Navigate to "Model access"
3. Request access to Claude 3.5 Sonnet
4. Wait for approval (usually instant)

#### Configure SNS Email Subscriptions

```powershell
# Subscribe your email to test notifications
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:YOUR_ACCOUNT_ID:ai-testing-notifications-dev \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription via email
```

### 4. Verify Deployment

#### Test Authentication Endpoint

```powershell
# Register a test user
$API_URL = "https://your-api-id.execute-api.us-east-1.amazonaws.com/prod"

curl -X POST "$API_URL/auth/register" `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "tenantId": "test-tenant"
  }'
```

#### Test Login

```powershell
# Login and get JWT token
curl -X POST "$API_URL/auth/login" `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# Save the token from the response
$TOKEN = "eyJhbGciOiJIUzI1NiIs..."
```

#### Test Test Generation (Requires Bedrock Access)

```powershell
# Generate a test
curl -X POST "$API_URL/tests/generate" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d '{
    "testPrompt": "Test login with valid credentials",
    "environment": "DEV"
  }'
```

### 5. Monitoring and Logs

#### View CloudWatch Logs

```powershell
# List log groups
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/ai-testing

# View recent logs for Auth Lambda
aws logs tail /aws/lambda/ai-testing-auth-dev --follow
```

#### View CloudWatch Metrics

1. Go to AWS Console → CloudWatch → Dashboards
2. Open "AiTestingPlatform-dev" dashboard
3. View metrics:
   - Test execution duration
   - Success/failure rates
   - API latency
   - Lambda invocations

#### Set Up Alarms

Alarms are automatically created for:
- Test execution failure rate > 20%
- Lambda error rate > 5%
- API Gateway 5xx errors > 10
- DynamoDB throttling events

### 6. Cost Optimization

#### Estimated Monthly Costs (Dev Environment)

- **DynamoDB**: $5-10 (on-demand pricing)
- **Lambda**: $10-20 (based on usage)
- **S3**: $1-5 (for test evidence storage)
- **API Gateway**: $3-10 (per million requests)
- **CloudWatch**: $5-10 (logs and metrics)
- **Bedrock**: $0.003 per 1K input tokens, $0.015 per 1K output tokens

**Total**: ~$25-60/month for light usage

#### Cost Reduction Tips

1. **Enable S3 Lifecycle Policies**:
   ```powershell
   # Already configured in infrastructure
   # Archives evidence to Glacier after 90 days
   # Deletes after 365 days
   ```

2. **Use Reserved Capacity** (for production):
   - DynamoDB reserved capacity (40-60% savings)
   - Lambda provisioned concurrency (if needed)

3. **Monitor Usage**:
   ```powershell
   # View cost and usage
   aws ce get-cost-and-usage \
     --time-period Start=2024-01-01,End=2024-01-31 \
     --granularity MONTHLY \
     --metrics BlendedCost
   ```

## Environment-Specific Configurations

### Development Environment

```typescript
// config/dev.json
{
  "environment": "dev",
  "aws": {
    "region": "us-east-1"
  },
  "dynamodb": {
    "usersTable": "ai-testing-users-dev",
    "testsTable": "ai-testing-tests-dev",
    "resultsTable": "ai-testing-results-dev",
    "environmentsTable": "ai-testing-environments-dev"
  },
  "s3": {
    "evidenceBucket": "ai-testing-evidence-dev"
  }
}
```

### Staging Environment

```typescript
// config/staging.json
{
  "environment": "staging",
  "aws": {
    "region": "us-east-1"
  },
  "dynamodb": {
    "usersTable": "ai-testing-users-staging",
    "testsTable": "ai-testing-tests-staging",
    "resultsTable": "ai-testing-results-staging",
    "environmentsTable": "ai-testing-environments-staging"
  },
  "s3": {
    "evidenceBucket": "ai-testing-evidence-staging"
  }
}
```

### Production Environment

```typescript
// config/prod.json
{
  "environment": "prod",
  "aws": {
    "region": "us-east-1"
  },
  "dynamodb": {
    "usersTable": "ai-testing-users-prod",
    "testsTable": "ai-testing-tests-prod",
    "resultsTable": "ai-testing-results-prod",
    "environmentsTable": "ai-testing-environments-prod"
  },
  "s3": {
    "evidenceBucket": "ai-testing-evidence-prod"
  },
  "lambda": {
    "reservedConcurrency": 100
  }
}
```

## CI/CD Integration

### GitHub Actions Deployment

The project includes a GitHub Actions workflow (`.github/workflows/ci-cd.yml`) that automatically deploys on push to specific branches.

#### Setup GitHub Secrets

1. Go to GitHub Repository → Settings → Secrets
2. Add the following secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `JWT_SECRET`

#### Branch Strategy

- `main` → Deploys to Production
- `staging` → Deploys to Staging
- `develop` → Deploys to Dev

#### Manual Deployment Trigger

```powershell
# Trigger deployment via GitHub CLI
gh workflow run ci-cd.yml --ref main
```

## Troubleshooting

### Common Issues

#### 1. CDK Bootstrap Failed

**Error**: `This stack uses assets, so the toolkit stack must be deployed`

**Solution**:
```powershell
cdk bootstrap aws://ACCOUNT-ID/REGION
```

#### 2. Lambda Timeout

**Error**: `Task timed out after 30.00 seconds`

**Solution**: Increase timeout in `infrastructure/lib/stacks/lambda-stack.ts`:
```typescript
timeout: Duration.seconds(300) // 5 minutes
```

#### 3. Bedrock Access Denied

**Error**: `AccessDeniedException: You don't have access to the model`

**Solution**:
1. Go to AWS Console → Bedrock → Model access
2. Request access to Claude 3.5 Sonnet
3. Wait for approval

#### 4. DynamoDB Throttling

**Error**: `ProvisionedThroughputExceededException`

**Solution**: Already using on-demand capacity mode. If still occurring, check for hot partitions.

#### 5. S3 Access Denied

**Error**: `Access Denied` when uploading to S3

**Solution**: Check IAM role permissions in `infrastructure/iam-policies/`.

### Viewing Logs

```powershell
# View Lambda logs
aws logs tail /aws/lambda/ai-testing-auth-dev --follow

# View API Gateway logs
aws logs tail /aws/apigateway/ai-testing-api-dev --follow

# View all logs
aws logs tail --follow --filter-pattern "ERROR"
```

### Rolling Back Deployment

```powershell
# List stack history
aws cloudformation list-stack-resources --stack-name AiTestingPlatformStack-dev

# Rollback to previous version
cdk deploy --rollback
```

## Security Best Practices

### 1. Rotate Credentials Regularly

```powershell
# Rotate JWT secret
aws secretsmanager update-secret \
  --secret-id ai-testing/jwt-secret \
  --secret-string "new-super-secret-jwt-key"
```

### 2. Enable CloudTrail

```powershell
# Enable CloudTrail for audit logging
aws cloudtrail create-trail \
  --name ai-testing-audit \
  --s3-bucket-name ai-testing-audit-logs
```

### 3. Use VPC for Lambda Functions

Uncomment VPC configuration in `infrastructure/lib/stacks/lambda-stack.ts` for production.

### 4. Enable WAF for API Gateway

```powershell
# Create WAF web ACL
aws wafv2 create-web-acl \
  --name ai-testing-waf \
  --scope REGIONAL \
  --default-action Allow={} \
  --rules file://waf-rules.json
```

## Maintenance

### Regular Tasks

1. **Monitor Costs**: Review AWS Cost Explorer weekly
2. **Check Logs**: Review CloudWatch logs for errors
3. **Update Dependencies**: Run `npm audit` monthly
4. **Backup Data**: DynamoDB point-in-time recovery is enabled
5. **Review Metrics**: Check CloudWatch dashboards daily

### Updating the Application

```powershell
# 1. Make code changes
# 2. Build
npm run build

# 3. Run tests
npm test

# 4. Deploy
cd infrastructure
cdk deploy --context environment=dev
```

## Support and Resources

- **AWS Documentation**: https://docs.aws.amazon.com/
- **AWS CDK Documentation**: https://docs.aws.amazon.com/cdk/
- **Project Documentation**: See `docs/` directory
- **API Documentation**: `docs/API_DOCUMENTATION.md`
- **Production Runbook**: `docs/PRODUCTION_RUNBOOK.md`

## Next Steps

After successful deployment:

1. ✅ Test all API endpoints
2. ✅ Configure SNS email subscriptions
3. ✅ Set up CloudWatch alarms
4. ✅ Enable CloudTrail for audit logging
5. ✅ Configure backup and disaster recovery
6. ✅ Set up monitoring dashboards
7. ✅ Train team on platform usage
8. ✅ Document custom configurations

Your AI Testing Automation Platform is now live on AWS! 🚀
