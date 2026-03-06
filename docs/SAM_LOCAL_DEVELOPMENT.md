# AWS SAM Local Development Guide

This guide explains how to set up and use AWS SAM (Serverless Application Model) for local development and testing of the AI-powered automated testing platform.

## Overview

AWS SAM provides a local development environment that simulates AWS Lambda, API Gateway, DynamoDB, and S3 services on your machine. This allows you to:

- Test Lambda functions locally without deploying to AWS
- Debug Lambda functions with breakpoints
- Validate API Gateway configurations
- Test with local DynamoDB and S3
- Reduce development costs and iteration time

## Prerequisites

### Required Software

1. **AWS SAM CLI** - [Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
   ```bash
   # macOS
   brew install aws-sam-cli
   
   # Windows (using Chocolatey)
   choco install aws-sam-cli
   
   # Linux
   # Download from https://github.com/aws/aws-sam-cli/releases/latest
   ```

2. **Docker Desktop** - Required for running Lambda functions locally
   - [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Ensure Docker is running before using SAM

3. **AWS CLI** - For AWS credentials configuration
   ```bash
   aws configure
   ```

4. **Node.js 18.x or later**
   ```bash
   node --version  # Should be 18.x or higher
   ```

### Verify Installation

```bash
# Check SAM CLI version
sam --version

# Check Docker is running
docker ps

# Check AWS credentials
aws sts get-caller-identity
```

## Project Setup

### 1. Build the Project

Before running SAM locally, compile TypeScript to JavaScript:

```bash
npm run build
```

This creates the `dist/` directory with compiled Lambda functions.

### 2. Validate SAM Template

```bash
sam validate
```

This checks the `template.yaml` for syntax errors and validates the CloudFormation template.

## Local Development Workflows

### Running API Gateway Locally

Start a local API Gateway that routes requests to your Lambda functions:

```bash
sam local start-api
```

This starts a local server at `http://127.0.0.1:3000` with all API endpoints defined in `template.yaml`.

**Available Endpoints:**
- `POST http://127.0.0.1:3000/auth/register` - User registration
- `POST http://127.0.0.1:3000/auth/login` - User login
- `POST http://127.0.0.1:3000/tests/generate` - Generate test from prompt
- `POST http://127.0.0.1:3000/tests/{testId}/execute` - Execute test
- `GET http://127.0.0.1:3000/tests/{testId}/results/{resultId}` - Get test result
- `GET http://127.0.0.1:3000/tests/results` - List test results
- `GET http://127.0.0.1:3000/reports/{resultId}` - Get test report

**Example Usage:**

```bash
# Register a new user
curl -X POST http://127.0.0.1:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "tenantId": "tenant-123"
  }'

# Login
curl -X POST http://127.0.0.1:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### Invoking Individual Lambda Functions

Test a single Lambda function with a specific event:

```bash
# Invoke Auth Lambda with test event
sam local invoke AuthFunction -e events/auth-login.json

# Invoke Test Generation Lambda
sam local invoke TestGenerationFunction -e events/test-generate.json

# Invoke with environment variables
sam local invoke AuthFunction \
  --env-vars env.json \
  -e events/auth-login.json
```

**Create Test Events:**

Create an `events/` directory with sample event JSON files:

```bash
mkdir -p events
```

Example `events/auth-login.json`:
```json
{
  "body": "{\"email\":\"test@example.com\",\"password\":\"SecurePass123!\"}",
  "headers": {
    "Content-Type": "application/json"
  },
  "httpMethod": "POST",
  "path": "/auth/login"
}
```

### Debugging Lambda Functions

#### Using VS Code

1. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "SAM Debug Auth Lambda",
      "type": "node",
      "request": "attach",
      "address": "localhost",
      "port": 5858,
      "localRoot": "${workspaceFolder}/dist/lambdas/auth",
      "remoteRoot": "/var/task",
      "protocol": "inspector",
      "stopOnEntry": false,
      "sourceMaps": true
    }
  ]
}
```

2. Start Lambda in debug mode:

```bash
sam local invoke AuthFunction \
  -e events/auth-login.json \
  -d 5858
```

3. Set breakpoints in VS Code and attach the debugger

#### Using Chrome DevTools

```bash
# Start with debug port
sam local start-api -d 5858

# Open Chrome and navigate to:
chrome://inspect
```

### Generating Sample Events

SAM can generate sample events for various AWS services:

```bash
# API Gateway event
sam local generate-event apigateway aws-proxy > events/api-gateway.json

# DynamoDB event
sam local generate-event dynamodb update > events/dynamodb-update.json

# S3 event
sam local generate-event s3 put > events/s3-put.json
```

## Local DynamoDB Setup

### Option 1: DynamoDB Local (Recommended for Development)

1. **Install DynamoDB Local:**

```bash
# Using Docker
docker run -p 8000:8000 amazon/dynamodb-local
```

2. **Create Local Tables:**

```bash
# Create Users table
aws dynamodb create-table \
  --table-name ai-testing-users-local \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=email,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    "[{\"IndexName\":\"tenantId-email-index\",\"KeySchema\":[{\"AttributeName\":\"tenantId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"email\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --endpoint-url http://localhost:8000

# Create Tests table
aws dynamodb create-table \
  --table-name ai-testing-tests-local \
  --attribute-definitions \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=testId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=createdAt,AttributeType=N \
  --key-schema \
    AttributeName=tenantId,KeyType=HASH \
    AttributeName=testId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    "[{\"IndexName\":\"userId-createdAt-index\",\"KeySchema\":[{\"AttributeName\":\"userId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --endpoint-url http://localhost:8000

# Create TestResults table
aws dynamodb create-table \
  --table-name ai-testing-results-local \
  --attribute-definitions \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=resultId,AttributeType=S \
    AttributeName=testId,AttributeType=S \
    AttributeName=startTime,AttributeType=N \
  --key-schema \
    AttributeName=tenantId,KeyType=HASH \
    AttributeName=resultId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    "[{\"IndexName\":\"testId-startTime-index\",\"KeySchema\":[{\"AttributeName\":\"testId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"startTime\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --endpoint-url http://localhost:8000

# Create Environments table
aws dynamodb create-table \
  --table-name ai-testing-environments-local \
  --attribute-definitions \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=environment,AttributeType=S \
  --key-schema \
    AttributeName=tenantId,KeyType=HASH \
    AttributeName=environment,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

3. **List Local Tables:**

```bash
aws dynamodb list-tables --endpoint-url http://localhost:8000
```

4. **Update Lambda Environment Variables:**

Create `env.json`:
```json
{
  "AuthFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  },
  "TestGenerationFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  },
  "TestExecutionFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  },
  "StorageFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  },
  "ReportFunction": {
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  }
}
```

5. **Run SAM with Local DynamoDB:**

```bash
sam local start-api --env-vars env.json
```

### Option 2: Use AWS DynamoDB (Development Account)

Configure Lambda functions to use your AWS development account's DynamoDB tables:

```bash
# Ensure AWS credentials are configured
aws configure

# SAM will use your AWS credentials automatically
sam local start-api
```

## Local S3 Setup

### Option 1: LocalStack (Recommended)

LocalStack provides a local S3 implementation:

1. **Install LocalStack:**

```bash
# Using Docker
docker run -d -p 4566:4566 -p 4571:4571 localstack/localstack
```

2. **Create Local S3 Bucket:**

```bash
aws s3 mb s3://ai-testing-evidence-local \
  --endpoint-url http://localhost:4566
```

3. **Update Lambda Environment Variables:**

Add to `env.json`:
```json
{
  "TestExecutionFunction": {
    "S3_ENDPOINT": "http://host.docker.internal:4566",
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  },
  "StorageFunction": {
    "S3_ENDPOINT": "http://host.docker.internal:4566",
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  },
  "ReportFunction": {
    "S3_ENDPOINT": "http://host.docker.internal:4566",
    "DYNAMODB_ENDPOINT": "http://host.docker.internal:8000"
  }
}
```

### Option 2: Use AWS S3 (Development Account)

Use your AWS development account's S3 bucket:

```bash
# Create development bucket
aws s3 mb s3://ai-testing-evidence-dev

# SAM will use your AWS credentials automatically
sam local start-api
```

## NPM Scripts for SAM

Add these scripts to `package.json` for convenience:

```json
{
  "scripts": {
    "sam:validate": "sam validate",
    "sam:build": "npm run build && sam build",
    "sam:start": "npm run build && sam local start-api",
    "sam:start:debug": "npm run build && sam local start-api -d 5858",
    "sam:invoke:auth": "sam local invoke AuthFunction -e events/auth-login.json",
    "sam:invoke:testgen": "sam local invoke TestGenerationFunction -e events/test-generate.json",
    "sam:invoke:testexec": "sam local invoke TestExecutionFunction -e events/test-execute.json",
    "sam:logs": "sam logs -n AuthFunction --stack-name ai-testing-platform-dev --tail",
    "dynamodb:local": "docker run -p 8000:8000 amazon/dynamodb-local",
    "localstack:start": "docker run -d -p 4566:4566 -p 4571:4571 localstack/localstack",
    "local:setup": "npm run build && npm run dynamodb:local & npm run localstack:start",
    "local:dev": "npm run build && sam local start-api --env-vars env.json"
  }
}
```

## Testing Workflows

### 1. Complete Local Development Setup

```bash
# Terminal 1: Start DynamoDB Local
npm run dynamodb:local

# Terminal 2: Start LocalStack (S3)
npm run localstack:start

# Terminal 3: Create local tables (one-time setup)
./scripts/create-local-tables.sh

# Terminal 4: Start SAM API
npm run local:dev
```

### 2. Test Authentication Flow

```bash
# Register user
curl -X POST http://127.0.0.1:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "DevPass123!",
    "tenantId": "dev-tenant"
  }'

# Login and get JWT token
TOKEN=$(curl -X POST http://127.0.0.1:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "DevPass123!"
  }' | jq -r '.token')

echo "JWT Token: $TOKEN"
```

### 3. Test Test Generation

```bash
# Generate test (requires JWT token)
curl -X POST http://127.0.0.1:3000/tests/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "testPrompt": "Test login with valid credentials",
    "environment": "DEV"
  }'
