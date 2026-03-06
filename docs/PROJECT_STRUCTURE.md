# Project Structure

This document describes the organization of the AI-powered automated testing platform codebase.

## Directory Structure

```
ai-testing-automation-platform/
├── src/                          # Source code
│   ├── lambdas/                  # Lambda function handlers
│   │   ├── auth/                 # Authentication service
│   │   ├── authorizer/           # API Gateway Lambda Authorizer
│   │   ├── test-generation/      # AI test generation service
│   │   ├── test-execution/       # Playwright test execution
│   │   ├── storage/              # DynamoDB and S3 operations
│   │   └── report/               # Report generation service
│   └── shared/                   # Shared code and utilities
│       ├── types/                # TypeScript type definitions
│       └── utils/                # Utility functions
│           ├── validation.ts     # Input validation
│           ├── response.ts       # API response helpers
│           └── logger.ts         # Structured logging
├── tests/                        # Test suites
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── e2e/                      # End-to-end tests
├── config/                       # Environment configurations
│   ├── dev.json                  # Development environment
│   ├── staging.json              # Staging environment
│   └── prod.json                 # Production environment
├── infrastructure/               # Infrastructure as Code
│   └── README.md                 # IaC setup instructions
├── docs/                         # Documentation
│   └── PROJECT_STRUCTURE.md      # This file
├── dist/                         # Compiled JavaScript (generated)
├── coverage/                     # Test coverage reports (generated)
├── node_modules/                 # Dependencies (generated)
├── package.json                  # Node.js dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── jest.config.js                # Jest testing configuration
├── .eslintrc.json                # ESLint configuration
├── .prettierrc.json              # Prettier configuration
├── .gitignore                    # Git ignore rules
└── README.md                     # Project overview
```

## Lambda Functions

### Auth Lambda (`src/lambdas/auth/`)
- User registration and login
- Password hashing with bcrypt
- JWT token generation
- User management operations

### Authorizer Lambda (`src/lambdas/authorizer/`)
- API Gateway Lambda Authorizer
- JWT token validation
- IAM policy generation
- Tenant context extraction

### Test Generation Lambda (`src/lambdas/test-generation/`)
- Receives test prompts from users
- Integrates with Amazon Bedrock (Claude 3.5 Sonnet)
- Validates generated test scripts
- Stores tests in DynamoDB

### Test Execution Lambda (`src/lambdas/test-execution/`)
- Initializes Playwright browser
- Executes test steps sequentially
- Captures screenshots and logs
- Handles errors and timeouts
- Stores results in DynamoDB and S3

### Storage Lambda (`src/lambdas/storage/`)
- DynamoDB CRUD operations
- S3 upload/download operations
- Presigned URL generation
- Tenant isolation enforcement

### Report Lambda (`src/lambdas/report/`)
- Test report generation
- Result aggregation
- Evidence URL generation

## Shared Code

### Types (`src/shared/types/`)
- User, Test, TestResult interfaces
- TestScript and TestStep definitions
- Environment configuration types
- JWT payload structure

### Utilities (`src/shared/utils/`)
- **validation.ts**: Input validation functions
- **response.ts**: API Gateway response helpers
- **logger.ts**: Structured CloudWatch logging

## Configuration

Environment-specific configurations are stored in `config/`:
- **dev.json**: Development environment settings
- **staging.json**: Staging environment settings
- **prod.json**: Production environment settings

Each configuration includes:
- DynamoDB table names
- S3 bucket names
- Bedrock model configuration
- JWT settings
- Lambda resource limits

## Testing

Tests are organized by type:
- **Unit tests**: Test individual functions and modules
- **Integration tests**: Test service interactions
- **E2E tests**: Test complete workflows

## Build and Development

### Available Scripts

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format

# Clean build artifacts
npm run clean
```

## Dependencies

### Production Dependencies
- **AWS SDK v3**: DynamoDB, S3, Bedrock, SNS, Secrets Manager
- **Playwright**: Browser automation for UI testing
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT token generation and validation
- **uuid**: Unique identifier generation

### Development Dependencies
- **TypeScript**: Type-safe JavaScript
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **ts-jest**: TypeScript support for Jest

## Next Steps

1. Install dependencies: `npm install`
2. Configure AWS CDK or Terraform (Task 2.3)
3. Set up local development environment with AWS SAM (Task 2.4)
4. Begin implementing Lambda functions (Phase 2+)
