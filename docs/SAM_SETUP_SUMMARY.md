# AWS SAM Local Development Setup - Summary

This document summarizes the AWS SAM local development environment setup completed for the AI-powered automated testing platform.

## What Was Created

### 1. SAM Template (`template.yaml`)

A complete AWS SAM template defining:
- **6 Lambda Functions**: Auth, Authorizer, Test Generation, Test Execution, Storage, and Report
- **4 DynamoDB Tables**: Users, Tests, TestResults, and Environments
- **1 S3 Bucket**: For test evidence storage
- **API Gateway Routes**: All REST API endpoints with proper Lambda integrations
- **IAM Policies**: Appropriate permissions for each Lambda function

### 2. Documentation

#### `docs/SAM_LOCAL_DEVELOPMENT.md` (Comprehensive Guide)
- Complete SAM CLI installation instructions
- Local DynamoDB setup with DynamoDB Local
- Local S3 setup with LocalStack
- Debugging configurations for VS Code and Chrome DevTools
- Testing workflows and best practices
- Troubleshooting guide
- CI/CD integration examples

#### `docs/LOCAL_DEV_QUICKSTART.md` (Quick Start)
- 5-minute setup guide
- Essential commands for daily development
- Common development tasks
- Quick troubleshooting tips

#### `events/README.md`
- Documentation for test event files
- How to create custom events
- Event structure reference

### 3. Docker Compose Configuration (`docker-compose.yml`)

Services included:
- **DynamoDB Local**: Local DynamoDB instance on port 8000
- **LocalStack**: Local S3 and SNS on port 4566
- **DynamoDB Admin**: Web UI for viewing tables on port 8001

Features:
- Persistent data volumes
- Automatic service networking
- Easy start/stop with npm scripts

### 4. Setup Scripts

#### `scripts/create-local-tables.sh`
Bash script to create all DynamoDB tables locally with:
- Correct attribute definitions
- Primary keys and sort keys
- Global secondary indexes
- Proper billing mode

#### `scripts/create-local-s3.sh`
Bash script to create the S3 evidence bucket in LocalStack.

### 5. Test Events (`events/`)

Sample event files for testing:
- `auth-register.json` - User registration
- `auth-login.json` - User login
- `test-generate.json` - Test generation
- `test-execute.json` - Test execution

### 6. Environment Configuration (`env.json`)

Local environment variables for all Lambda functions:
- DynamoDB endpoint configuration
- S3 endpoint configuration
- JWT secrets for local development
- Debug logging enabled
- Table and bucket names

### 7. NPM Scripts (Updated `package.json`)

New scripts added:
- `sam:validate` - Validate SAM template
- `sam:build` - Build SAM application
- `sam:start` - Start local API Gateway
- `sam:start:debug` - Start with debugging enabled
- `sam:start:env` - Start with environment variables
- `sam:invoke:auth` - Test auth Lambda
- `sam:invoke:testgen` - Test generation Lambda
- `sam:invoke:testexec` - Test execution Lambda
- `docker:up` - Start Docker services
- `docker:down` - Stop Docker services
- `docker:logs` - View Docker logs
- `local:setup` - Complete local setup (one command)
- `local:dev` - Start local development environment
- `local:clean` - Clean all local data

## How to Use

### First Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Start local services and create tables
npm run local:setup

# 3. Start SAM local API
npm run local:dev
```

### Daily Development

```bash
# Start Docker services (if not running)
npm run docker:up

# Start local API
npm run local:dev

# In another terminal, test endpoints
curl -X POST http://127.0.0.1:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"Pass123!","tenantId":"dev"}'
```

### Debugging

```bash
# Start in debug mode
npm run sam:start:debug

# Attach debugger to port 5858
```

## Architecture

### Local Services

```
┌─────────────────────────────────────────────────────────┐
│                    Developer Machine                     │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         SAM Local API Gateway                  │    │
│  │         http://127.0.0.1:3000                  │    │
│  └──────────────┬─────────────────────────────────┘    │
│                 │                                        │
│                 ├──> Auth Lambda                        │
│                 ├──> Test Generation Lambda            │
│                 ├──> Test Execution Lambda             │
│                 ├──> Storage Lambda                     │
│                 └──> Report Lambda                      │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Docker Compose Services                │    │
│  │                                                 │    │
│  │  ┌──────────────────────────────────────┐     │    │
│  │  │  DynamoDB Local (port 8000)          │     │    │
│  │  │  - Users table                       │     │    │
│  │  │  - Tests table                       │     │    │
│  │  │  - TestResults table                 │     │    │
│  │  │  - Environments table                │     │    │
│  │  └──────────────────────────────────────┘     │    │
│  │                                                 │    │
│  │  ┌──────────────────────────────────────┐     │    │
│  │  │  LocalStack (port 4566)              │     │    │
│  │  │  - S3 (evidence bucket)              │     │    │
│  │  │  - SNS (notifications)               │     │    │
│  │  └──────────────────────────────────────┘     │    │
│  │                                                 │    │
│  │  ┌──────────────────────────────────────┐     │    │
│  │  │  DynamoDB Admin (port 8001)          │     │    │
│  │  │  - Web UI for table management       │     │    │
│  │  └──────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Benefits