```

### 4. Test Test Execution

```bash
# Execute test (requires testId from previous step)
curl -X POST http://127.0.0.1:3000/tests/{testId}/execute \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Docker Issues

**Problem:** "Cannot connect to Docker daemon"
```bash
# Solution: Ensure Docker Desktop is running
docker ps
```

**Problem:** "Port already in use"
```bash
# Solution: Stop conflicting containers
docker ps
docker stop <container-id>

# Or use different port
sam local start-api --port 3001
```

### Lambda Function Errors

**Problem:** "Module not found"
```bash
# Solution: Rebuild the project
npm run build
sam build
```

**Problem:** "Timeout after 30 seconds"
```bash
# Solution: Increase timeout in template.yaml
# Or use --timeout flag
sam local invoke AuthFunction -e events/auth-login.json --timeout 60
```

### DynamoDB Connection Issues

**Problem:** "Cannot connect to DynamoDB"
```bash
# Solution: Check DynamoDB Local is running
aws dynamodb list-tables --endpoint-url http://localhost:8000

# Verify env.json has correct endpoint
# Use host.docker.internal instead of localhost for Docker
```

### S3 Connection Issues

**Problem:** "Cannot connect to S3"
```bash
# Solution: Check LocalStack is running
aws s3 ls --endpoint-url http://localhost:4566

# Verify bucket exists
aws s3 mb s3://ai-testing-evidence-local --endpoint-url http://localhost:4566
```

