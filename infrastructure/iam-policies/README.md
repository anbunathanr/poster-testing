# IAM Policies for AI Testing Platform

This directory contains IAM policy documents for all Lambda functions in the AI Testing Platform.

## Policy Files

### Trust Policy
- **trust-policy-lambda.json** - Trust policy allowing Lambda service to assume roles

### Lambda Function Policies

1. **auth-lambda-policy.json**
   - CloudWatch Logs access
   - DynamoDB Users table access
   - Secrets Manager access for JWT secret
   - KMS decrypt for Secrets Manager

2. **testgen-lambda-policy.json**
   - CloudWatch Logs access
   - Amazon Bedrock model invocation
   - DynamoDB Tests and Environments tables access
   - Lambda invocation (for Test Execution Lambda)
   - CloudWatch custom metrics
   - Secrets Manager access for environment credentials
   - KMS decrypt for Secrets Manager

3. **testexec-lambda-policy.json**
   - CloudWatch Logs access
   - DynamoDB Tests, TestResults, and Environments tables access
   - S3 evidence bucket write access
   - SNS publish for notifications
   - CloudWatch custom metrics
   - Secrets Manager access for environment credentials and API keys
   - KMS decrypt for Secrets Manager

4. **storage-lambda-policy.json**
   - CloudWatch Logs access
   - Full S3 evidence bucket access
   - Full DynamoDB access for Tests, TestResults, and Environments tables
   - Secrets Manager access for database connection strings (optional)
   - KMS decrypt for Secrets Manager

5. **report-lambda-policy.json**
   - CloudWatch Logs access
   - Read-only DynamoDB access for Tests and TestResults tables
   - Read-only S3 evidence bucket access

6. **authorizer-lambda-policy.json**
   - CloudWatch Logs access
   - Secrets Manager access for JWT secret
   - KMS decrypt for Secrets Manager

## Usage

### Automated Setup (Recommended)

Run the setup script from the project root:

```bash
chmod +x infrastructure/scripts/setup-iam-roles.sh
./infrastructure/scripts/setup-iam-roles.sh
```

### Manual Setup

Create each role individually:

```bash
# 1. Create Auth Lambda role
aws iam create-role \
  --role-name ai-testing-platform-auth-lambda-role \
  --assume-role-policy-document file://infrastructure/iam-policies/trust-policy-lambda.json \
  --description "IAM role for Auth Lambda function"

aws iam put-role-policy \
  --role-name ai-testing-platform-auth-lambda-role \
  --policy-name AuthLambdaPermissions \
  --policy-document file://infrastructure/iam-policies/auth-lambda-policy.json

# 2. Create Test Generation Lambda role
aws iam create-role \
  --role-name ai-testing-platform-testgen-lambda-role \
  --assume-role-policy-document file://infrastructure/iam-policies/trust-policy-lambda.json \
  --description "IAM role for Test Generation Lambda function"

aws iam put-role-policy \
  --role-name ai-testing-platform-testgen-lambda-role \
  --policy-name TestGenLambdaPermissions \
  --policy-document file://infrastructure/iam-policies/testgen-lambda-policy.json

# 3. Create Test Execution Lambda role
aws iam create-role \
  --role-name ai-testing-platform-testexec-lambda-role \
  --assume-role-policy-document file://infrastructure/iam-policies/trust-policy-lambda.json \
  --description "IAM role for Test Execution Lambda function"

aws iam put-role-policy \
  --role-name ai-testing-platform-testexec-lambda-role \
  --policy-name TestExecLambdaPermissions \
  --policy-document file://infrastructure/iam-policies/testexec-lambda-policy.json

# 4. Create Storage Lambda role
aws iam create-role \
  --role-name ai-testing-platform-storage-lambda-role \
  --assume-role-policy-document file://infrastructure/iam-policies/trust-policy-lambda.json \
  --description "IAM role for Storage Lambda function"

aws iam put-role-policy \
  --role-name ai-testing-platform-storage-lambda-role \
  --policy-name StorageLambdaPermissions \
  --policy-document file://infrastructure/iam-policies/storage-lambda-policy.json

# 5. Create Report Lambda role
aws iam create-role \
  --role-name ai-testing-platform-report-lambda-role \
  --assume-role-policy-document file://infrastructure/iam-policies/trust-policy-lambda.json \
  --description "IAM role for Report Lambda function"

aws iam put-role-policy \
  --role-name ai-testing-platform-report-lambda-role \
  --policy-name ReportLambdaPermissions \
  --policy-document file://infrastructure/iam-policies/report-lambda-policy.json

# 6. Create Authorizer Lambda role
aws iam create-role \
  --role-name ai-testing-platform-authorizer-lambda-role \
  --assume-role-policy-document file://infrastructure/iam-policies/trust-policy-lambda.json \
  --description "IAM role for API Gateway Lambda Authorizer"

aws iam put-role-policy \
  --role-name ai-testing-platform-authorizer-lambda-role \
  --policy-name AuthorizerLambdaPermissions \
  --policy-document file://infrastructure/iam-policies/authorizer-lambda-policy.json
```

## Verification

List all created roles:

```bash
aws iam list-roles --query 'Roles[?contains(RoleName, `ai-testing-platform`)].RoleName'
```

Get role ARN:

```bash
aws iam get-role --role-name ai-testing-platform-auth-lambda-role --query 'Role.Arn'
```

## Security Considerations

- All policies follow the principle of least privilege
- CloudWatch Logs access is scoped to function-specific log groups
- DynamoDB access is limited to required tables and operations
- S3 access is restricted to the evidence bucket
- Bedrock access is limited to Claude 3.5 Sonnet model
- Secrets Manager access is scoped to specific secret paths per function
- KMS decrypt permissions are restricted to Secrets Manager service usage only
- All secrets are encrypted at rest using AWS KMS

## Updating Policies

To update a policy after modification:

```bash
aws iam put-role-policy \
  --role-name <role-name> \
  --policy-name <policy-name> \
  --policy-document file://infrastructure/iam-policies/<policy-file>.json
```

## Deleting Roles

To delete a role (use with caution):

```bash
# First, delete the inline policy
aws iam delete-role-policy \
  --role-name <role-name> \
  --policy-name <policy-name>

# Then, delete the role
aws iam delete-role --role-name <role-name>
```

## References

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Lambda Execution Role](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html)
- [IAM Policy Reference](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies.html)
