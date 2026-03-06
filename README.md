# AI-Powered Automated Testing SaaS Platform

An intelligent, scalable testing platform that combines AI-driven test generation with automated UI testing for Social Media Poster applications.

## Overview

This platform leverages Amazon Bedrock (Claude 3.5 Sonnet) for intelligent test case generation and Playwright on AWS Lambda for scalable UI automation. It's designed to reduce manual QA effort by 70-80% while providing enterprise-ready multi-tenant capabilities with comprehensive test evidence storage and automated notifications.

## Key Features

- **AI-Powered Test Generation**: Natural language test prompts automatically converted to executable test scripts using Claude 3.5 Sonnet
- **Automated UI Testing**: Playwright-based test execution on AWS Lambda with screenshot capture and detailed logging
- **Multi-Tenant Architecture**: Secure tenant isolation with encrypted data storage and access controls
- **Comprehensive Evidence Storage**: All test results, screenshots, and logs stored in S3 with presigned URL access
- **Real-Time Notifications**: Instant test result notifications via SNS/n8n integration
- **Environment Management**: Support for Dev, Staging, and Production test environments
- **Scalable Infrastructure**: Serverless architecture supporting 100+ concurrent test executions
- **Enterprise Security**: JWT authentication, encrypted data at rest, and IAM-based access control

## Architecture

The platform uses a serverless microservices architecture on AWS:

- **API Gateway**: HTTPS endpoints with JWT validation and rate limiting
- **Lambda Functions**: Auth, Test Generation, Test Execution, Storage, and Reporting services
- **Amazon Bedrock**: Claude 3.5 Sonnet for AI-powered test generation
- **DynamoDB**: Multi-tenant data storage with encryption at rest
- **S3**: Test evidence storage (screenshots, logs, reports)
- **SNS/n8n**: Notification delivery system
- **CloudWatch**: Comprehensive logging, metrics, and monitoring

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Infrastructure**: AWS CDK or Terraform
- **Testing Framework**: Playwright for UI automation
- **AI Model**: Amazon Bedrock (Claude 3.5 Sonnet)
- **Database**: DynamoDB
- **Storage**: S3
- **Authentication**: JWT tokens with bcrypt password hashing
- **Testing**: Jest for unit and integration tests

## Project Structure

```
.
├── src/
│   ├── lambdas/
│   │   ├── auth/              # Authentication Lambda
│   │   ├── authorizer/        # JWT authorizer Lambda
│   │   ├── testgen/           # Test generation Lambda
│   │   ├── testexec/          # Test execution Lambda
│   │   ├── storage/           # Storage management Lambda
│   │   └── report/            # Report generation Lambda
│   └── shared/
│       ├── config/            # Configuration management
│       ├── types/             # TypeScript type definitions
│       └── utils/             # Shared utilities
├── infrastructure/            # AWS CDK infrastructure code
│   ├── bin/
│   │   └── app.ts            # CDK app entry point
│   ├── lib/
│   │   ├── ai-testing-platform-stack.ts  # Main stack
│   │   └── stacks/           # Individual resource stacks
│   │       ├── dynamodb-stack.ts
│   │       ├── s3-stack.ts
│   │       ├── lambda-stack.ts
│   │       ├── api-gateway-stack.ts
│   │       ├── notification-stack.ts
│   │       └── monitoring-stack.ts
│   └── test/                 # Infrastructure tests
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
├── events/                   # SAM local test events
├── scripts/                  # Setup and utility scripts
├── config/                   # Environment configurations
├── docs/                     # Documentation
│   ├── LOCAL_DEV_QUICKSTART.md
│   ├── SAM_LOCAL_DEVELOPMENT.md
│   ├── INFRASTRUCTURE_DEPLOYMENT.md
│   └── TESTING_SETUP.md
├── template.yaml             # AWS SAM template
├── docker-compose.yml        # Local services (DynamoDB, S3)
└── env.json                  # Local environment variables
```

## Getting Started

### Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK or Terraform installed
- Docker (for local testing with AWS SAM)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ai-testing-automation-platform

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your AWS credentials and configuration
```

### Infrastructure Deployment

The platform uses AWS CDK for infrastructure as code. See [Infrastructure Deployment Guide](docs/INFRASTRUCTURE_DEPLOYMENT.md) for detailed instructions.

**Important**: Before deploying, you must build the Playwright Lambda Layer. See [Playwright Layer Setup](docs/PLAYWRIGHT_LAYER_SETUP.md).

Quick start:

```bash
# Install AWS CDK globally
npm install -g aws-cdk

# Build the Playwright Lambda Layer (required for test execution)
cd layers/playwright
chmod +x build-layer.sh
./build-layer.sh
cd ../..

# Bootstrap CDK (one-time per account/region)
cdk bootstrap aws://ACCOUNT-ID/REGION

# Build Lambda code
npm run build

# Deploy to development environment
npm run cdk:deploy:dev
```

After deployment, note the API endpoint URL from the CDK outputs.

### Local Development with AWS SAM

For local development and testing without deploying to AWS:

```bash
# Quick setup (starts local services and creates tables)
npm run local:setup