### 1. Cost Savings
- No AWS charges during development
- Test unlimited times locally
- No data transfer costs

### 2. Speed
- Instant feedback loop
- No deployment wait times
- Fast iteration cycles

### 3. Offline Development
- Work without internet connection
- No AWS account required for basic testing
- Consistent development environment

### 4. Debugging
- Set breakpoints in Lambda code
- Step through execution
- Inspect variables and state

### 5. Testing
- Test all endpoints locally
- Validate before deployment
- Catch errors early

## Limitations

### What Works Locally

✅ Lambda function execution
✅ API Gateway routing
✅ DynamoDB operations
✅ S3 operations
✅ JWT authentication
✅ Request/response validation
✅ Error handling
✅ Logging

### What Requires AWS

❌ Amazon Bedrock (AI test generation)
❌ SNS notifications (can use LocalStack)
❌ CloudWatch metrics
❌ Secrets Manager
❌ IAM role assumption
❌ VPC networking

### Workarounds

For features requiring AWS:
1. **Bedrock**: Mock the Bedrock client or use AWS credentials
2. **SNS**: Use LocalStack SNS or mock notifications
3. **CloudWatch**: Use console.log for local logging
4. **Secrets Manager**: Use environment variables

## Testing Strategy

### Unit Tests
Run with Jest (no SAM required):
```bash
npm run test:unit
```

### Integration Tests (Local)
Test Lambda functions with SAM:
```bash
npm run sam:invoke:auth
npm run sam:invoke:testgen
```

### Integration Tests (AWS)
Test with real AWS services:
```bash
# Remove local endpoints from env.json
npm run sam:start:env
```

### End-to-End Tests
Test complete workflows:
```bash
# Start local environment
npm run local:dev

# Run E2E tests
npm run test:e2e
```

## Maintenance

### Updating Lambda Functions

1. Modify code in `src/lambdas/`
2. Rebuild: `npm run build`
3. Test: `npm run local:dev`

### Updating SAM Template

1. Edit `template.yaml`
2. Validate: `sam validate` (requires SAM CLI)
3. Test: `npm run local:dev`

### Updating Environment Variables

1. Edit `env.json`
2. Restart SAM: `npm run local:dev`

### Cleaning Up

```bash
# Stop services
npm run docker:down

# Remove all data
npm run local:clean

# Rebuild from scratch
npm run local:setup
```

## Troubleshooting

### Common Issues

1. **Docker not running**: Start Docker Desktop
2. **Port conflicts**: Change ports in docker-compose.yml
3. **Module not found**: Run `npm run build`
4. **Tables not found**: Run `./scripts/create-local-tables.sh`
5. **Bucket not found**: Run `./scripts/create-local-s3.sh`

See [SAM_LOCAL_DEVELOPMENT.md](./SAM_LOCAL_DEVELOPMENT.md#troubleshooting) for detailed troubleshooting.

## Next Steps

1. **Install SAM CLI**: Follow [installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
2. **Install Docker**: Download [Docker Desktop](https://www.docker.com/products/docker-desktop)
3. **Run Setup**: Execute `npm run local:setup`
4. **Start Development**: Run `npm run local:dev`
5. **Test Endpoints**: Use curl or Postman
6. **Configure Debugging**: Set up VS Code launch configuration

## Resources

- [SAM Local Development Guide](./SAM_LOCAL_DEVELOPMENT.md) - Comprehensive guide
- [Quick Start Guide](./LOCAL_DEV_QUICKSTART.md) - Get started in 5 minutes
- [Events README](../events/README.md) - Test event documentation
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
- [LocalStack](https://docs.localstack.cloud/)

## Conclusion

The AWS SAM local development environment is now fully configured and ready for use. Developers can:

- Test Lambda functions locally without AWS deployment
- Debug with breakpoints and step-through execution
- Iterate quickly with instant feedback
- Reduce development costs significantly
- Work offline when needed

All necessary documentation, scripts, and configurations are in place for a smooth local development experience.
