# Jest Testing Framework Setup

## Overview

The Jest testing framework has been successfully configured for the AI-Powered Automated Testing Platform. The setup supports TypeScript, provides comprehensive coverage reporting, and organizes tests into three categories: unit, integration, and end-to-end (e2e).

## What Was Configured

### 1. Jest Configuration (`jest.config.js`)

- **TypeScript Support**: Configured with `ts-jest` preset for seamless TypeScript testing
- **Test Environment**: Node.js environment suitable for AWS Lambda functions
- **Test Discovery**: Automatically finds tests in `tests/` directory and `*.test.ts` files in `src/`
- **Coverage Configuration**:
  - Collects coverage from all `src/**/*.ts` files
  - Excludes type definitions, test files, and barrel exports
  - Generates reports in text, lcov, html, and json formats
  - Sets 80% coverage threshold for all metrics
- **Module Path Mapping**: Configured aliases for cleaner imports
  - `@/` → `src/`
  - `@shared/` → `src/shared/`
  - `@lambdas/` → `src/lambdas/`
- **Test Projects**: Separate configurations for unit, integration, and e2e tests
- **Timeouts**: 5-minute timeout for e2e tests, 30 seconds for others

### 2. Test Setup (`tests/setup.ts`)

Global setup file that runs before each test:
- Sets `NODE_ENV` to `test`
- Mocks AWS SDK clients (DynamoDB, S3, SNS, Bedrock, Secrets Manager)
- Configures 30-second timeout for async operations
- Suppresses console.log output while keeping error and warn messages

### 3. Test Directory Structure

```
tests/
├── unit/                    # Unit tests
│   └── sample.test.ts      # Sample unit test demonstrating Jest features
├── integration/            # Integration tests
│   └── sample.test.ts      # Sample integration test
├── e2e/                    # End-to-end tests
│   └── sample.test.ts      # Sample e2e test
├── helpers/                # Test utilities
│   └── testUtils.ts        # Common helper functions
├── setup.ts                # Jest setup file
└── README.md               # Testing guide and best practices
```

### 4. Test Utilities (`tests/helpers/testUtils.ts`)

Provides common helper functions:
- `createMockContext()`: AWS Lambda context
- `createMockAPIGatewayEvent()`: API Gateway event
- `createMockDynamoDBItem()`: DynamoDB item formatter
- `createMockJWTPayload()`: JWT token payload
- `createMockTestScript()`: Test script object
- `createMockTestResult()`: Test result object
- `waitFor()`: Async condition waiter
- `delay()`: Promise-based delay

### 5. NPM Scripts

Added the following test commands to `package.json`:

```json
{
  "test": "jest",                                    // Run all tests
  "test:watch": "jest --watch",                      // Watch mode
  "test:unit": "jest --selectProjects unit",         // Unit tests only
  "test:integration": "jest --selectProjects integration", // Integration tests only
  "test:e2e": "jest --selectProjects e2e",          // E2E tests only
  "test:coverage": "jest --coverage",                // With coverage report
  "test:ci": "jest --ci --coverage --maxWorkers=2"   // CI/CD optimized
}
```

### 6. Sample Tests

Created sample tests demonstrating:
- Basic Jest assertions and matchers
- Async/await testing
- Promise testing
- Mocking functions and implementations
- TypeScript interface and type support
- Error handling
- Module integration
- Complete workflow simulation

## Verification

All tests pass successfully:

```
Test Suites: 3 passed, 3 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        ~10s
```

## Usage Examples

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm run test:unit
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Watch Mode for Development
```bash
npm run test:watch
```

## Coverage Reporting

Coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html`: HTML coverage report (open in browser)
- `coverage/lcov.info`: LCOV format for CI/CD tools
- `coverage/coverage-final.json`: JSON format for programmatic access

## Next Steps

1. **Write Unit Tests**: Create tests for individual Lambda functions and utilities
2. **Write Integration Tests**: Test interactions between services (DynamoDB, S3, etc.)
3. **Write E2E Tests**: Test complete workflows from API Gateway to notifications
4. **Property-Based Tests**: Implement property-based tests for correctness properties defined in the design document
5. **CI/CD Integration**: Add test execution to deployment pipeline

## Key Features

✅ TypeScript support with ts-jest  
✅ Separate test projects (unit, integration, e2e)  
✅ Comprehensive coverage reporting  
✅ AWS SDK mocking configured  
✅ Test utilities and helpers  
✅ Sample tests for reference  
✅ Detailed documentation  
✅ CI/CD ready with `test:ci` command  
✅ Path aliases for cleaner imports  
✅ Proper timeout configuration  

## Documentation

- **Testing Guide**: `tests/README.md` - Comprehensive guide with examples and best practices
- **This Document**: `docs/TESTING_SETUP.md` - Setup summary and configuration details

## Dependencies

The following packages are installed and configured:

- `jest@^29.7.0`: Testing framework
- `ts-jest@^29.1.1`: TypeScript preprocessor for Jest
- `@types/jest@^29.5.11`: TypeScript type definitions for Jest

All dependencies are already in `package.json` and installed via `npm install`.