# Start local API Gateway
npm run local:dev
```

The local API will be available at `http://127.0.0.1:3000`.

See the [Local Development Quick Start Guide](docs/LOCAL_DEV_QUICKSTART.md) for detailed instructions.

### Development

```bash
# Run tests
npm test

# Run linting
npm run lint

# Build the project
npm run build

# Deploy to dev environment
npm run deploy:dev
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Authenticate and receive JWT token

### Test Management
- `POST /tests/generate` - Generate test from natural language prompt
- `POST /tests/{testId}/execute` - Execute a test
- `GET /tests/{testId}/results/{resultId}` - Get test result details
- `GET /tests/results` - List test results with filtering

### Reports
- `GET /reports/{resultId}` - Generate comprehensive test report

### Environment Configuration
- `POST /environments` - Create environment configuration
- `GET /environments/{environment}` - Get environment details
- `PUT /environments/{environment}` - Update environment
- `DELETE /environments/{environment}` - Delete environment

## Security

- All API endpoints use HTTPS only
- JWT token-based authentication with 1-hour expiration
- Password hashing using bcrypt (cost factor 10)
- DynamoDB and S3 encryption at rest
- Tenant isolation enforced at all data access points
- IAM roles with least privilege principle
- Secrets stored in AWS Secrets Manager

## Monitoring

The platform includes comprehensive monitoring:

- CloudWatch Logs for all Lambda functions (30-day retention)
- Custom metrics for test execution duration, success rate, and API latency
- CloudWatch alarms for failure rates and errors
- Real-time dashboards for system health and performance

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## Deployment

The platform supports three environments with AWS CDK:

- **Dev**: Development and testing
- **Staging**: Pre-production validation
- **Production**: Live customer environment

### Deploy Infrastructure

```bash
# Development
npm run cdk:deploy:dev

# Staging
npm run cdk:deploy:staging

# Production (requires approval)
npm run cdk:deploy:prod
```

### Deploy with Email Notifications

```bash
cd infrastructure
cdk deploy \
  --context environment=dev \
  --context notificationEmail=your-email@example.com \
  --context alarmEmail=admin@example.com
```

### View Infrastructure Changes

```bash
npm run cdk:diff
```

### Destroy Environment

```bash
npm run cdk:destroy:dev
```

For detailed deployment instructions, see [Infrastructure Deployment Guide](docs/INFRASTRUCTURE_DEPLOYMENT.md).

## Documentation

### Setup Guides

- [Infrastructure Deployment](docs/INFRASTRUCTURE_DEPLOYMENT.md) - Complete CDK deployment guide
- [AWS Setup Guide](docs/AWS_SETUP_GUIDE.md) - Initial AWS account configuration
- [Local Development Quick Start](docs/LOCAL_DEV_QUICKSTART.md) - Get started with local development
- [SAM Local Development](docs/SAM_LOCAL_DEVELOPMENT.md) - Detailed SAM local setup

### Component Setup

- [DynamoDB Setup](docs/DYNAMODB_SETUP.md) - Database table configuration
- [S3 Setup](docs/S3_SETUP.md) - Storage bucket configuration
- [API Gateway Setup](docs/API_GATEWAY_SETUP.md) - API configuration
- [CloudWatch Setup](docs/CLOUDWATCH_SETUP.md) - Monitoring and logging
- [Secrets Manager Setup](docs/SECRETS_MANAGER_SETUP.md) - Secrets configuration
- [Encryption Setup](docs/ENCRYPTION_SETUP.md) - Data encryption configuration
- [Playwright Layer Setup](docs/PLAYWRIGHT_LAYER_SETUP.md) - Playwright Lambda layer

### Notification Setup

- [SNS Email Subscription Quick Start](docs/SNS_EMAIL_SUBSCRIPTION_QUICKSTART.md) - **Quick guide to configure email notifications**
- [SNS Notification Setup](docs/SNS_NOTIFICATION_SETUP.md) - Comprehensive notification configuration guide
- [n8n Integration Quick Start](docs/N8N_QUICKSTART.md) - **Quick guide to integrate n8n webhooks (5 minutes)**
- [n8n Webhook Setup](docs/N8N_WEBHOOK_SETUP.md) - Comprehensive n8n webhook integration guide
- [n8n Workflow Examples](docs/n8n-workflow-examples/) - Ready-to-use n8n workflow templates

### Architecture

- [Project Structure](docs/PROJECT_STRUCTURE.md) - Codebase organization
- [Testing Setup](docs/TESTING_SETUP.md) - Testing framework and guidelines

## Contributing

1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Ensure all tests pass and code meets quality standards
4. Submit a pull request with detailed description

## License

[License information to be added]

## Support

For issues, questions, or feature requests, please contact the development team or create an issue in the repository.

## Roadmap

Future enhancements planned:
- Support for additional test frameworks (Selenium, Cypress)
- Parallel test execution
- Test scheduling and recurring tests
- Advanced reporting with charts and trends
- CI/CD pipeline integration
- Mobile app testing support
- AI-powered test maintenance and healing
