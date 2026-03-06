# AI Testing Platform - Infrastructure as Code

This directory contains the AWS CDK infrastructure code for the AI Testing Automation Platform.

## Overview

The infrastructure is organized into modular stacks:

- **DynamoDB Stack**: User, test, test result, and environment tables
- **S3 Stack**: Evidence storage bucket for screenshots, logs, and reports
- **Notification Stack**: SNS topics for test notifications
- **Lambda Stack**: All Lambda functions with proper IAM roles
- **API Gateway Stack**: REST API with JWT authorization
- **Monitoring Stack**: CloudWatch dashboards, metrics, and alarms

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI: `npm install -g aws-cdk`
- TypeScript: `npm install -g typescript`

## Project Structure

```
infrastructure/
├── bin/
│   └── app.ts                 # CDK app entry point
├── lib/
│   ├── ai-testing-platform-stack.ts  # Main stack orchestrator
│   └── stacks/
│       ├── dynamodb-stack.ts         # DynamoDB tables
│       ├── s3-stack.ts               # S3 buckets
│       ├── notification-stack.ts     # SNS topics
│       ├── lambda-stack.ts           # Lambda functions
│       ├── api-gateway-stack.ts      # API Gateway
│       └── monitoring-stack.ts       # CloudWatch monitoring
├── cdk.json                   # CDK configuration
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## Infrastructure Components

### DynamoDB Tables

1. **Users Table** (`ai-testing-users-{env}`)
   - Partition Key: `userId`
   - GSI: `tenantId-email-index`
   - Stores user credentials and tenant associations

2. **Tests Table** (`ai-testing-tests-{env}`)
   - Partition Key: `tenantId`
   - Sort Key: `testId`
   - GSI: `userId-createdAt-index`
   - Stores generated test scripts

3. **TestResults Table** (`ai-testing-results-{env}`)
   - Partition Key: `tenantId`
   - Sort Key: `resultId`
   - GSI: `testId-startTime-index`
   - Stores test execution results

4. **Environments Table** (`ai-testing-environments-{env}`)
   - Partition Key: `tenantId`
   - Sort Key: `environment`
   - Stores environment configurations

### Lambda Functions

1. **Auth Lambda** (256 MB, 10s timeout)
   - User registration and login
   - JWT token generation

2. **Authorizer Lambda** (256 MB, 10s timeout)
   - JWT token validation
   - API Gateway authorization

3. **Test Generation Lambda** (512 MB, 30s timeout)
   - Bedrock integration for AI test generation
   - Test script validation and storage

4. **Test Execution Lambda** (2048 MB, 300s timeout)
   - Playwright test execution
   - Screenshot capture
   - Result storage and notification
   - **Uses Playwright Lambda Layer** (see [Playwright Layer Setup](../docs/PLAYWRIGHT_LAYER_SETUP.md))

5. **Storage Lambda** (512 MB, 30s timeout)
   - S3 operations
   - Presigned URL generation
   - Environment management

6. **Report Lambda** (512 MB, 30s timeout)
   - Test report generation
   - Result aggregation

### Lambda Layers

**Playwright Layer** - Required for Test Execution Lambda
- Contains playwright-aws-lambda and playwright-core
- Provides Chromium browser optimized for Lambda
- Must be built before deploying infrastructure
- See [Playwright Layer Setup Guide](../docs/PLAYWRIGHT_LAYER_SETUP.md) for details

### API Gateway Endpoints

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /tests/generate` - Generate test from prompt (protected)
- `POST /tests/{testId}/execute` - Execute test (protected)
- `GET /tests/{testId}/results/{resultId}` - Get test result (protected)
- `GET /tests/results` - List all results (protected)
- `GET /reports/{resultId}` - Get test report (protected)
- `POST /environments` - Create environment config (protected)
- `GET /environments` - List environments (protected)
- `GET /environments/{environment}` - Get environment (protected)
- `PUT /environments/{environment}` - Update environment (protected)
- `DELETE /environments/{environment}` - Delete environment (protected)

### Monitoring

- CloudWatch Dashboards with Lambda, API Gateway, and DynamoDB metrics
- CloudWatch Alarms for:
  - Lambda error rates > 5%
  - API Gateway 5xx errors > 10
  - DynamoDB throttling events
  - Test failure rate > 20%

## Deployment

### First-Time Setup

1. Install dependencies:
   ```bash
   cd infrastructure
   npm install
   ```

