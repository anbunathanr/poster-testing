# AWS Account Setup and IAM Configuration Guide

## Overview

This guide provides step-by-step instructions for setting up an AWS account and configuring IAM roles for the AI-Powered Automated Testing SaaS Platform. The platform uses AWS Lambda, DynamoDB, S3, API Gateway, Amazon Bedrock, SNS, and CloudWatch services.

## Table of Contents

1. [AWS Account Setup](#aws-account-setup)
2. [IAM Roles and Policies](#iam-roles-and-policies)
3. [AWS CLI Configuration](#aws-cli-configuration)
4. [Local Development Setup](#local-development-setup)
5. [Security Best Practices](#security-best-practices)
6. [Verification Steps](#verification-steps)

---

## AWS Account Setup

### Prerequisites

- Valid email address
- Credit card for AWS billing
- Phone number for verification

### Steps

#### 1. Create AWS Account (if new)

1. Navigate to [https://aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Enter email address and account name
4. Choose "Personal" or "Professional" account type
5. Complete billing information
6. Verify identity via phone
7. Select Support Plan (Basic/Free is sufficient for development)
8. Wait for account activation (typically 5-10 minutes)

#### 2. Enable Required AWS Services

Navigate to the AWS Console and ensure the following services are available in your region:

- **AWS Lambda** - Serverless compute
- **Amazon DynamoDB** - NoSQL database
- **Amazon S3** - Object storage
- **Amazon API Gateway** - API management
- **Amazon Bedrock** - AI/ML service (Claude 3.5 Sonnet)
- **Amazon SNS** - Notification service
- **Amazon CloudWatch** - Monitoring and logging
- **AWS Secrets Manager** - Secrets storage
- **AWS CloudTrail** - Audit logging

**Recommended Region**: `us-east-1` (N. Virginia) or `us-west-2` (Oregon)

> **Note**: Amazon Bedrock availability varies by region. Verify Claude 3.5 Sonnet is available in your chosen region.

#### 3. Request Bedrock Model Access

1. Navigate to Amazon Bedrock console
2. Go to "Model access" in the left sidebar
3. Click "Manage model access"
4. Select "Anthropic Claude 3.5 Sonnet"
5. Click "Request model access"
6. Wait for approval (typically instant for most accounts)

---

## IAM Roles and Policies

### Architecture Overview

The platform uses five Lambda functions, each requiring specific IAM permissions:

1. **Auth Lambda** - User authentication and JWT management
2. **Test Generation Lambda** - AI test case generation orchestration
3. **Test Execution Lambda** - Playwright test execution
4. **Storage Lambda** - Data persistence and retrieval
5. **Report Lambda** - Test report generation

### Principle of Least Privilege

Each role is configured with minimal permissions required for its function, following AWS security best practices.

---

### 1. Auth Lambda IAM Role

**Role Name**: `ai-testing-platform-auth-lambda-role`

**Purpose**: Authenticate users, manage JWT tokens, access user data in DynamoDB

#### Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

#### Permissions Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/ai-testing-auth-*"
    },
    {
      "Sid": "DynamoDBUsers",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/ai-testing-users",
        "arn:aws:dynamodb:*:*:table/ai-testing-users/index/*"
      ]
    },
    {
      "Sid": "SecretsManager",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:ai-testing/jwt-secret-*"
    }
  ]
}
```

#### AWS CLI Commands

```bash
# Create the role
aws iam create-role \
  --role-name ai-testing-platform-auth-lambda-role \
  --assume-role-policy-document file://trust-policy-lambda.json \
  --description "IAM role for Auth Lambda function"

# Attach the permissions policy
aws iam put-role-policy \
  --role-name ai-testing-platform-auth-lambda-role \
  --policy-name AuthLambdaPermissions \
  --policy-document file://auth-lambda-policy.json
```

---

### 2. Test Generation Lambda IAM Role

**Role Name**: `ai-testing-platform-testgen-lambda-role`

**Purpose**: Orchestrate test generation, invoke Bedrock, store test scripts

#### Permissions Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/ai-testing-testgen-*"
    },
    {
      "Sid": "BedrockInvoke",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*"
    },
    {
      "Sid": "DynamoDBTests",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/ai-testing-tests",
        "arn:aws:dynamodb:*:*:table/ai-testing-tests/index/*",
        "arn:aws:dynamodb:*:*:table/ai-testing-environments"
      ]
    },
    {
      "Sid": "LambdaInvoke",
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:*:*:function:ai-testing-testexec-*"
    },
    {
      "Sid": "CloudWatchMetrics",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "cloudwatch:namespace": "AITestingPlatform"
        }
      }
    }
  ]
}
```

#### AWS CLI Commands

```bash
# Create the role
aws iam create-role \
  --role-name ai-testing-platform-testgen-lambda-role \
  --assume-role-policy-document file://trust-policy-lambda.json \
  --description "IAM role for Test Generation Lambda function"

# Attach the permissions policy
aws iam put-role-policy \
  --role-name ai-testing-platform-testgen-lambda-role \
  --policy-name TestGenLambdaPermissions \
  --policy-document file://testgen-lambda-policy.json
```

---

### 3. Test Execution Lambda IAM Role

**Role Name**: `ai-testing-platform-testexec-lambda-role`

**Purpose**: Execute Playwright tests, capture screenshots, store results

#### Permissions Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/ai-testing-testexec-*"
    },
    {
      "Sid": "DynamoDBTestsAndResults",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/ai-testing-tests",
        "arn:aws:dynamodb:*:*:table/ai-testing-test-results",
        "arn:aws:dynamodb:*:*:table/ai-testing-test-results/index/*",
        "arn:aws:dynamodb:*:*:table/ai-testing-environments"
      ]
    },
    {
      "Sid": "S3Evidence",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::ai-testing-platform-evidence/*"
    },
    {
      "Sid": "SNSPublish",
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:*:*:ai-testing-notifications-*"
    },
    {
      "Sid": "CloudWatchMetrics",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "cloudwatch:namespace": "AITestingPlatform"
        }
      }
    }
  ]
}
```

#### AWS CLI Commands

```bash
# Create the role
aws iam create-role \
  --role-name ai-testing-platform-testexec-lambda-role \
  --assume-role-policy-document file://trust-policy-lambda.json \
  --description "IAM role for Test Execution Lambda function"

# Attach the permissions policy
aws iam put-role-policy \
  --role-name ai-testing-platform-testexec-lambda-role \
  --policy-name TestExecLambdaPermissions \
  --policy-document file://testexec-lambda-policy.json
```

---

### 4. Storage Lambda IAM Role

**Role Name**: `ai-testing-platform-storage-lambda-role`

**Purpose**: Manage S3 uploads, DynamoDB operations, generate presigned URLs

#### Permissions Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/ai-testing-storage-*"
    },
    {
      "Sid": "S3FullAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ai-testing-platform-evidence",
        "arn:aws:s3:::ai-testing-platform-evidence/*"
      ]
    },
    {
      "Sid": "DynamoDBFullAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/ai-testing-tests",
        "arn:aws:dynamodb:*:*:table/ai-testing-test-results",
        "arn:aws:dynamodb:*:*:table/ai-testing-test-results/index/*",
        "arn:aws:dynamodb:*:*:table/ai-testing-environments"
      ]
    }
  ]
}
```

#### AWS CLI Commands

```bash
# Create the role
aws iam create-role \
  --role-name ai-testing-platform-storage-lambda-role \
  --assume-role-policy-document file://trust-policy-lambda.json \
  --description "IAM role for Storage Lambda function"

# Attach the permissions policy
aws iam put-role-policy \
  --role-name ai-testing-platform-storage-lambda-role \
  --policy-name StorageLambdaPermissions \
  --policy-document file://storage-lambda-policy.json
```

---

### 5. Report Lambda IAM Role

**Role Name**: `ai-testing-platform-report-lambda-role`

**Purpose**: Generate test reports, retrieve test data, create presigned URLs

#### Permissions Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/ai-testing-report-*"
    },
    {
      "Sid": "DynamoDBReadOnly",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/ai-testing-tests",
        "arn:aws:dynamodb:*:*:table/ai-testing-test-results",
        "arn:aws:dynamodb:*:*:table/ai-testing-test-results/index/*"
      ]
    },
    {
      "Sid": "S3ReadOnly",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ai-testing-platform-evidence",
        "arn:aws:s3:::ai-testing-platform-evidence/*"
      ]
    }
  ]
}
```

#### AWS CLI Commands

```bash
# Create the role
aws iam create-role \
  --role-name ai-testing-platform-report-lambda-role \
  --assume-role-policy-document file://trust-policy-lambda.json \
  --description "IAM role for Report Lambda function"

# Attach the permissions policy
aws iam put-role-policy \
  --role-name ai-testing-platform-report-lambda-role \
  --policy-name ReportLambdaPermissions \
  --policy-document file://report-lambda-policy.json
```

---

### 6. API Gateway Lambda Authorizer Role

**Role Name**: `ai-testing-platform-authorizer-lambda-role`

**Purpose**: Validate JWT tokens, authorize API requests

#### Permissions Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/ai-testing-authorizer-*"
    },
    {
      "Sid": "SecretsManager",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:ai-testing/jwt-secret-*"
    }
  ]
}
```

#### AWS CLI Commands

```bash
# Create the role
aws iam create-role \
  --role-name ai-testing-platform-authorizer-lambda-role \
  --assume-role-policy-document file://trust-policy-lambda.json \
  --description "IAM role for API Gateway Lambda Authorizer"

# Attach the permissions policy
aws iam put-role-policy \
  --role-name ai-testing-platform-authorizer-lambda-role \
  --policy-name AuthorizerLambdaPermissions \
  --policy-document file://authorizer-lambda-policy.json
```

---

## AWS CLI Configuration

### Install AWS CLI

#### macOS
```bash
brew install awscli
```

#### Linux
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

#### Windows
Download and run the installer from: https://aws.amazon.com/cli/

### Create IAM User for CLI Access

1. Navigate to IAM Console → Users
2. Click "Add users"
3. Username: `ai-testing-platform-developer`
4. Select "Access key - Programmatic access"
5. Attach policies:
   - `AdministratorAccess` (for development) or custom policy
6. Save Access Key ID and Secret Access Key

### Configure AWS CLI

```bash
aws configure

# Enter the following when prompted:
# AWS Access Key ID: <your-access-key-id>
# AWS Secret Access Key: <your-secret-access-key>
# Default region name: us-east-1
# Default output format: json
```

### Verify Configuration

```bash
# Test AWS CLI
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "AIDAXXXXXXXXXXXXXXXXX",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/ai-testing-platform-developer"
# }
```

---

## Local Development Setup

### Environment Variables

Create a `.env` file in the project root:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# DynamoDB Tables
DYNAMODB_USERS_TABLE=ai-testing-users
DYNAMODB_TESTS_TABLE=ai-testing-tests
DYNAMODB_TEST_RESULTS_TABLE=ai-testing-test-results
DYNAMODB_ENVIRONMENTS_TABLE=ai-testing-environments

# S3 Buckets
S3_EVIDENCE_BUCKET=ai-testing-platform-evidence

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRATION=3600

# Bedrock Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
BEDROCK_REGION=us-east-1

# SNS Topics
SNS_NOTIFICATIONS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:ai-testing-notifications

# API Gateway
API_GATEWAY_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod

# Environment
NODE_ENV=development
```

### AWS Credentials for Local Development

#### Option 1: AWS CLI Credentials (Recommended)

The AWS SDK automatically uses credentials from `~/.aws/credentials`

#### Option 2: Environment Variables

```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_REGION=us-east-1
```

#### Option 3: IAM Role (for EC2/ECS)

If running on AWS infrastructure, attach an IAM role to the instance.

---

## Security Best Practices

### 1. Enable MFA for Root Account

1. Sign in as root user
2. Navigate to IAM → Dashboard
3. Click "Activate MFA on your root account"
4. Follow the setup wizard

### 2. Create IAM Users (Don't Use Root)

- Never use root account for daily operations
- Create individual IAM users for each team member
- Assign appropriate permissions via groups

### 3. Enable CloudTrail

```bash
aws cloudtrail create-trail \
  --name ai-testing-platform-trail \
  --s3-bucket-name ai-testing-cloudtrail-logs

aws cloudtrail start-logging \
  --name ai-testing-platform-trail
```

### 4. Rotate Access Keys Regularly

- Rotate access keys every 90 days
- Use AWS Secrets Manager for sensitive credentials
- Never commit credentials to version control

### 5. Enable AWS Config

Monitor compliance and configuration changes:

```bash
aws configservice put-configuration-recorder \
  --configuration-recorder name=default,roleARN=arn:aws:iam::123456789012:role/config-role

aws configservice put-delivery-channel \
  --delivery-channel name=default,s3BucketName=ai-testing-config-logs
```

### 6. Set Up Budget Alerts

1. Navigate to AWS Billing Console
2. Click "Budgets" → "Create budget"
3. Set monthly budget threshold
4. Configure email alerts

---

## Verification Steps

### 1. Verify IAM Roles

```bash
# List all roles
aws iam list-roles --query 'Roles[?contains(RoleName, `ai-testing-platform`)].RoleName'

# Expected output:
# [
#     "ai-testing-platform-auth-lambda-role",
#     "ai-testing-platform-testgen-lambda-role",
#     "ai-testing-platform-testexec-lambda-role",
#     "ai-testing-platform-storage-lambda-role",
#     "ai-testing-platform-report-lambda-role",
#     "ai-testing-platform-authorizer-lambda-role"
# ]
```

### 2. Verify Bedrock Access

```bash
# List available models
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query 'modelSummaries[?contains(modelId, `claude-3-5-sonnet`)].modelId'
```

### 3. Test IAM Role Permissions

```bash
# Simulate policy evaluation
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/ai-testing-platform-auth-lambda-role \
  --action-names dynamodb:GetItem \
  --resource-arns arn:aws:dynamodb:us-east-1:123456789012:table/ai-testing-users
```

### 4. Verify AWS CLI Configuration

```bash
# Check current identity
aws sts get-caller-identity

# Check region
aws configure get region

# List S3 buckets (to verify access)
aws s3 ls
```

---

## Troubleshooting

### Issue: "Access Denied" when invoking Bedrock

**Solution**: Ensure you've requested model access in the Bedrock console and the IAM role has `bedrock:InvokeModel` permission.

### Issue: "Role not found" when deploying Lambda

**Solution**: Wait 10-15 seconds after creating IAM roles before deploying Lambda functions (IAM eventual consistency).

### Issue: "Invalid credentials" with AWS CLI

**Solution**: Run `aws configure` again and verify access keys are correct. Check if keys are active in IAM console.

### Issue: DynamoDB "Table not found"

**Solution**: Ensure tables are created in the same region as your Lambda functions. Check `AWS_REGION` environment variable.

---

## Next Steps

After completing this setup:

1. ✅ Proceed to Task 1.2: Create DynamoDB tables (see [DYNAMODB_SETUP.md](./DYNAMODB_SETUP.md))
2. ✅ Proceed to Task 1.3: Create S3 bucket with folder structure (see [S3_SETUP.md](./S3_SETUP.md))
3. ✅ Proceed to Task 1.4: Configure API Gateway
4. ✅ Store JWT secret in AWS Secrets Manager
5. ✅ Set up CloudWatch log groups

---

## Additional Resources

### Project Documentation

- [Encryption at Rest Setup](./ENCRYPTION_SETUP.md) - DynamoDB and S3 encryption configuration
- [DynamoDB Setup](./DYNAMODB_SETUP.md) - Database table creation and configuration
- [S3 Setup](./S3_SETUP.md) - Storage bucket configuration
- [Secrets Manager Setup](./SECRETS_MANAGER_SETUP.md) - Secrets management
- [CloudWatch Setup](./CLOUDWATCH_SETUP.md) - Monitoring and logging

### AWS Documentation

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Lambda Execution Role](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html)
- [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/)
- [AWS CLI Command Reference](https://docs.aws.amazon.com/cli/latest/reference/)
- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)

---

## Support

For issues or questions:
- Review AWS CloudWatch logs
- Check IAM policy simulator
- Consult AWS Support (if applicable)
- Review project documentation in `/docs`

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: AI Testing Platform Team
