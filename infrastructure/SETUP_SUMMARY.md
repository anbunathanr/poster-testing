# AWS CDK Infrastructure Setup Summary

## What Was Created

This document summarizes the AWS CDK infrastructure setup for the AI Testing Automation Platform.

## Directory Structure

```
infrastructure/
├── bin/
│   └── app.ts                          # CDK app entry point
├── lib/
│   ├── ai-testing-platform-stack.ts    # Main orchestrator stack
│   └── stacks/
│       ├── dynamodb-stack.ts           # DynamoDB tables
│       ├── s3-stack.ts                 # S3 buckets
│       ├── notification-stack.ts       # SNS topics
│       ├── lambda-stack.ts             # Lambda functions
│       ├── api-gateway-stack.ts        # API Gateway
│       └── monitoring-stack.ts         # CloudWatch monitoring
├── test/
│   └── infrastructure.test.ts          # Infrastructure tests
├── cdk.json                            # CDK configuration
├── tsconfig.json                       # TypeScript config
├── .gitignore                          # Git ignore rules
├── README.md                           # Infrastructure documentation
└── SETUP_SUMMARY.md                    # This file
```

## Infrastructure Components

### 1. DynamoDB Stack (`dynamodb-stack.ts`)

Creates four DynamoDB tables with encryption and GSIs:

- **Users Table**: Stores user credentials and tenant associations
  - Partition Key: `userId`
  - GSI: `tenantId-email-index`
  
- **Tests Table**: Stores generated test scripts
  - Partition Key: `tenantId`, Sort Key: `testId`
  - GSI: `userId-createdAt-index`
  
- **TestResults Table**: Stores test execution results
  - Partition Key: `tenantId`, Sort Key: `resultId`
  - GSI: `testId-startTime-index`
  
- **Environments Table**: Stores environment configurations
  - Partition Key: `tenantId`, Sort Key: `environment`

All tables use:
- On-demand billing mode
- AWS-managed encryption
- Point-in-time recovery
- Environment-specific retention policies

### 2. S3 Stack (`s3-stack.ts`)

Creates evidence bucket with:
- S3-managed encryption
- Block all public access
- Lifecycle policies:
  - Archive to Glacier after 90 days
  - Delete after 365 days
- CORS configuration for frontend access
- Environment-specific retention

### 3. Notification Stack (`notification-stack.ts`)

Creates SNS topics for:
- Test result notifications
- Optional email subscriptions via context

### 4. Lambda Stack (`lambda-stack.ts`)

Creates six Lambda functions with proper IAM roles:

1. **Auth Lambda** (256 MB, 10s)
   - User registration and login
   - JWT token generation
   - DynamoDB Users table access

2. **Authorizer Lambda** (256 MB, 10s)
   - JWT token validation
   - API Gateway authorization

3. **Test Generation Lambda** (512 MB, 30s)
   - Bedrock integration
   - Test script validation
   - DynamoDB Tests table access
   - Bedrock InvokeModel permissions

4. **Test Execution Lambda** (2048 MB, 300s)
   - Playwright test execution
   - Screenshot capture
   - S3 evidence upload
   - SNS notification publishing
   - Reserved concurrency: 100

5. **Storage Lambda** (512 MB, 30s)
   - S3 operations
   - Presigned URL generation
   - DynamoDB TestResults access

6. **Report Lambda** (512 MB, 30s)
   - Report generation
   - Result aggregation
   - Read-only access to all tables

All Lambda functions include:
- CloudWatch log groups (30-day retention)
- Environment variables for resource names
- Proper IAM permissions

### 5. API Gateway Stack (`api-gateway-stack.ts`)

Creates REST API with:
- JWT Lambda Authorizer
- CloudWatch logging
- Rate limiting (1000 req/s, 2000 burst)
- CORS configuration
- Environment-specific stage

Endpoints:
- `POST /auth/register` (public)
- `POST /auth/login` (public)
- `POST /tests/generate` (protected)
- `POST /tests/{testId}/execute` (protected)
- `GET /tests/{testId}/results/{resultId}` (protected)
- `GET /tests/results` (protected)
- `GET /reports/{resultId}` (protected)
- `POST /environments` (protected)
- `GET /environments` (protected)
- `GET /environments/{environment}` (protected)
- `PUT /environments/{environment}` (protected)
- `DELETE /environments/{environment}` (protected)

### 6. Monitoring Stack (`monitoring-stack.ts`)

Creates CloudWatch resources:
- Dashboard with Lambda, API Gateway, and DynamoDB metrics
- Alarms for:
  - Lambda error rates > 5%
  - API Gateway 5xx errors > 10
  - DynamoDB throttling
  - Test failure rate > 20%
