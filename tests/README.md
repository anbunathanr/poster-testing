# Testing Guide

This document describes the testing setup and best practices for the AI-Powered Automated Testing Platform.

## Testing Framework

We use **Jest** with **ts-jest** for TypeScript support. The testing framework is configured to support three types of tests:

- **Unit Tests**: Test individual functions, classes, and modules in isolation
- **Integration Tests**: Test interactions between multiple modules and services
- **End-to-End (E2E) Tests**: Test complete workflows from start to finish

## Project Structure

```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── e2e/              # End-to-end tests
├── helpers/          # Test utilities and helpers
│   └── testUtils.ts  # Common test helper functions
├── setup.ts          # Jest setup file (runs before each test)
└── README.md         # This file
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm run test:unit
```

### Run Integration Tests Only
```bash
npm run test:integration
```

### Run E2E Tests Only
```bash
npm run test:e2e
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Run Tests in CI Mode
```bash
npm run test:ci
```

## Configuration

### Jest Configuration (`jest.config.js`)

The Jest configuration includes:

- **TypeScript Support**: Uses `ts-jest` preset for TypeScript transformation
- **Test Environment**: Node.js environment for Lambda functions
- **Coverage Thresholds**: 80% coverage target for branches, functions, lines, and statements
- **Module Name Mapping**: Path aliases for cleaner imports
  - `@/` → `src/`
  - `@shared/` → `src/shared/`
  - `@lambdas/` → `src/lambdas/`
- **Projects**: Separate configurations for unit, integration, and e2e tests
- **Timeouts**: 5-minute timeout for e2e tests, 30 seconds for others

### Test Setup (`tests/setup.ts`)

The setup file runs before each test and:

- Sets `NODE_ENV` to `test`
- Mocks AWS SDK clients by default
- Configures test timeouts
- Suppresses console.log output (keeps error and warn)

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/auth/passwordHash.test.ts
import { hashPassword, verifyPassword } from '@/lambdas/auth/passwordHash';

describe('Password Hashing', () => {
  it('should hash a password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
  });

  it('should verify a correct password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword('WrongPassword', hash);
    
    expect(isValid).toBe(false);
  });
});
```

### Integration Test Example

```typescript
// tests/integration/auth/authFlow.test.ts
import { handler as registerHandler } from '@/lambdas/auth/register';
import { handler as loginHandler } from '@/lambdas/auth/login';
import { createMockAPIGatewayEvent, createMockContext } from '@/tests/helpers/testUtils';

describe('Authentication Flow', () => {
  it('should register and login a user', async () => {
    // Register user
    const registerEvent = createMockAPIGatewayEvent({
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      }),
    });
    
    const registerResult = await registerHandler(registerEvent, createMockContext());
    expect(registerResult.statusCode).toBe(201);
    
    // Login user
    const loginEvent = createMockAPIGatewayEvent({
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123!',
      }),
    });
    
    const loginResult = await loginHandler(loginEvent, createMockContext());
    expect(loginResult.statusCode).toBe(200);
    
    const loginBody = JSON.parse(loginResult.body);
    expect(loginBody.token).toBeDefined();
  });
});
```

### E2E Test Example

```typescript
// tests/e2e/testWorkflow.test.ts
describe('Complete Test Workflow', () => {
  it('should execute a complete test from generation to notification', async () => {
    // 1. Authenticate
    const authToken = await authenticateUser('test@example.com', 'password');
    
    // 2. Generate test
    const testScript = await generateTest(authToken, 'Test login functionality');
    expect(testScript.testId).toBeDefined();
    
    // 3. Execute test
    const result = await executeTest(authToken, testScript.testId);
    expect(result.status).toBe('PASS');
    
    // 4. Verify storage
    const storedResult = await getTestResult(authToken, result.resultId);
    expect(storedResult.screenshots).toHaveLength(6);
    
    // 5. Verify notification was sent
    // (Check SNS mock or notification service)
  });
});
```

## Test Utilities

The `tests/helpers/testUtils.ts` file provides common utilities:

- `createMockContext()`: Creates a mock AWS Lambda context
- `createMockAPIGatewayEvent()`: Creates a mock API Gateway event
- `createMockDynamoDBItem()`: Creates a mock DynamoDB item
- `createMockJWTPayload()`: Creates a mock JWT token payload
- `createMockTestScript()`: Creates a mock test script
- `createMockTestResult()`: Creates a mock test result
- `waitFor()`: Waits for a condition to be true
- `delay()`: Creates a delay promise

## Best Practices

### 1. Test Naming
- Use descriptive test names that explain what is being tested
- Follow the pattern: "should [expected behavior] when [condition]"
- Example: `should return 401 when JWT token is expired`

### 2. Test Organization
- Group related tests using `describe` blocks
- Keep tests focused on a single behavior
- Use `beforeEach` and `afterEach` for setup and teardown

### 3. Mocking
- Mock external dependencies (AWS SDK, databases, APIs)
- Use Jest's built-in mocking capabilities
- Reset mocks between tests using `jest.clearAllMocks()`

### 4. Assertions
- Use specific matchers (`toBe`, `toEqual`, `toContain`, etc.)
- Test both success and failure cases
- Verify error messages and error types

### 5. Async Testing
- Always use `async/await` for asynchronous tests
- Use `expect().resolves` and `expect().rejects` for promises
- Set appropriate timeouts for long-running operations

### 6. Coverage
- Aim for 80% code coverage
- Focus on testing critical paths and edge cases
- Don't write tests just to increase coverage numbers

### 7. Test Independence
- Each test should be independent and not rely on other tests
- Clean up resources after each test
- Don't share state between tests

## Property-Based Testing

For property-based testing, we use Jest with custom generators. Property-based tests verify that universal properties hold across all inputs.

Example:
```typescript
describe('Property: Tenant Isolation', () => {
  it('should never return data from other tenants', async () => {
    // Generate random tenant IDs and user IDs
    for (let i = 0; i < 100; i++) {
      const tenant1 = `tenant-${i}`;
      const tenant2 = `tenant-${i + 1000}`;
      
      // Create data for both tenants
      await createTestData(tenant1);
      await createTestData(tenant2);
      
      // Query as tenant1
      const results = await queryTests(tenant1);
      
      // Verify no tenant2 data is returned
      results.forEach(result => {
        expect(result.tenantId).toBe(tenant1);
        expect(result.tenantId).not.toBe(tenant2);
      });
    }
  });
});
```

## Troubleshooting

### Tests Timing Out
- Increase timeout in test: `it('test', async () => { ... }, 60000)`
- Check for unresolved promises
- Verify async operations are properly awaited

### Mock Not Working
- Ensure mock is defined before importing the module
- Use `jest.clearAllMocks()` in `beforeEach`
- Check mock implementation is correct

### Coverage Not Collected
- Verify file is in `collectCoverageFrom` pattern
- Check file is not in exclusion list
- Ensure file is actually imported and executed

### TypeScript Errors
- Verify `tsconfig.json` includes test files
- Check type definitions are installed (`@types/jest`)
- Use `ts-jest` for TypeScript transformation

## CI/CD Integration

The `test:ci` command is optimized for CI/CD pipelines:

```bash
npm run test:ci
```

This command:
- Runs in CI mode (no watch, single run)
- Generates coverage reports
- Limits workers to 2 for better resource usage
- Exits with non-zero code on test failures

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://testingjavascript.com/)
- [AWS Lambda Testing Guide](https://docs.aws.amazon.com/lambda/latest/dg/testing-functions.html)
