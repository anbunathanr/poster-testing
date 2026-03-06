/**
 * Unit tests for Test Execution Lambda
 * Task 7.6: Write unit tests for execution engine
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambdas/test-execution/index';
import * as testOperations from '../../src/shared/database/testOperations';
import * as environmentOperations from '../../src/shared/database/environmentOperations';
import * as testResultOperations from '../../src/shared/database/testResultOperations';
import * as s3Upload from '../../src/shared/utils/s3Upload';
import { PlaywrightBrowserManager } from '../../src/shared/utils/playwrightConfig';
import { createScreenshotManager } from '../../src/shared/utils/screenshotCapture';
import { createExecutionLogger } from '../../src/shared/utils/executionLogger';
import { Test, EnvironmentConfig, TestResult } from '../../src/shared/types';

// Mock dependencies
jest.mock('../../src/shared/database/testOperations');
jest.mock('../../src/shared/database/environmentOperations');
jest.mock('../../src/shared/database/testResultOperations');
jest.mock('../../src/shared/utils/s3Upload');
jest.mock('../../src/shared/utils/playwrightConfig');
jest.mock('../../src/shared/utils/screenshotCapture');
jest.mock('../../src/shared/utils/executionLogger');

describe('Test Execution Lambda', () => {
  const mockTest: Test = {
    testId: 'test-123',
    tenantId: 'tenant-123',
    userId: 'user-456',
    testPrompt: 'Test login functionality',
    environment: 'DEV',
    testScript: {
      steps: [
        { action: 'navigate', url: 'https://example.com/login' },
        { action: 'fill', selector: '#email', value: 'test@example.com' },
        { action: 'fill', selector: '#password', value: 'password123' },
        { action: 'click', selector: 'button[type="submit"]' },
        { action: 'waitForNavigation' },
        { action: 'assert', selector: '.dashboard', condition: 'visible' },
      ],
    },
    createdAt: Date.now(),
    status: 'READY',
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

  const mockTestResult: TestResult = {
    resultId: 'result-123',
    testId: 'test-123',
    tenantId: 'tenant-123',
    userId: 'user-456',
    status: 'PASS',
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    duration: 5000,
    screenshotsS3Keys: ['screenshot-1.png', 'screenshot-2.png'],
    logsS3Key: 'execution-log.json',
    executionLog: {},
  };

  const mockPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForLoadState: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn().mockReturnValue({
      waitFor: jest.fn().mockResolvedValue(undefined),
      isVisible: jest.fn().mockResolvedValue(true),
      isHidden: jest.fn().mockResolvedValue(false),
      count: jest.fn().mockResolvedValue(1),
    }),
    isClosed: jest.fn().mockReturnValue(false),
    title: jest.fn().mockResolvedValue('Test Page'),
  };

  const mockBrowserManager = {
    initialize: jest.fn().mockResolvedValue({ page: mockPage }),
    cleanup: jest.fn().mockResolvedValue(undefined),
    getPage: jest.fn().mockReturnValue(mockPage),
    getBrowser: jest.fn().mockReturnValue({ close: jest.fn() }),
  };

  const mockScreenshotManager = {
    captureStepScreenshot: jest.fn().mockResolvedValue(undefined),
    captureFailureScreenshot: jest.fn().mockResolvedValue(undefined),
    getScreenshotPaths: jest.fn().mockReturnValue(['screenshot-1.png', 'screenshot-2.png']),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };

  const mockLogger = {
    log: jest.fn(),
    logDebug: jest.fn(),
    logError: jest.fn(),
    logWarning: jest.fn(),
    logExecutionStart: jest.fn(),
    logExecutionComplete: jest.fn(),
    logStepStart: jest.fn(),
    logStepComplete: jest.fn(),
    logStepFailure: jest.fn(),
    getLogFilePath: jest.fn().mockReturnValue('execution-log.json'),
    getExecutionLog: jest.fn().mockReturnValue({}),
    close: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };

  const createMockEvent = (testId: string, authorizer?: any): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: `/tests/${testId}/execute`,
    pathParameters: { testId },
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
      path: `/tests/${testId}/execute`,
      stage: 'test',
      requestId: 'request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/tests/{testId}/execute',
    },
    resource: '/tests/{testId}/execute',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
    (testOperations.updateTestStatus as jest.Mock).mockResolvedValue(undefined);
    (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvironmentConfig);
    (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);
    (s3Upload.uploadScreenshotsToS3 as jest.Mock).mockResolvedValue(['screenshot-1.png', 'screenshot-2.png']);
    (s3Upload.uploadLogToS3 as jest.Mock).mockResolvedValue('execution-log.json');
    (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => mockBrowserManager);
    (createScreenshotManager as jest.Mock).mockResolvedValue(mockScreenshotManager);
    (createExecutionLogger as jest.Mock).mockResolvedValue(mockLogger);
  });

  describe('Authorization and Validation', () => {
    it('should return 401 if JWT context is missing', async () => {
      const event = createMockEvent('test-123', {});
      const result = await handler(event);
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unauthorized');
    });

    it('should return 401 if tenantId is missing', async () => {
      const event = createMockEvent('test-123', { userId: 'user-456', email: 'test@example.com' });
      const result = await handler(event);
      expect(result.statusCode).toBe(401);
    });

    it('should return 400 if testId is missing', async () => {
      const event = createMockEvent('test-123');
      event.pathParameters = null;
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Test ID is required');
    });
  });

  describe('Successful Test Execution', () => {
    it('should execute test successfully and return PASS status', async () => {
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('PASS');
      expect(body.testId).toBe('test-123');
      expect(body.resultId).toBeDefined();
      expect(body.duration).toBeGreaterThan(0);
      
      expect(testOperations.getTest).toHaveBeenCalledWith('tenant-123', 'test-123');
      expect(mockBrowserManager.initialize).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalled();
      expect(mockPage.fill).toHaveBeenCalledTimes(2);
      expect(mockPage.click).toHaveBeenCalled();
      expect(mockScreenshotManager.captureStepScreenshot).toHaveBeenCalledTimes(6);
      expect(mockBrowserManager.cleanup).toHaveBeenCalled();
    });

    it('should update test status to EXECUTING then COMPLETED', async () => {
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(testOperations.updateTestStatus).toHaveBeenCalledWith('tenant-123', 'test-123', 'EXECUTING');
      expect(testOperations.updateTestStatus).toHaveBeenCalledWith('tenant-123', 'test-123', 'COMPLETED');
    });
  });

  describe('Test Execution Errors', () => {
    it('should handle test not found', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue(null);
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toContain('Test not found');
    });

    it('should handle empty test script', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue({ ...mockTest, testScript: { steps: [] } });
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
    });

    it('should handle step execution failure', async () => {
      mockPage.fill.mockRejectedValueOnce(new Error('Element not found'));
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(mockScreenshotManager.captureFailureScreenshot).toHaveBeenCalled();
    });
  });

  describe('Browser Crash Handling', () => {
    it('should handle browser crash during execution', async () => {
      mockPage.isClosed.mockReturnValue(true);
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(mockLogger.logError).toHaveBeenCalled();
    });

    it('should handle Target closed error', async () => {
      mockPage.goto.mockRejectedValue(new Error('Target closed'));
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
    });

    it('should skip failure screenshot if browser crashed', async () => {
      mockPage.isClosed.mockReturnValue(true);
      mockPage.goto.mockRejectedValue(new Error('Browser crashed'));
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(mockScreenshotManager.captureFailureScreenshot).not.toHaveBeenCalled();
    });
  });

  describe('Step Execution - Navigate', () => {
    it('should execute navigate action', async () => {
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com/login',
        expect.objectContaining({ waitUntil: 'domcontentloaded', timeout: 30000 })
      );
    });

    it('should fail if URL is missing', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue({
        ...mockTest,
        testScript: { steps: [{ action: 'navigate' }] },
      });
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toContain('requires a URL');
    });
  });

  describe('Step Execution - Fill', () => {
    it('should execute fill action', async () => {
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(mockPage.fill).toHaveBeenCalledWith(
        '#email',
        'test@example.com',
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should fail if selector is missing', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue({
        ...mockTest,
        testScript: { steps: [{ action: 'fill', value: 'test' }] },
      });
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toContain('requires a selector');
    });

    it('should fail if value is missing', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue({
        ...mockTest,
        testScript: { steps: [{ action: 'fill', selector: '#email' }] },
      });
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toContain('requires a value');
    });
  });

  describe('Step Execution - Click', () => {
    it('should execute click action', async () => {
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(mockPage.click).toHaveBeenCalledWith(
        'button[type="submit"]',
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should fail if selector is missing', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue({
        ...mockTest,
        testScript: { steps: [{ action: 'click' }] },
      });
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toContain('requires a selector');
    });
  });

  describe('Step Execution - Assert', () => {
    it('should execute assert visible', async () => {
      const event = createMockEvent('test-123');
      await handler(event);
      
      const locator = mockPage.locator('.dashboard');
      expect(locator.waitFor).toHaveBeenCalled();
      expect(locator.isVisible).toHaveBeenCalled();
    });

    it('should execute assert hidden', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue({
        ...mockTest,
        testScript: { steps: [{ action: 'assert', selector: '.error', condition: 'hidden' }] },
      });
      const mockLocator = {
        waitFor: jest.fn().mockResolvedValue(undefined),
        isHidden: jest.fn().mockResolvedValue(true),
      };
      mockPage.locator.mockReturnValue(mockLocator);
      
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('PASS');
    });

    it('should execute assert exists', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue({
        ...mockTest,
        testScript: { steps: [{ action: 'assert', selector: '.element', condition: 'exists' }] },
      });
      const mockLocator = { count: jest.fn().mockResolvedValue(1) };
      mockPage.locator.mockReturnValue(mockLocator);
      
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('PASS');
    });

    it('should fail if element not visible', async () => {
      const mockLocator = {
        waitFor: jest.fn().mockResolvedValue(undefined),
        isVisible: jest.fn().mockResolvedValue(false),
      };
      mockPage.locator.mockReturnValue(mockLocator);
      
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toContain('not visible');
    });

    it('should fail for unknown condition', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue({
        ...mockTest,
        testScript: { steps: [{ action: 'assert', selector: '.element', condition: 'unknown' }] },
      });
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toContain('Unknown assertion condition');
    });
  });

  describe('Step Execution - WaitForNavigation', () => {
    it('should execute waitForNavigation', async () => {
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith(
        'domcontentloaded',
        expect.objectContaining({ timeout: 30000 })
      );
    });
  });

  describe('Screenshot Capture', () => {
    it('should continue if step screenshot fails', async () => {
      mockScreenshotManager.captureStepScreenshot.mockRejectedValue(new Error('Screenshot failed'));
      const event = createMockEvent('test-123');
      const result = await handler(event);
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('PASS');
      expect(mockLogger.logWarning).toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log execution lifecycle', async () => {
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(mockLogger.logExecutionStart).toHaveBeenCalled();
      expect(mockLogger.logStepStart).toHaveBeenCalledTimes(6);
      expect(mockLogger.logStepComplete).toHaveBeenCalledTimes(6);
      expect(mockLogger.logExecutionComplete).toHaveBeenCalledWith('PASS', expect.any(Object));
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on success', async () => {
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(mockBrowserManager.cleanup).toHaveBeenCalled();
      expect(mockScreenshotManager.cleanup).toHaveBeenCalled();
      expect(mockLogger.cleanup).toHaveBeenCalled();
    });

    it('should cleanup resources on failure', async () => {
      mockPage.fill.mockRejectedValue(new Error('Test failed'));
      const event = createMockEvent('test-123');
      await handler(event);
      
      expect(mockBrowserManager.cleanup).toHaveBeenCalled();
    });
  });
});
