# Setup Guide

This guide will help you set up the AI-powered automated testing platform development environment.

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- AWS CLI configured with appropriate credentials
- Git

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

This will install all production and development dependencies including:
- AWS SDK v3 packages
- TypeScript and type definitions
- Playwright for browser automation
- Jest for testing
- ESLint and Prettier for code quality

### 2. Verify TypeScript Configuration

```bash
npm run build
```

This compiles TypeScript files from `src/` to `dist/` directory.

### 3. Run Linting

```bash
npm run lint
```

Checks code for style and potential issues.

### 4. Format Code

```bash
npm run format
```

Automatically formats all TypeScript files according to Prettier rules.

### 5. Run Tests

```bash
npm test
```

Runs the Jest test suite (currently no tests implemented).

## Project Structure

The project is organized as follows:

- **src/lambdas/**: Lambda function handlers for each service
  - auth: User authentication and JWT management
  - authorizer: API Gateway Lambda Authorizer
  - test-generation: AI-powered test generation with Bedrock
  - test-execution: Playwright-based test execution
  - storage: DynamoDB and S3 operations
  - report: Test report generation

- **src/shared/**: Shared code and utilities
  - types: TypeScript interfaces and types
  - utils: Validation, response helpers, and logging

- **tests/**: Test suites (unit, integration, e2e)

- **config/**: Environment-specific configurations (dev, staging, prod)

- **infrastructure/**: Infrastructure as Code (to be implemented in task 2.3)

## Next Steps

1. **Task 2.3**: Configure AWS CDK or Terraform for Infrastructure as Code
2. **Task 2.4**: Set up local development environment with AWS SAM
3. **Task 2.5**: Configure ESLint and Prettier (already done)
4. **Task 2.6**: Set up testing framework (Jest already configured)
5. **Task 2.7**: Create environment configuration files (already done)

## Development Workflow

1. Create a new branch for your feature
2. Write code in `src/` directory
3. Write tests in `tests/` directory
4. Run `npm run lint` to check code quality
5. Run `npm test` to verify tests pass
6. Run `npm run build` to compile TypeScript
7. Commit and push changes

## Environment Configuration

Environment-specific settings are stored in `config/`:
- `dev.json`: Development environment
- `staging.json`: Staging environment
- `prod.json`: Production environment

Each configuration includes:
- DynamoDB table names
- S3 bucket names
- Bedrock model settings
- JWT configuration
- Lambda resource limits

## AWS Services Used

- **Lambda**: Serverless compute for all services
- **API Gateway**: REST API endpoints
- **DynamoDB**: NoSQL database for users, tests, and results
- **S3**: Object storage for screenshots and logs
- **Bedrock**: AI service for test generation (Claude 3.5 Sonnet)
- **SNS**: Notification service
- **CloudWatch**: Logging and monitoring
- **Secrets Manager**: Secure credential storage

## Troubleshooting

### TypeScript Compilation Errors

If you encounter TypeScript errors during build:
1. Ensure all dependencies are installed: `npm install`
2. Check `tsconfig.json` for correct configuration
3. Verify Node.js version: `node --version` (should be 18.x+)

### Linting Errors

If ESLint reports errors:
1. Run `npm run format` to auto-fix formatting issues
2. Review and fix remaining issues manually
3. Check `.eslintrc.json` for rule configuration

### Test Failures

If tests fail:
1. Ensure all dependencies are installed
2. Check Jest configuration in `jest.config.js`
3. Review test output for specific error messages

## Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