2. Build the Playwright Lambda Layer:
   ```bash
   cd ../layers/playwright
   chmod +x build-layer.sh
   ./build-layer.sh
   cd ../../infrastructure
   ```

3. Bootstrap CDK (one-time per account/region):
   ```bash
   cdk bootstrap aws://ACCOUNT-ID/REGION
   ```

### Deploy to Development

```bash
cd infrastructure
cdk deploy --context environment=dev
```

### Deploy to Staging

```bash
cd infrastructure
cdk deploy --context environment=staging
```

### Deploy to Production

```bash
cd infrastructure
cdk deploy --context environment=prod --require-approval broadening
```

### Deploy with Email Notifications

```bash
cdk deploy \
  --context environment=dev \
  --context notificationEmail=your-email@example.com \
  --context alarmEmail=admin@example.com
```

## CDK Commands

- `cdk synth` - Synthesize CloudFormation template
- `cdk diff` - Compare deployed stack with current state
- `cdk deploy` - Deploy stack to AWS
- `cdk destroy` - Remove stack from AWS
- `cdk ls` - List all stacks in the app

## Environment Variables

The Lambda functions use the following environment variables (automatically set by CDK):

- `ENVIRONMENT` - Deployment environment (dev/staging/prod)
- `USERS_TABLE` - DynamoDB Users table name
- `TESTS_TABLE` - DynamoDB Tests table name
- `TEST_RESULTS_TABLE` - DynamoDB TestResults table name
- `ENVIRONMENTS_TABLE` - DynamoDB Environments table name
- `EVIDENCE_BUCKET` - S3 bucket name for evidence
- `NOTIFICATION_TOPIC_ARN` - SNS topic ARN for notifications
- `JWT_SECRET` - JWT signing secret (should use Secrets Manager in production)

## Security Considerations

### Current Implementation

- DynamoDB encryption at rest (AWS managed)
- S3 bucket encryption (SSE-S3)
- API Gateway HTTPS only
- JWT token-based authentication
- IAM roles with least privilege
- CloudWatch logging enabled

**For detailed encryption configuration and verification steps, see [docs/ENCRYPTION_SETUP.md](../docs/ENCRYPTION_SETUP.md)**

### Production Recommendations

1. **Secrets Management**
   - Move JWT_SECRET to AWS Secrets Manager
   - Encrypt environment credentials in DynamoDB

2. **Network Security**
   - Deploy Lambda functions in VPC
   - Use VPC endpoints for AWS services
   - Implement security groups

3. **API Security**
   - Restrict CORS origins to actual frontend domains
   - Implement API keys for additional security
   - Enable AWS WAF for DDoS protection

4. **Monitoring**
   - Enable AWS CloudTrail for audit logging
   - Set up AWS Config for compliance
   - Implement AWS GuardDuty for threat detection

## Cost Optimization

### Current Configuration

- DynamoDB: On-demand billing mode
- Lambda: Pay per invocation
- S3: Lifecycle policies (Glacier after 90 days, delete after 365 days)
- API Gateway: Pay per request

### Optimization Tips

1. Use DynamoDB provisioned capacity if usage is predictable
2. Optimize Lambda memory allocation based on CloudWatch metrics
3. Implement S3 Intelligent-Tiering for automatic cost optimization
4. Use CloudFront for S3 evidence access to reduce data transfer costs
5. Set up AWS Budgets and Cost Anomaly Detection

## Troubleshooting

### Deployment Fails

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify CDK bootstrap: `cdk bootstrap`
3. Check CloudFormation events in AWS Console

### Lambda Functions Not Working

1. Check CloudWatch Logs: `/aws/lambda/ai-testing-*-{env}`
2. Verify IAM permissions
3. Check environment variables

### API Gateway 403 Errors

1. Verify JWT token is valid
2. Check Authorizer Lambda logs
3. Verify API Gateway method authorization settings

## Cleanup

To remove all infrastructure:

```bash
cd infrastructure
cdk destroy --context environment=dev
```

**Warning**: This will delete all data in DynamoDB tables and S3 buckets (except in production where retention is enabled).

## Next Steps

After deploying the infrastructure:

1. Build and deploy Lambda function code
2. Configure environment settings in DynamoDB
3. Set up CI/CD pipeline for automated deployments
4. Configure monitoring alerts
5. Test all API endpoints
6. Set up backup and disaster recovery procedures

## Support

For issues or questions:
- Check CloudWatch Logs for error details
- Review AWS CloudFormation stack events
- Consult the main project documentation