### Memory Issues

**Problem:** "Lambda function out of memory"
```bash
# Solution: Increase MemorySize in template.yaml
# For Test Execution Lambda, use 2048 MB or higher
```

## Best Practices

### 1. Use Environment Variables

Store configuration in `env.json` instead of hardcoding:

```json
{
  "Parameters": {
    "NODE_ENV": "local",
    "LOG_LEVEL": "debug"
  }
}
```

### 2. Create Reusable Test Events

Store test events in `events/` directory:
- `events/auth-register.json`
- `events/auth-login.json`
- `events/test-generate.json`
- `events/test-execute.json`

### 3. Use Docker Compose

Create `docker-compose.yml` for local services:

```yaml
version: '3.8'
services:
  dynamodb:
    image: amazon/dynamodb-local
    ports:
      - "8000:8000"
  
  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"
      - "4571:4571"
    environment:
      - SERVICES=s3,sns
```

Start all services:
```bash
docker-compose up -d
```

### 4. Automate Table Creation

Create `scripts/create-local-tables.sh` to automate DynamoDB table creation.

### 5. Use SAM Build

For complex dependencies:
```bash
sam build
sam local start-api
```

## Performance Optimization

### 1. Skip Pulling Docker Images

```bash
sam local start-api --skip-pull-image
```

### 2. Use Warm Containers

```bash
sam local start-api --warm-containers EAGER
```

### 3. Layer Caching

Use Lambda layers for shared dependencies to reduce cold start time.

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: SAM Local Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build project
        run: npm run build
      
      - name: Setup SAM CLI
        uses: aws-actions/setup-sam@v2
      
      - name: Start DynamoDB Local
        run: docker run -d -p 8000:8000 amazon/dynamodb-local
      
      - name: Create local tables
        run: ./scripts/create-local-tables.sh
      
      - name: Run SAM local tests
        run: |
          sam local invoke AuthFunction -e events/auth-login.json
          sam local invoke TestGenerationFunction -e events/test-generate.json
```

## Additional Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [SAM CLI Command Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
- [DynamoDB Local Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS Lambda Local Testing](https://docs.aws.amazon.com/lambda/latest/dg/testing-functions.html)

## Next Steps

1. Set up local DynamoDB and S3 using Docker
2. Create sample test events in `events/` directory
3. Test each Lambda function individually
4. Test complete workflows end-to-end
5. Configure debugging in your IDE
6. Integrate SAM local testing into CI/CD pipeline
