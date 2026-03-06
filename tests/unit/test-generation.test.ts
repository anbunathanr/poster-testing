/**
 * Unit tests for Test Generation Lambda
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

describe('Test Generation Lambda', () => {
  const mockTestScript: TestScript = {
    steps: [
      { action: 'navigate', url: 'https://example.com' },
      { action: 'fill', selector: '#email', value: 'test@example.com' },
      { action: 'click', selector: '#submit' },
    ],
  };

  const mockEnvironmentConfig: EnvironmentConfig = {
    tenantId: 'tenant-123',
    environment: 'DEV',
    baseUrl: 'https://dev.example.com',
    credentials: {},
    configuration: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockGenerateTestResult = {
    testScript: mockTestScript,
    attempts: 1,
  };

  const mockCreatedTest = {
    testId: 'test-123',
    tenantId: 'tenant-123',
    userId: 'user-456',
    testPrompt: 'Test login functionality',
    testScript: mockTestScript,
    environment: 'DEV' as const,
    createdAt: Date.now(),
    status: 'READY' as const,
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
        userId: 'user-456',
        tenantId: 'tenant-123',
        email: 'test@example.com',
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
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/tests/generate',
      stage: 'test',
      requestId: 'request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/tests/generate',
    },
    resource: '/tests/generate',
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (testGenerationService.getTestGenerationService as jest.Mock).mockReturnValue({
      generateTest: jest.fn().mockResolvedValue(mockGenerateTestResult),
    });
    (testOperations.createTest as jest.Mock).mockResolvedValue(mockCreatedTest);
    (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvironmentConfig);
  });

  describe('POST /tests/generate', () => {
    it('should generate test successfully', async () => {
      const event = createMockEvent({
        testPrompt: 'Test login functionality',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.testId).toBe('test-123');
      expect(body.status).toBe('READY');
      expect(body.testScript).toEqual(mockTestScript);
      expect(body.environment).toBe('DEV');
      expect(body.createdAt).toBeDefined();

      // Verify service was called correctly
      const service = testGenerationService.getTestGenerationService();
      expect(service.generateTest).toHaveBeenCalledWith({
        testPrompt: 'Test login functionality',
        environment: 'DEV',
        environmentConfig: undefined,
      });

      // Verify test was stored
      expect(testOperations.createTest).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        userId: 'user-456',
        testPrompt: 'Test login functionality',
        testScript: mockTestScript,
        environment: 'DEV',
        testName: undefined,
      });
    });

    it('should generate test with environment configuration', async () => {
      const event = createMockEvent({
        testPrompt: 'Test login functionality',
        environment: 'DEV',
        environmentId: 'env-123',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);

      // Verify environment config was retrieved
      expect(environmentOperations.getEnvironmentConfig).toHaveBeenCalledWith('tenant-123', 'DEV');

      // Verify service was called with environment config
      const service = testGenerationService.getTestGenerationService();
      expect(service.generateTest).toHaveBeenCalledWith({
        testPrompt: 'Test login functionality',
        environment: 'DEV',
        environmentConfig: mockEnvironmentConfig,
      });
    });

    it('should generate test with optional testName', async () => {
      const event = createMockEvent({
        testPrompt: 'Test login functionality',
        environment: 'DEV',
        testName: 'My Login Test',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);

      // Verify test was stored with testName
      expect(testOperations.createTest).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        userId: 'user-456',
        testPrompt: 'Test login functionality',
        testScript: mockTestScript,
        environment: 'DEV',
        testName: 'My Login Test',
      });
    });

    it('should return 401 if JWT context is missing', async () => {
      const event = createMockEvent(
        { testPrompt: 'Test', environment: 'DEV' },
        {} // Empty authorizer context
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unauthorized');
    });

    it('should return 400 if request body is missing', async () => {
      const event = createMockEvent(null, {
        userId: 'user-456',
        tenantId: 'tenant-123',
        email: 'test@example.com',
      });
      event.body = null;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Request body is required');
    });

    it('should return 400 if request body is invalid JSON', async () => {
      const event = createMockEvent({}, {
        userId: 'user-456',
        tenantId: 'tenant-123',
        email: 'test@example.com',
      });
      event.body = 'invalid json';

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid JSON');
    });

    it('should return 400 if testPrompt is missing', async () => {
      const event = createMockEvent({
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('testPrompt is required');
    });

    it('should return 400 if testPrompt is empty', async () => {
      const event = createMockEvent({
        testPrompt: '   ',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('testPrompt is required');
    });

    it('should return 400 if environment is missing', async () => {
      const event = createMockEvent({
        testPrompt: 'Test login',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('environment is required');
    });

    it('should return 400 if environment is invalid', async () => {
      const event = createMockEvent({
        testPrompt: 'Test login',
        environment: 'INVALID',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Invalid environment');
    });

    it('should return 404 if environment configuration not found', async () => {
      (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent({
        testPrompt: 'Test login',
        environment: 'DEV',
        environmentId: 'env-123',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Environment configuration not found');
    });

    it('should return 500 if test generation fails', async () => {
      // Create a proper TestGenerationError instance
      const testGenError = Object.assign(
        new Error('Generation failed'),
        {
          name: 'TestGenerationError',
          code: 'BEDROCK_API_ERROR',
          attempts: 3,
        }
      );
      
      // Make it an instance of TestGenerationError
      Object.setPrototypeOf(testGenError, testGenerationService.TestGenerationError.prototype);
      
      const service = testGenerationService.getTestGenerationService();
      (service.generateTest as jest.Mock).mockRejectedValue(testGenError);

      const event = createMockEvent({
        testPrompt: 'Test login',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Generation failed');
      expect(body.code).toBe('BEDROCK_API_ERROR');
      expect(body.attempts).toBe(3);
    });

    it('should return 500 if test storage fails', async () => {
      (testOperations.createTest as jest.Mock).mockRejectedValue(
        new Error('DynamoDB error')
      );

      const event = createMockEvent({
        testPrompt: 'Test login',
        environment: 'DEV',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Failed to generate test');
    });

    it('should return 500 if environment config retrieval fails', async () => {
      (environmentOperations.getEnvironmentConfig as jest.Mock).mockRejectedValue(
        new Error('DynamoDB error')
      );

      const event = createMockEvent({
        testPrompt: 'Test login',
        environment: 'DEV',
        environmentId: 'env-123',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Failed to retrieve environment configuration');
    });
  });

  describe('Unimplemented routes', () => {
    it('should return 404 for unknown routes', async () => {
      const event = createMockEvent({});
      event.path = '/unknown';

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Route not found');
    });
  });
});