- SNS topic for alarm notifications
- Custom metrics namespace: `AiTestingPlatform`

## Configuration Files

### cdk.json
- CDK app configuration
- Feature flags for best practices
- Context settings

### tsconfig.json
- TypeScript compiler options
- ES2020 target
- Strict mode enabled

### .gitignore
- Excludes compiled files
- Excludes CDK output directory
- Excludes context files

## NPM Scripts Added

Added to main `package.json`:

```json
"cdk": "cd infrastructure && cdk",
"cdk:synth": "cd infrastructure && cdk synth",
"cdk:deploy:dev": "cd infrastructure && cdk deploy --context environment=dev",
"cdk:deploy:staging": "cd infrastructure && cdk deploy --context environment=staging",
"cdk:deploy:prod": "cd infrastructure && cdk deploy --context environment=prod --require-approval broadening",
"cdk:diff": "cd infrastructure && cdk diff",
"cdk:destroy:dev": "cd infrastructure && cdk destroy --context environment=dev"
```

## Documentation Created

1. **infrastructure/README.md**
   - Comprehensive infrastructure documentation
   - Deployment instructions
   - Configuration details
   - Troubleshooting guide

2. **docs/INFRASTRUCTURE_DEPLOYMENT.md**
   - Step-by-step deployment guide
   - Prerequisites and setup
   - Environment-specific instructions
   - Post-deployment configuration
   - Security best practices
   - CI/CD integration examples

3. **infrastructure/SETUP_SUMMARY.md** (this file)
   - Overview of created components
   - Quick reference

## Testing

Created `infrastructure/test/infrastructure.test.ts` with tests for:
- DynamoDB table configuration
- S3 bucket security
- Lambda function settings
- API Gateway endpoints
- SNS topics
- CloudWatch monitoring
- Security settings
- Stack outputs

Run tests with:
```bash
cd infrastructure
npm test
```

## Dependencies Added

```json
{
  "devDependencies": {
    "aws-cdk-lib": "^2.238.0",
    "constructs": "^10.0.0",
    "source-map-support": "^0.5.21"
  }
}
```

## Environment Support

The infrastructure supports three environments:
- **dev**: Development (auto-delete resources on destroy)
- **staging**: Pre-production (auto-delete resources on destroy)
- **prod**: Production (retain resources on destroy)

Environment-specific naming:
- Tables: `ai-testing-{resource}-{environment}`
- Buckets: `ai-testing-evidence-{environment}-{account-id}`
- Functions: `ai-testing-{function}-{environment}`
- API: `ai-testing-api-{environment}`

## Stack Outputs

After deployment, CDK outputs:
1. **ApiEndpoint**: API Gateway URL
2. **EvidenceBucketName**: S3 bucket name
3. **NotificationTopicArn**: SNS topic ARN

## Security Features

- ✅ DynamoDB encryption at rest (AWS-managed)
- ✅ S3 bucket encryption (SSE-S3)
- ✅ S3 block all public access
- ✅ IAM roles with least privilege
- ✅ API Gateway HTTPS only
- ✅ JWT token authentication
- ✅ CloudWatch logging enabled
- ✅ Point-in-time recovery for DynamoDB

## Next Steps

1. Build Lambda function code: `npm run build`
2. Deploy infrastructure: `npm run cdk:deploy:dev`
3. Note the API endpoint from outputs
4. Configure environment settings in DynamoDB
5. Test API endpoints
6. Set up CI/CD pipeline
7. Configure monitoring alerts

## Cost Considerations

Development environment (low usage):
- DynamoDB: ~$1-5/month
- Lambda: ~$5-10/month
- S3: ~$1-3/month
- API Gateway: ~$3-5/month
- CloudWatch: ~$2-5/month
- **Total**: ~$12-28/month

## Maintenance

### Updating Infrastructure

1. Modify CDK code in `infrastructure/lib/`
2. Review changes: `npm run cdk:diff`
3. Deploy: `npm run cdk:deploy:dev`

### Monitoring

- CloudWatch Dashboard: `ai-testing-platform-{environment}`
- CloudWatch Logs: `/aws/lambda/ai-testing-*-{environment}`
- CloudFormation Stack: `AiTestingPlatform-{environment}`

### Cleanup

Remove all resources:
```bash
npm run cdk:destroy:dev
```

## Support

For issues or questions:
- Check [Infrastructure README](README.md)
- Check [Deployment Guide](../docs/INFRASTRUCTURE_DEPLOYMENT.md)
- Review CloudWatch Logs
- Check CloudFormation events
