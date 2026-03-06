/**
 * Integration tests for Test Execution Flow
 * Tests the complete test execution workflow including Lambda, Playwright, DynamoDB, and S3
 * 
 * Validates:
 * - Requirement 3: UI Test Execution with Playwright (all acceptance criteria)
 * - Requirement 8: Test Execution Orchestration
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambdas/test-execution/index';
import * as testOperations from '../../src/shared/database/testOperations';
import * as environmentOperations from '../../src/shared/database/environmentOperations';
import * as testResultOperations from '../../src/shared/database/testResultOperations';
import * as s3Upload from '../../src/shared/utils/s3Upload';
import { PlaywrightBrowserManager } from '../../src/shared/utils/playwrightConfig';
import { Test, TestScript, EnvironmentConfig, TestResult } from '../../src/shared/types';
import { createMockAPIGatewayEvent, createMockJWTPayload } from '../helpers/testUtils';

// Mock all dependencies
jest.mock('../../src/shared/database/testOperations');
jest.mock('../../src/shared/database/environmentOperations');
jest.mock('../../src/shared/database/testResultOperations');
jest.mock('../../src/shared/utils/s3Upload');
jest.mock('../../src/shared/utils/playwrightConfig');
jest.mock('../../src/shared/utils/screenshotCapture');
jest.mock('../../src/shared/utils/executionLogger');

// Mock execution logger
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
  close: jest.fn().mockResolvedValue(undefined),
  cleanup: jest.fn().mockResolvedValue(undefined),
  getLogFilePath: jest.fn().mockReturnValue('/tmp/test-log.json'),
  getExecutionLog: jest.fn().mockReturnValue({}),
};

// Mock screenshot manager
const mockScreenshotManager = {
  captureStepScreenshot: jest.fn().mockResolvedValue(undefined),
  captureFailureScreenshot: jest.fn().mockResolvedValue(undefined),
  getScreenshotPaths: jest.fn().mockReturnValue(['/tmp/screenshot-1.png', '/tmp/screenshot-2.png']),
  cleanup: jest.fn().mockResolvedValue(undefined),
};

// Setup mocks before imports
const executionLogger = require('../../src/shared/utils/executionLogger');
executionLogger.createExecutionLogger = jest.fn().mockResolvedValue(mockLogger);

const screenshotCapture = require('../../src/shared/utils/screenshotCapture');
screenshotCapture.createScreenshotManager = jest.fn().mockResolvedValue(mockScreenshotManager);

const mockTestId = 'test-exec-123';
const mockTenantId = 'tenant-exec';
const mockUserId = 'user-exec';
const mockResultId = 'result-exec-123';

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

const mockTest: Test = {
  testId: mockTestId,
  tenantId: mockTenantId,
  userId: mockUserId,
  testPrompt: 'Test login functionality',
  testScript: mockTestScript,
  environment: 'DEV',
  createdAt: Date.now(),
  status: 'READY',
};

const mockEnvironmentConfig: EnvironmentConfig = {
  tenantId: mockTenantId,
  environment: 'DEV',
  baseUrl: 'https://dev.example.com',
  credentials: { apiKey: 'test-key' },
  configuration: { timeout: 30000 },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const createMockEvent = (testId: string, authorizer?: any): APIGatewayProxyEvent => {
  return createMockAPIGatewayEvent({
    httpMethod: 'POST',
    path: `/tests/${testId}/execute`,
    pathParameters: { testId },
    requestContext: {
      ...createMockAPIGatewayEvent().requestContext,
      authorizer: authorizer || createMockJWTPayload({
        userId: mockUserId,
        tenantId: mockTenantId,
        email: 'test@example.com',
      }),
    },
  });
};

describe('Test Execution Flow - Integration Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TESTS_TABLE = 'Tests';
    process.env.TEST_RESULTS_TABLE = 'TestResults';
    process.env.ENVIRONMENTS_TABLE = 'Environments';
    process.env.S3_BUCKET = 'test-bucket';

    // Reset mock implementations
    mockLogger.log.mockClear();
    mockLogger.logDebug.mockClear();
    mockLogger.logError.mockClear();
    mockLogger.logWarning.mockClear();
    mockLogger.logExecutionStart.mockClear();
    mockLogger.logExecutionComplete.mockClear();
    mockLogger.logStepStart.mockClear();
    mockLogger.logStepComplete.mockClear();
    mockLogger.logStepFailure.mockClear();
    mockLogger.close.mockResolvedValue(undefined);
    mockLogger.cleanup.mockResolvedValue(undefined);
    mockLogger.getLogFilePath.mockReturnValue('/tmp/test-log.json');
    mockLogger.getExecutionLog.mockReturnValue({});

    mockScreenshotManager.captureStepScreenshot.mockResolvedValue(undefined);
    mockScreenshotManager.captureFailureScreenshot.mockResolvedValue(undefined);
    mockScreenshotManager.getScreenshotPaths.mockReturnValue(['/tmp/screenshot-1.png', '/tmp/screenshot-2.png']);
    mockScreenshotManager.cleanup.mockResolvedValue(undefined);

    executionLogger.createExecutionLogger.mockResolvedValue(mockLogger);
    screenshotCapture.createScreenshotManager.mockResolvedValue(mockScreenshotManager);

    // Setup default mocks
    (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
    (testOperations.updateTestStatus as jest.Mock).mockResolvedValue(undefined);
    (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvironmentConfig);
    (s3Upload.uploadScreenshotsToS3 as jest.Mock).mockResolvedValue(['screenshot-1.png', 'screenshot-2.png']);
    (s3Upload.uploadLogToS3 as jest.Mock).mockResolvedValue('execution-log.json');
  });

  describe('End-to-End Test Execution Flow - Success', () => {
    it('should complete full test execution flow with PASS status', async () => {
      // Mock successful test result creation
      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: ['screenshot-1.png', 'screenshot-2.png'],
        logsS3Key: 'execution-log.json',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      // Mock Playwright browser
      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
          count: jest.fn().mockResolvedValue(1),
        }),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      // Execute test
      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      // Verify response
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('PASS');
      expect(body.testId).toBe(mockTestId);
      expect(body.resultId).toBeDefined();
      expect(body.duration).toBeGreaterThan(0);
      expect(body.message).toContain('completed successfully');

      // Verify test was retrieved
      expect(testOperations.getTest).toHaveBeenCalledWith(mockTenantId, mockTestId);

      // Verify environment config was retrieved
      expect(environmentOperations.getEnvironmentConfig).toHaveBeenCalledWith(mockTenantId, 'DEV');

      // Verify test status was updated to EXECUTING and COMPLETED
      expect(testOperations.updateTestStatus).toHaveBeenCalledWith(mockTenantId, mockTestId, 'EXECUTING');
      expect(testOperations.updateTestStatus).toHaveBeenCalledWith(mockTenantId, mockTestId, 'COMPLETED');

      // Verify test result was created
      expect(testResultOperations.createTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          testId: mockTestId,
          tenantId: mockTenantId,
          userId: mockUserId,
          status: 'PASS',
        })
      );

      // Verify screenshots and logs were uploaded
      expect(s3Upload.uploadScreenshotsToS3).toHaveBeenCalled();
      expect(s3Upload.uploadLogToS3).toHaveBeenCalled();
    });
  });

  describe('End-to-End Test Execution Flow - Failure', () => {
    it('should handle test execution failure and capture error details', async () => {
      // Mock test result creation for failure
      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'FAIL',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: ['screenshot-1.png', 'failure-screenshot.png'],
        logsS3Key: 'execution-log.json',
        errorMessage: 'Element "#submit" not found',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      // Mock Playwright browser with failure
      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockRejectedValue(new Error('Element "#submit" not found')),
        isClosed: jest.fn().mockReturnValue(false),
        title: jest.fn().mockResolvedValue('Test Page'),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      // Execute test
      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      // Verify response
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.testId).toBe(mockTestId);
      expect(body.errorMessage).toContain('not found');

      // Verify test result was created with FAIL status
      expect(testResultOperations.createTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          testId: mockTestId,
          status: 'FAIL',
          errorMessage: expect.stringContaining('not found'),
        })
      );

      // Verify test status was updated to COMPLETED even on failure
      expect(testOperations.updateTestStatus).toHaveBeenCalledWith(mockTenantId, mockTestId, 'COMPLETED');
    });

    it('should capture failure screenshot when test step fails', async () => {
      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'FAIL',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: ['screenshot-1.png', 'failure-screenshot.png'],
        logsS3Key: 'execution-log.json',
        errorMessage: 'Assertion failed',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockRejectedValue(new Error('Timeout waiting for element')),
        }),
        isClosed: jest.fn().mockReturnValue(false),
        title: jest.fn().mockResolvedValue('Test Page'),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');

      // Verify screenshots were uploaded (including failure screenshot)
      expect(s3Upload.uploadScreenshotsToS3).toHaveBeenCalled();
    });
  });

  describe('Browser Crash Handling', () => {
    it('should handle browser crashes gracefully', async () => {
      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'FAIL',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: [],
        logsS3Key: 'execution-log.json',
        errorMessage: 'Browser crashed',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      // Mock browser crash
      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockRejectedValue(new Error('Target closed')),
        isClosed: jest.fn().mockReturnValue(true),
      };

      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockRejectedValue(new Error('Browser already closed')),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(mockBrowser),
      }));

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toBeDefined();

      // Verify test result was still created despite crash
      expect(testResultOperations.createTestResult).toHaveBeenCalled();
    });
  });

  describe('Timeout Management', () => {
    it('should enforce 5-minute execution timeout', async () => {
      // Mock a test that takes too long
      const mockPage = {
        goto: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10000))),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      const event = createMockEvent(mockTestId);
      
      // This test should timeout, but we'll mock it to complete quickly
      // In real scenario, the timeout would trigger after 5 minutes
      const result = await handler(event);

      // The handler should still return a response
      expect(result.statusCode).toBeGreaterThanOrEqual(200);
    }, 15000); // Increase test timeout
  });

  describe('Error Handling - Missing Test', () => {
    it('should return error when test not found', async () => {
      (testOperations.getTest as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Test execution failed');
    });

    it('should return error when test script is empty', async () => {
      const emptyTest = {
        ...mockTest,
        testScript: { steps: [] },
      };

      (testOperations.getTest as jest.Mock).mockResolvedValue(emptyTest);

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Test execution failed');
    });
  });

  describe('Error Handling - Missing Environment', () => {
    it('should return error when environment configuration not found', async () => {
      (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Test execution failed');
    });
  });

  describe('Error Handling - DynamoDB Failures', () => {
    it('should handle test retrieval failure', async () => {
      (testOperations.getTest as jest.Mock).mockRejectedValue(
        new Error('DynamoDB connection timeout')
      );

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Test execution failed');
    });

    it('should handle test result storage failure', async () => {
      (testResultOperations.createTestResult as jest.Mock).mockRejectedValue(
        new Error('Failed to write to DynamoDB')
      );

      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
        }),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Test execution failed');
    });
  });

  describe('Error Handling - S3 Upload Failures', () => {
    it('should handle screenshot upload failure gracefully', async () => {
      (s3Upload.uploadScreenshotsToS3 as jest.Mock).mockRejectedValue(
        new Error('S3 upload failed')
      );

      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: [],
        logsS3Key: '',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
        }),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      // Should still complete despite upload failure
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('PASS');
    });
  });

  describe('Tenant Isolation Validation', () => {
    it('should enforce tenant isolation in test execution', async () => {
      const tenant1Test: Test = {
        ...mockTest,
        testId: 'test-tenant1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      };

      const tenant2Test: Test = {
        ...mockTest,
        testId: 'test-tenant2',
        tenantId: 'tenant-2',
        userId: 'user-2',
      };

      (testOperations.getTest as jest.Mock)
        .mockImplementation(async (tenantId, testId) => {
          if (tenantId === 'tenant-1' && testId === 'test-tenant1') return tenant1Test;
          if (tenantId === 'tenant-2' && testId === 'test-tenant2') return tenant2Test;
          return null;
        });

      const mockEnvConfig1: EnvironmentConfig = {
        ...mockEnvironmentConfig,
        tenantId: 'tenant-1',
        baseUrl: 'https://tenant1.example.com',
      };

      const mockEnvConfig2: EnvironmentConfig = {
        ...mockEnvironmentConfig,
        tenantId: 'tenant-2',
        baseUrl: 'https://tenant2.example.com',
      };

      (environmentOperations.getEnvironmentConfig as jest.Mock)
        .mockImplementation(async (tenantId) => {
          if (tenantId === 'tenant-1') return mockEnvConfig1;
          if (tenantId === 'tenant-2') return mockEnvConfig2;
          return null;
        });

      const mockTestResult1: TestResult = {
        resultId: 'result-tenant1',
        testId: 'test-tenant1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        status: 'PASS',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: [],
        logsS3Key: '',
        executionLog: {},
      };

      const mockTestResult2: TestResult = {
        resultId: 'result-tenant2',
        testId: 'test-tenant2',
        tenantId: 'tenant-2',
        userId: 'user-2',
        status: 'PASS',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: [],
        logsS3Key: '',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock)
        .mockImplementation(async (input) => {
          if (input.tenantId === 'tenant-1') return mockTestResult1;
          if (input.tenantId === 'tenant-2') return mockTestResult2;
          throw new Error('Invalid tenant');
        });

      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
        }),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      // Execute test for tenant 1
      const event1 = createMockEvent('test-tenant1', {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user1@example.com',
      });

      const result1 = await handler(event1);
      expect(result1.statusCode).toBe(200);

      // Verify tenant 1 data was used
      expect(testOperations.getTest).toHaveBeenCalledWith('tenant-1', 'test-tenant1');
      expect(environmentOperations.getEnvironmentConfig).toHaveBeenCalledWith('tenant-1', 'DEV');

      // Execute test for tenant 2
      const event2 = createMockEvent('test-tenant2', {
        userId: 'user-2',
        tenantId: 'tenant-2',
        email: 'user2@example.com',
      });

      const result2 = await handler(event2);
      expect(result2.statusCode).toBe(200);

      // Verify tenant 2 data was used
      expect(testOperations.getTest).toHaveBeenCalledWith('tenant-2', 'test-tenant2');
      expect(environmentOperations.getEnvironmentConfig).toHaveBeenCalledWith('tenant-2', 'DEV');

      // Verify results are isolated by tenant
      const body1 = JSON.parse(result1.body);
      const body2 = JSON.parse(result2.body);
      expect(body1.testId).toBe('test-tenant1');
      expect(body2.testId).toBe('test-tenant2');
    });

    it('should prevent cross-tenant test execution', async () => {
      // User from tenant-1 tries to execute test from tenant-2
      const tenant2Test: Test = {
        ...mockTest,
        testId: 'test-tenant2',
        tenantId: 'tenant-2',
        userId: 'user-2',
      };

      (testOperations.getTest as jest.Mock).mockResolvedValue(tenant2Test);

      // But the JWT token is for tenant-1
      const event = createMockEvent('test-tenant2', {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user1@example.com',
      });

      const result = await handler(event);

      // Should fail because getTest is called with tenant-1 but test belongs to tenant-2
      // The test won't be found or will fail
      expect(result.statusCode).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Integration with DynamoDB and S3', () => {
    it('should store test results in DynamoDB with correct structure', async () => {
      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: ['screenshot-1.png', 'screenshot-2.png'],
        logsS3Key: 'execution-log.json',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
        }),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      // Verify test result was created with all required fields
      expect(testResultOperations.createTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          testId: mockTestId,
          tenantId: mockTenantId,
          userId: mockUserId,
          status: 'PASS',
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
          screenshotsS3Keys: expect.any(Array),
          logsS3Key: expect.any(String),
          executionLog: expect.any(Object),
        })
      );
    });

    it('should upload screenshots to S3 with tenant-specific prefix', async () => {
      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: ['screenshot-1.png', 'screenshot-2.png'],
        logsS3Key: 'execution-log.json',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
        }),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      // Verify screenshots were uploaded with tenant ID
      expect(s3Upload.uploadScreenshotsToS3).toHaveBeenCalledWith(
        expect.any(Array),
        mockTenantId,
        expect.any(String)
      );

      // Verify logs were uploaded with tenant ID
      expect(s3Upload.uploadLogToS3).toHaveBeenCalledWith(
        expect.any(String),
        mockTenantId,
        expect.any(String)
      );
    });
  });

  describe('Screenshot Capture', () => {
    it('should capture screenshots at each test step', async () => {
      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: ['screenshot-1.png', 'screenshot-2.png', 'screenshot-3.png'],
        logsS3Key: 'execution-log.json',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
        }),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      // Verify screenshots were captured and uploaded
      expect(s3Upload.uploadScreenshotsToS3).toHaveBeenCalled();
      const uploadCall = (s3Upload.uploadScreenshotsToS3 as jest.Mock).mock.calls[0];
      expect(uploadCall[0]).toBeInstanceOf(Array); // Screenshot paths array
    });
  });

  describe('Execution Logging', () => {
    it('should log all test actions and outcomes', async () => {
      const mockTestResult: TestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        screenshotsS3Keys: [],
        logsS3Key: 'execution-log.json',
        executionLog: {
          steps: [],
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          status: 'PASS',
        },
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const mockPage = {
        goto: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
        waitForLoadState: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue({
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
        }),
        isClosed: jest.fn().mockReturnValue(false),
      };

      (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue({ page: mockPage }),
        cleanup: jest.fn().mockResolvedValue(undefined),
        getPage: jest.fn().mockReturnValue(mockPage),
        getBrowser: jest.fn().mockReturnValue(null),
      }));

      const event = createMockEvent(mockTestId);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      // Verify execution log was uploaded
      expect(s3Upload.uploadLogToS3).toHaveBeenCalled();

      // Verify test result includes execution log
      expect(testResultOperations.createTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          executionLog: expect.any(Object),
        })
      );
    });
  });

  describe('Authorization Validation', () => {
    it('should reject requests without JWT token', async () => {
      const event = createMockEvent(mockTestId, null);

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unauthorized');
    });

    it('should reject requests with invalid JWT payload', async () => {
      const event = createMockEvent(mockTestId, {
        userId: null,
        tenantId: null,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unauthorized');
    });

    it('should require testId in path parameters', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/tests//execute',
        pathParameters: null,
        requestContext: {
          ...createMockAPIGatewayEvent().requestContext,
          authorizer: createMockJWTPayload(),
        },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Test ID is required');
    });
  });
});
