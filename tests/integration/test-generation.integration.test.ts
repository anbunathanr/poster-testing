/**
 * Integration tests for Test Generation Flow
 * Tests the complete test generation workflow including Lambda, Bedrock, DynamoDB, and environment operations
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambdas/test-generation/index';
import * as testGenerationService from '../../src/shared/services/testGenerationService';
import * as testOperations from '../../src/shared/database/testOperations';
import * as environmentOperations from '../../src/shared/database/environmentOperations';
import { TestScript, EnvironmentConfig } from '../../src/shared/types';

// Mock dependencies
jest.mock('../../src/shared/services/testGenerationService');
jest.mock('../../src/shared/database/testOperations');
jest.mock('../../src/shared/database/environmentOperations');

describe('Test Generation Flow - Integration Tests', () => {
  const mockTestScript: TestScript = {
    steps: [
      { action: 'navigate', url: 'https://example.com/login' },
      { action: 'fill', selector: '#email', value: 'test@example.com' },
      { action: 'fill', selector: '#password', value: 'password123' },
      { action: 'click', selector: '#submit' },
      { action: 'waitForNavigation' },
      { action: 'assert', selector: '.dashboard', condition: 'visible' },
    ],
  };

  const mockEnvironmentConfig: EnvironmentConfig = {
    tenantId: 'tenant-integration',
    environment: 'DEV',
    baseUrl: 'https://dev.example.com',
    credentials: { apiKey: 'test-key' },
    configuration: { timeout: 30000 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const createMockEvent = (body: any, authorizer?: any): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/tests/generate',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: authorizer || {
        userId: 'user-integration',
        tenantId: 'tenant-integration',
        email: 'integration@example.com',
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'integration-test-agent',
        userArn: null,
      },
      path: '/tests/generate',
      stage: 'test',
      requestId: 'integration-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/tests/generate',
    },
    resource: '/tests/generate',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TESTS_TABLE = 'Tests';
    process.env.ENVIRONMENTS_TABLE = 'Environments';
  });

  describe('End-to-End Test Generation Flow', () => {
    it('should complete full test generation flow with valid inputs', async () => {
      // Setup mocks for successful flow
      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
        tokensUsed: { input: 100, output: 200 },
      };

      const mockCreatedTest = {
        testId: 'test-integration-123',
        tenantId: 'tenant-integration',
        userId: 'user-integration',
        testPrompt: 'Test login with valid credentials',
        testScript: mockTestScript,
        environment: 'DEV' as const,
        createdAt: Date.now(),
        status: 'READY' as const,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });
      (testOperations.createTest as jest.Mock).mockResolvedValue(mockCreatedTest);

      // Execute the flow
      const event = createMockEvent({
        testPrompt: 'Test login with valid credentials',
        environment: 'DEV',
      });

      const result = await handler(event);

      // Verify response
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.testId).toBe('test-integration-123');
      expect(body.status).toBe('READY');
      expect(body.testScript).toEqual(mockTestScript);
      expect(body.environment).toBe('DEV');
      expect(body.createdAt).toBeDefined();

      // Verify service interactions
      const service = testGenerationService.getTestGenerationService();
      expect(service.generateTest).toHaveBeenCalledWith({
        testPrompt: 'Test login with valid credentials',
        environment: 'DEV',
        environmentConfig: undefined,
      });

      expect(testOperations.createTest).toHaveBeenCalledWith({
        tenantId: 'tenant-integration',
        userId: 'user-integration',
        testPrompt: 'Test login with valid credentials',
        testScript: mockTestScript,
        environment: 'DEV',
        testName: undefined,
      });
    });

    it('should complete flow with environment configuration', async () => {
      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      const mockCreatedTest = {
        testId: 'test-with-env-123',
        tenantId: 'tenant-integration',
        userId: 'user-integration',
        testPrompt: 'Test with environment config',
        testScript: mockTestScript,
        environment: 'DEV' as const,
        createdAt: Date.now(),
        status: 'READY' as const,
      };

      (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvironmentConfig);
      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });
      (testOperations.createTest as jest.Mock).mockResolvedValue(mockCreatedTest);

      const event = createMockEvent({
        testPrompt: 'Test with environment config',
        environment: 'DEV',
        environmentId: 'env-123',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);

      // Verify environment config was retrieved
      expect(environmentOperations.getEnvironmentConfig).toHaveBeenCalledWith(
        'tenant-integration',
        'DEV'
      );

      // Verify service was called with environment config
      const service = testGenerationService.getTestGenerationService();
      expect(service.generateTest).toHaveBeenCalledWith({
        testPrompt: 'Test with environment config',
        environment: 'DEV',
        environmentConfig: mockEnvironmentConfig,
      });
    });

    it('should store generated tests with correct tenant isolation', async () => {
      const tenant1Event = createMockEvent(
        { testPrompt: 'Tenant 1 test', environment: 'DEV' },
        { userId: 'user-1', tenantId: 'tenant-1', email: 'user1@example.com' }
      );

      const tenant2Event = createMockEvent(
        { testPrompt: 'Tenant 2 test', environment: 'DEV' },
        { userId: 'user-2', tenantId: 'tenant-2', email: 'user2@example.com' }
      );

      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock)
        .mockResolvedValueOnce({
          testId: 'test-tenant1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          testPrompt: 'Tenant 1 test',
          testScript: mockTestScript,
          environment: 'DEV',
          createdAt: Date.now(),
          status: 'READY',
        })
        .mockResolvedValueOnce({
          testId: 'test-tenant2',
          tenantId: 'tenant-2',
          userId: 'user-2',
          testPrompt: 'Tenant 2 test',
          testScript: mockTestScript,
          environment: 'DEV',
          createdAt: Date.now(),
          status: 'READY',
        });

      // Execute for tenant 1
      const result1 = await handler(tenant1Event);
      expect(result1.statusCode).toBe(201);
      const body1 = JSON.parse(result1.body);
      expect(body1.testId).toBe('test-tenant1');

      // Verify tenant 1 data was stored correctly
      expect(testOperations.createTest).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
        })
      );

      // Execute for tenant 2
      const result2 = await handler(tenant2Event);
      expect(result2.statusCode).toBe(201);
      const body2 = JSON.parse(result2.body);
      expect(body2.testId).toBe('test-tenant2');

      // Verify tenant 2 data was stored correctly
      expect(testOperations.createTest).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-2',
          userId: 'user-2',
        })
      );

      // Verify tests are isolated by tenant
      expect(body1.testId).not.toBe(body2.testId);
    });
  });

  describe('Error Handling - Missing/Invalid Environment', () => {
    it('should return 404 when environment configuration not found', async () => {
      (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent({
        testPrompt: 'Test with missing env',
        environment: 'DEV',
        environmentId: 'non-existent-env',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Environment configuration not found');
      expect(body.error).toContain('DEV');

      // Verify no test generation or storage occurred
      expect(testGenerationService.getTestGenerationService).not.toHaveBeenCalled();
      expect(testOperations.createTest).not.toHaveBeenCalled();
    });

    it('should return 500 when environment config retrieval fails', async () => {
      (environmentOperations.getEnvironmentConfig as jest.Mock).mockRejectedValue(
        new Error('DynamoDB connection timeout')
      );

      const event = createMockEvent({
        testPrompt: 'Test with env error',
        environment: 'DEV',
        environmentId: 'env-123',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Failed to retrieve environment configuration');

      // Verify no test generation or storage occurred
      const service = testGenerationService.getTestGenerationService();
      expect(service.generateTest).not.toHaveBeenCalled();
      expect(testOperations.createTest).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid environment value', async () => {
      const event = createMockEvent({
        testPrompt: 'Test with invalid env',
        environment: 'INVALID_ENV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid environment');
      expect(body.error).toContain('DEV, STAGING, PROD');
    });
  });

  describe('Error Handling - Bedrock API Failures', () => {
    it('should return 500 when Bedrock API fails', async () => {
      const bedrockError = Object.assign(
        new Error('Bedrock service unavailable'),
        {
          name: 'TestGenerationError',
          code: 'BEDROCK_API_ERROR',
          attempts: 3,
        }
      );
      Object.setPrototypeOf(bedrockError, testGenerationService.TestGenerationError.prototype);

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockRejectedValue(bedrockError),
      });

      const event = createMockEvent({
        testPrompt: 'Test with Bedrock failure',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Bedrock service unavailable');
      expect(body.code).toBe('BEDROCK_API_ERROR');
      expect(body.attempts).toBe(3);

      // Verify no test was stored
      expect(testOperations.createTest).not.toHaveBeenCalled();
    });

    it('should return 500 when Bedrock times out', async () => {
      const timeoutError = Object.assign(
        new Error('Test generation timed out after 3 attempts'),
        {
          name: 'TestGenerationError',
          code: 'TIMEOUT',
          attempts: 3,
        }
      );
      Object.setPrototypeOf(timeoutError, testGenerationService.TestGenerationError.prototype);

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockRejectedValue(timeoutError),
      });

      const event = createMockEvent({
        testPrompt: 'Test with timeout',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('timed out');
      expect(body.code).toBe('TIMEOUT');
      expect(body.attempts).toBe(3);
    });

    it('should return 500 when Bedrock returns invalid response', async () => {
      const invalidResponseError = Object.assign(
        new Error('Invalid response from AI model: Missing required field "steps"'),
        {
          name: 'TestGenerationError',
          code: 'INVALID_RESPONSE',
          attempts: 1,
        }
      );
      Object.setPrototypeOf(invalidResponseError, testGenerationService.TestGenerationError.prototype);

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockRejectedValue(invalidResponseError),
      });

      const event = createMockEvent({
        testPrompt: 'Test with invalid response',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid response from AI model');
      expect(body.code).toBe('INVALID_RESPONSE');
    });
  });

  describe('Error Handling - DynamoDB Storage Failures', () => {
    it('should return 500 when test storage fails', async () => {
      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock).mockRejectedValue(
        new Error('DynamoDB write capacity exceeded')
      );

      const event = createMockEvent({
        testPrompt: 'Test with storage failure',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Failed to generate test');

      // Verify test generation succeeded but storage failed
      const service = testGenerationService.getTestGenerationService();
      expect(service.generateTest).toHaveBeenCalled();
      expect(testOperations.createTest).toHaveBeenCalled();
    });

    it('should return 500 when DynamoDB is unavailable', async () => {
      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock).mockRejectedValue(
        new Error('Failed to create test: Service unavailable')
      );

      const event = createMockEvent({
        testPrompt: 'Test with DynamoDB unavailable',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Failed to generate test');
    });
  });

  describe('Tenant Isolation Validation', () => {
    it('should prevent cross-tenant data access', async () => {
      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock).mockImplementation(async (input) => ({
        testId: `test-${input.tenantId}`,
        ...input,
        createdAt: Date.now(),
        status: 'READY' as const,
      }));

      // Create test for tenant A
      const tenantAEvent = createMockEvent(
        { testPrompt: 'Tenant A test', environment: 'DEV' },
        { userId: 'user-a', tenantId: 'tenant-a', email: 'a@example.com' }
      );

      const resultA = await handler(tenantAEvent);
      expect(resultA.statusCode).toBe(201);

      // Verify tenant A's test was created with correct tenantId
      expect(testOperations.createTest).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-a',
          userId: 'user-a',
        })
      );

      // Create test for tenant B
      const tenantBEvent = createMockEvent(
        { testPrompt: 'Tenant B test', environment: 'DEV' },
        { userId: 'user-b', tenantId: 'tenant-b', email: 'b@example.com' }
      );

      const resultB = await handler(tenantBEvent);
      expect(resultB.statusCode).toBe(201);

      // Verify tenant B's test was created with correct tenantId
      expect(testOperations.createTest).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-b',
          userId: 'user-b',
        })
      );

      // Verify tests are stored with different tenant IDs
      const bodyA = JSON.parse(resultA.body);
      const bodyB = JSON.parse(resultB.body);
      expect(bodyA.testId).toContain('tenant-a');
      expect(bodyB.testId).toContain('tenant-b');
    });

    it('should use tenant-specific environment configurations', async () => {
      const tenant1Config: EnvironmentConfig = {
        tenantId: 'tenant-1',
        environment: 'DEV',
        baseUrl: 'https://tenant1-dev.example.com',
        credentials: {},
        configuration: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const tenant2Config: EnvironmentConfig = {
        tenantId: 'tenant-2',
        environment: 'DEV',
        baseUrl: 'https://tenant2-dev.example.com',
        credentials: {},
        configuration: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (environmentOperations.getEnvironmentConfig as jest.Mock)
        .mockImplementation(async (tenantId) => {
          if (tenantId === 'tenant-1') return tenant1Config;
          if (tenantId === 'tenant-2') return tenant2Config;
          return null;
        });

      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock).mockImplementation(async (input) => ({
        testId: `test-${input.tenantId}`,
        ...input,
        createdAt: Date.now(),
        status: 'READY' as const,
      }));

      // Test for tenant 1
      const tenant1Event = createMockEvent(
        { testPrompt: 'Test', environment: 'DEV', environmentId: 'env-1' },
        { userId: 'user-1', tenantId: 'tenant-1', email: 'user1@example.com' }
      );

      await handler(tenant1Event);

      const service = testGenerationService.getTestGenerationService();
      expect(service.generateTest).toHaveBeenCalledWith(
        expect.objectContaining({
          environmentConfig: tenant1Config,
        })
      );

      // Test for tenant 2
      const tenant2Event = createMockEvent(
        { testPrompt: 'Test', environment: 'DEV', environmentId: 'env-2' },
        { userId: 'user-2', tenantId: 'tenant-2', email: 'user2@example.com' }
      );

      await handler(tenant2Event);

      expect(service.generateTest).toHaveBeenCalledWith(
        expect.objectContaining({
          environmentConfig: tenant2Config,
        })
      );
    });
  });

  describe('Multiple Environments Support', () => {
    it('should handle DEV environment correctly', async () => {
      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock).mockResolvedValue({
        testId: 'test-dev',
        tenantId: 'tenant-integration',
        userId: 'user-integration',
        testPrompt: 'DEV test',
        testScript: mockTestScript,
        environment: 'DEV',
        createdAt: Date.now(),
        status: 'READY',
      });

      const event = createMockEvent({
        testPrompt: 'DEV test',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.environment).toBe('DEV');
    });

    it('should handle STAGING environment correctly', async () => {
      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock).mockResolvedValue({
        testId: 'test-staging',
        tenantId: 'tenant-integration',
        userId: 'user-integration',
        testPrompt: 'STAGING test',
        testScript: mockTestScript,
        environment: 'STAGING',
        createdAt: Date.now(),
        status: 'READY',
      });

      const event = createMockEvent({
        testPrompt: 'STAGING test',
        environment: 'STAGING',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.environment).toBe('STAGING');
    });

    it('should handle PROD environment correctly', async () => {
      const mockGenerateTestResult = {
        testScript: mockTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock).mockResolvedValue({
        testId: 'test-prod',
        tenantId: 'tenant-integration',
        userId: 'user-integration',
        testPrompt: 'PROD test',
        testScript: mockTestScript,
        environment: 'PROD',
        createdAt: Date.now(),
        status: 'READY',
      });

      const event = createMockEvent({
        testPrompt: 'PROD test',
        environment: 'PROD',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.environment).toBe('PROD');
    });
  });

  describe('Complex Test Script Generation', () => {
    it('should handle complex test scripts with multiple assertions', async () => {
      const complexTestScript: TestScript = {
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'fill', selector: '#username', value: 'testuser' },
          { action: 'fill', selector: '#password', value: 'testpass' },
          { action: 'click', selector: '#login-btn' },
          { action: 'waitForNavigation' },
          { action: 'assert', selector: '.welcome-message', condition: 'visible' },
          { action: 'assert', selector: '.user-profile', condition: 'visible' },
          { action: 'click', selector: '#create-post' },
          { action: 'fill', selector: '#post-content', value: 'Test post content' },
          { action: 'click', selector: '#submit-post' },
          { action: 'assert', selector: '.success-notification', condition: 'visible' },
        ],
      };

      const mockGenerateTestResult = {
        testScript: complexTestScript,
        attempts: 1,
      };

      (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
        generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
      });

      (testOperations.createTest as jest.Mock).mockResolvedValue({
        testId: 'test-complex',
        tenantId: 'tenant-integration',
        userId: 'user-integration',
        testPrompt: 'Complex test with multiple steps',
        testScript: complexTestScript,
        environment: 'DEV',
        createdAt: Date.now(),
        status: 'READY',
      });

      const event = createMockEvent({
        testPrompt: 'Complex test with multiple steps',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.testScript.steps).toHaveLength(11);
      expect(body.testScript).toEqual(complexTestScript);
    });
  });
});
