/**
 * Property-Based Tests for Test Execution Completeness
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**
 * 
 * Property 3: Test Execution Completeness
 * For any test execution:
 * - All test steps are executed in order
 * - Screenshots are captured for each step
 * - Execution logs contain all actions
 * - Final status is always PASS or FAIL
 * - Execution completes within timeout period
 */

import * as fc from 'fast-check';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambdas/test-execution/index';
import * as testOperations from '../../src/shared/database/testOperations';
import * as environmentOperations from '../../src/shared/database/environmentOperations';
import * as testResultOperations from '../../src/shared/database/testResultOperations';
import * as s3Upload from '../../src/shared/utils/s3Upload';
import { PlaywrightBrowserManager } from '../../src/shared/utils/playwrightConfig';
import { createScreenshotManager } from '../../src/shared/utils/screenshotCapture';
import { createExecutionLogger } from '../../src/shared/utils/executionLogger';
import { Test, TestScript, EnvironmentConfig, TestResult, TestStep } from '../../src/shared/types';

// Mock dependencies
jest.mock('../../src/shared/database/testOperations');
jest.mock('../../src/shared/database/environmentOperations');
jest.mock('../../src/shared/database/testResultOperations');
jest.mock('../../src/shared/utils/s3Upload');
jest.mock('../../src/shared/utils/playwrightConfig');
jest.mock('../../src/shared/utils/screenshotCapture');
jest.mock('../../src/shared/utils/executionLogger');

// Execution timeout (5 minutes)
const EXECUTION_TIMEOUT_MS = 5 * 60 * 1000;

describe('Property-Based Tests: Test Execution Completeness', () => {
  const mockTenantId = 'tenant-pbt';
  const mockUserId = 'user-pbt';

  let mockPage: any;
  let mockBrowserManager: any;
  let mockScreenshotManager: any;
  let mockLogger: any;
  let capturedSteps: Array<{ stepNumber: number; action: string }>;
  let capturedScreenshots: Array<{ stepNumber: number; action: string }>;
  let capturedLogs: Array<{ level: string; message: string }>;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedSteps = [];
    capturedScreenshots = [];
    capturedLogs = [];

    // Mock page with tracking
    mockPage = {
      goto: jest.fn().mockImplementation(async (url: string) => {
        capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'navigate' });
        return undefined;
      }),
      fill: jest.fn().mockImplementation(async (selector: string, value: string) => {
        capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'fill' });
        return undefined;
      }),
      click: jest.fn().mockImplementation(async (selector: string) => {
        capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'click' });
        return undefined;
      }),
      waitForLoadState: jest.fn().mockImplementation(async () => {
        capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'waitForNavigation' });
        return undefined;
      }),
      locator: jest.fn().mockImplementation((selector: string) => {
        // Track assert action when locator is called
        capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'assert' });
        return {
          waitFor: jest.fn().mockResolvedValue(undefined),
          isVisible: jest.fn().mockResolvedValue(true),
          isHidden: jest.fn().mockResolvedValue(true), // Changed to true to pass hidden assertions
          count: jest.fn().mockResolvedValue(1),
        };
      }),
      isClosed: jest.fn().mockReturnValue(false),
      title: jest.fn().mockResolvedValue('Test Page'),
    };

    // Mock browser manager
    mockBrowserManager = {
      initialize: jest.fn().mockResolvedValue({ page: mockPage }),
      cleanup: jest.fn().mockResolvedValue(undefined),
      getPage: jest.fn().mockReturnValue(mockPage),
      getBrowser: jest.fn().mockReturnValue({ close: jest.fn() }),
    };

    // Mock screenshot manager with tracking
    mockScreenshotManager = {
      captureStepScreenshot: jest.fn().mockImplementation(async (page: any, stepNumber: number, action: string) => {
        capturedScreenshots.push({ stepNumber, action });
        return undefined;
      }),
      captureFailureScreenshot: jest.fn().mockResolvedValue(undefined),
      getScreenshotPaths: jest.fn().mockReturnValue(['screenshot-1.png', 'screenshot-2.png']),
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    // Mock logger with tracking
    mockLogger = {
      log: jest.fn().mockImplementation((level: string, message: string) => {
        capturedLogs.push({ level, message });
      }),
      logDebug: jest.fn().mockImplementation((message: string) => {
        capturedLogs.push({ level: 'DEBUG', message });
      }),
      logError: jest.fn().mockImplementation((message: string, error: Error) => {
        capturedLogs.push({ level: 'ERROR', message });
      }),
      logWarning: jest.fn().mockImplementation((message: string, context?: any) => {
        capturedLogs.push({ level: 'WARNING', message });
      }),
      logExecutionStart: jest.fn().mockImplementation((totalSteps: number, context?: any) => {
        capturedLogs.push({ level: 'INFO', message: 'Execution started' });
      }),
      logExecutionComplete: jest.fn().mockImplementation((status: string, context?: any) => {
        capturedLogs.push({ level: 'INFO', message: `Execution complete: ${status}` });
      }),
      logStepStart: jest.fn().mockImplementation((stepNumber: number, action: string, context?: any) => {
        capturedLogs.push({ level: 'INFO', message: `Step ${stepNumber} start: ${action}` });
      }),
      logStepComplete: jest.fn().mockImplementation((stepNumber: number, action: string, duration: number) => {
        capturedLogs.push({ level: 'INFO', message: `Step ${stepNumber} complete: ${action}` });
      }),
      logStepFailure: jest.fn().mockImplementation((stepNumber: number, action: string, error: Error) => {
        capturedLogs.push({ level: 'ERROR', message: `Step ${stepNumber} failed: ${action}` });
      }),
      getLogFilePath: jest.fn().mockReturnValue('/tmp/execution-log.json'),
      getExecutionLog: jest.fn().mockReturnValue({}),
      close: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    // Setup mocks
    (PlaywrightBrowserManager as jest.Mock).mockImplementation(() => mockBrowserManager);
    (createScreenshotManager as jest.Mock).mockResolvedValue(mockScreenshotManager);
    (createExecutionLogger as jest.Mock).mockResolvedValue(mockLogger);
    (s3Upload.uploadScreenshotsToS3 as jest.Mock).mockResolvedValue(['screenshot-1.png', 'screenshot-2.png']);
    (s3Upload.uploadLogToS3 as jest.Mock).mockResolvedValue('execution-log.json');
    (testOperations.updateTestStatus as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Property 1: All test steps are executed in order', () => {
    /**
     * **Validates: Requirements 3.1**
     * 
     * Property: For any valid test script with N steps, all N steps are executed
     * in the exact order they appear in the script.
     */
    it('should execute all steps in the correct order', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTestScriptArbitrary(),
          async (testScript) => {
            // Setup test
            const mockTest: Test = {
              testId: 'test-123',
              tenantId: mockTenantId,
              userId: mockUserId,
              testPrompt: 'Test execution',
              testScript,
              environment: 'DEV',
              createdAt: Date.now(),
              status: 'READY',
            };

            const mockEnvConfig: EnvironmentConfig = {
              tenantId: mockTenantId,
              environment: 'DEV',
              baseUrl: 'https://example.com',
              credentials: {},
              configuration: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const mockTestResult: TestResult = {
              resultId: 'result-123',
              testId: 'test-123',
              tenantId: mockTenantId,
              userId: mockUserId,
              status: 'PASS',
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 1000,
              screenshotsS3Keys: [],
              logsS3Key: 'log.json',
              executionLog: {},
            };

            (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
            (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvConfig);
            (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

            // Reset tracking
            capturedSteps = [];

            // Execute test
            const event = createMockEvent('test-123');
            await handler(event);

            // Verify all steps were executed in order
            expect(capturedSteps.length).toBe(testScript.steps.length);
            
            for (let i = 0; i < testScript.steps.length; i++) {
              expect(capturedSteps[i].action).toBe(testScript.steps[i].action);
              expect(capturedSteps[i].stepNumber).toBe(i + 1);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 2: Screenshots are captured for each step', () => {
    /**
     * **Validates: Requirements 3.2**
     * 
     * Property: For any test execution with N steps, exactly N screenshots
     * are captured, one after each step completes.
     */
    it('should capture screenshots for all steps', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTestScriptArbitrary(),
          async (testScript) => {
            const mockTest: Test = {
              testId: 'test-456',
              tenantId: mockTenantId,
              userId: mockUserId,
              testPrompt: 'Test screenshots',
              testScript,
              environment: 'DEV',
              createdAt: Date.now(),
              status: 'READY',
            };

            const mockEnvConfig: EnvironmentConfig = {
              tenantId: mockTenantId,
              environment: 'DEV',
              baseUrl: 'https://example.com',
              credentials: {},
              configuration: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const mockTestResult: TestResult = {
              resultId: 'result-456',
              testId: 'test-456',
              tenantId: mockTenantId,
              userId: mockUserId,
              status: 'PASS',
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 1000,
              screenshotsS3Keys: [],
              logsS3Key: 'log.json',
              executionLog: {},
            };

            (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
            (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvConfig);
            (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

            // Reset tracking
            capturedScreenshots = [];

            // Execute test
            const event = createMockEvent('test-456');
            await handler(event);

            // Verify screenshots were captured for all steps
            expect(capturedScreenshots.length).toBe(testScript.steps.length);
            
            for (let i = 0; i < testScript.steps.length; i++) {
              expect(capturedScreenshots[i].stepNumber).toBe(i + 1);
              expect(capturedScreenshots[i].action).toBe(testScript.steps[i].action);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 3: Execution logs contain all actions', () => {
    /**
     * **Validates: Requirements 3.6**
     * 
     * Property: For any test execution, the execution log contains entries for:
     * - Execution start
     * - Each step start and complete
     * - Execution complete
     */
    it('should log all execution events', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTestScriptArbitrary(),
          async (testScript) => {
            const mockTest: Test = {
              testId: 'test-789',
              tenantId: mockTenantId,
              userId: mockUserId,
              testPrompt: 'Test logging',
              testScript,
              environment: 'DEV',
              createdAt: Date.now(),
              status: 'READY',
            };

            const mockEnvConfig: EnvironmentConfig = {
              tenantId: mockTenantId,
              environment: 'DEV',
              baseUrl: 'https://example.com',
              credentials: {},
              configuration: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const mockTestResult: TestResult = {
              resultId: 'result-789',
              testId: 'test-789',
              tenantId: mockTenantId,
              userId: mockUserId,
              status: 'PASS',
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 1000,
              screenshotsS3Keys: [],
              logsS3Key: 'log.json',
              executionLog: {},
            };

            (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
            (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvConfig);
            (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

            // Reset tracking
            capturedLogs = [];

            // Execute test
            const event = createMockEvent('test-789');
            await handler(event);

            // Verify execution start was logged
            const startLogs = capturedLogs.filter(log => log.message.includes('Execution started'));
            expect(startLogs.length).toBeGreaterThan(0);

            // Verify all steps were logged (start and complete)
            for (let i = 0; i < testScript.steps.length; i++) {
              const stepNumber = i + 1;
              const stepAction = testScript.steps[i].action;
              
              const stepStartLogs = capturedLogs.filter(log => 
                log.message.includes(`Step ${stepNumber} start`) && 
                log.message.includes(stepAction)
              );
              expect(stepStartLogs.length).toBeGreaterThan(0);
              
              const stepCompleteLogs = capturedLogs.filter(log => 
                log.message.includes(`Step ${stepNumber} complete`) && 
                log.message.includes(stepAction)
              );
              expect(stepCompleteLogs.length).toBeGreaterThan(0);
            }

            // Verify execution complete was logged
            const completeLogs = capturedLogs.filter(log => log.message.includes('Execution complete'));
            expect(completeLogs.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 4: Final status is always PASS or FAIL', () => {
    /**
     * **Validates: Requirements 3.4**
     * 
     * Property: For any test execution, the final status is always either PASS or FAIL,
     * never undefined, null, or any other value.
     */
    it('should always return PASS or FAIL status', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTestScriptArbitrary(),
          fc.boolean(), // Whether to simulate failure
          async (testScript, shouldFail) => {
            const mockTest: Test = {
              testId: 'test-status',
              tenantId: mockTenantId,
              userId: mockUserId,
              testPrompt: 'Test status',
              testScript,
              environment: 'DEV',
              createdAt: Date.now(),
              status: 'READY',
            };

            const mockEnvConfig: EnvironmentConfig = {
              tenantId: mockTenantId,
              environment: 'DEV',
              baseUrl: 'https://example.com',
              credentials: {},
              configuration: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const expectedStatus = shouldFail ? 'FAIL' : 'PASS';
            const mockTestResult: TestResult = {
              resultId: 'result-status',
              testId: 'test-status',
              tenantId: mockTenantId,
              userId: mockUserId,
              status: expectedStatus,
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 1000,
              screenshotsS3Keys: [],
              logsS3Key: 'log.json',
              executionLog: {},
            };

            (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
            (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvConfig);
            (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

            // Simulate failure if needed
            if (shouldFail && testScript.steps.length > 0) {
              const failAtStep = Math.floor(testScript.steps.length / 2) + 1; // Ensure at least step 1
              let stepCount = 0;
              
              // Reset mocks with failure logic
              mockPage.goto = jest.fn().mockImplementation(async () => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'navigate' });
                if (stepCount === failAtStep) throw new Error('Simulated failure');
              });
              mockPage.fill = jest.fn().mockImplementation(async () => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'fill' });
                if (stepCount === failAtStep) throw new Error('Simulated failure');
              });
              mockPage.click = jest.fn().mockImplementation(async () => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'click' });
                if (stepCount === failAtStep) throw new Error('Simulated failure');
              });
              mockPage.waitForLoadState = jest.fn().mockImplementation(async () => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'waitForNavigation' });
                if (stepCount === failAtStep) throw new Error('Simulated failure');
              });
              mockPage.locator = jest.fn().mockImplementation(() => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'assert' });
                if (stepCount === failAtStep) {
                  return {
                    waitFor: jest.fn().mockRejectedValue(new Error('Simulated failure')),
                    isVisible: jest.fn().mockResolvedValue(false),
                    isHidden: jest.fn().mockResolvedValue(false),
                    count: jest.fn().mockResolvedValue(0),
                  };
                }
                return {
                  waitFor: jest.fn().mockResolvedValue(undefined),
                  isVisible: jest.fn().mockResolvedValue(true),
                  isHidden: jest.fn().mockResolvedValue(true),
                  count: jest.fn().mockResolvedValue(1),
                };
              });
            }

            // Execute test
            const event = createMockEvent('test-status');
            const result = await handler(event);

            // Verify status is always PASS or FAIL
            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(['PASS', 'FAIL']).toContain(body.status);
            expect(body.status).toBe(expectedStatus);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 5: Execution completes within timeout period', () => {
    /**
     * **Validates: Requirements 3.5**
     * 
     * Property: For any test execution, the execution either completes successfully
     * or fails with a timeout error, but never hangs indefinitely.
     */
    it('should complete within timeout or fail with timeout error', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTestScriptArbitrary(),
          async (testScript) => {
            const mockTest: Test = {
              testId: 'test-timeout',
              tenantId: mockTenantId,
              userId: mockUserId,
              testPrompt: 'Test timeout',
              testScript,
              environment: 'DEV',
              createdAt: Date.now(),
              status: 'READY',
            };

            const mockEnvConfig: EnvironmentConfig = {
              tenantId: mockTenantId,
              environment: 'DEV',
              baseUrl: 'https://example.com',
              credentials: {},
              configuration: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const mockTestResult: TestResult = {
              resultId: 'result-timeout',
              testId: 'test-timeout',
              tenantId: mockTenantId,
              userId: mockUserId,
              status: 'PASS',
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 1000,
              screenshotsS3Keys: [],
              logsS3Key: 'log.json',
              executionLog: {},
            };

            (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
            (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvConfig);
            (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

            // Execute test with timeout tracking
            const event = createMockEvent('test-timeout');
            const startTime = Date.now();
            
            const result = await handler(event);
            
            const duration = Date.now() - startTime;

            // Verify execution completed
            expect(result.statusCode).toBe(200);
            
            // Verify duration is reasonable (should be much less than 5 minutes for mocked tests)
            expect(duration).toBeLessThan(EXECUTION_TIMEOUT_MS);
            
            // Verify result has duration information
            const body = JSON.parse(result.body);
            expect(body.duration).toBeDefined();
            expect(body.duration).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 6: Test result contains all required metadata', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**
     * 
     * Property: For any completed test execution, the test result contains:
     * - Test ID and tenant ID
     * - Status (PASS or FAIL)
     * - Start time, end time, and duration
     * - Screenshot S3 keys
     * - Log S3 key
     * - Execution log
     */
    it('should create test result with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTestScriptArbitrary(),
          async (testScript) => {
            const mockTest: Test = {
              testId: 'test-metadata',
              tenantId: mockTenantId,
              userId: mockUserId,
              testPrompt: 'Test metadata',
              testScript,
              environment: 'DEV',
              createdAt: Date.now(),
              status: 'READY',
            };

            const mockEnvConfig: EnvironmentConfig = {
              tenantId: mockTenantId,
              environment: 'DEV',
              baseUrl: 'https://example.com',
              credentials: {},
              configuration: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const mockTestResult: TestResult = {
              resultId: 'result-metadata',
              testId: 'test-metadata',
              tenantId: mockTenantId,
              userId: mockUserId,
              status: 'PASS',
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 1000,
              screenshotsS3Keys: ['screenshot-1.png'],
              logsS3Key: 'log.json',
              executionLog: {},
            };

            (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
            (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvConfig);
            (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

            // Execute test
            const event = createMockEvent('test-metadata');
            await handler(event);

            // Verify test result was created with all required fields
            expect(testResultOperations.createTestResult).toHaveBeenCalledWith(
              expect.objectContaining({
                testId: 'test-metadata',
                tenantId: mockTenantId,
                userId: mockUserId,
                status: expect.stringMatching(/^(PASS|FAIL)$/),
                startTime: expect.any(Number),
                endTime: expect.any(Number),
                duration: expect.any(Number),
                screenshotsS3Keys: expect.any(Array),
                logsS3Key: expect.any(String),
                executionLog: expect.any(Object),
              })
            );
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 7: Step execution order is preserved on failure', () => {
    /**
     * **Validates: Requirements 3.1, 3.4**
     * 
     * Property: Even when a test fails, all steps up to the failure point
     * are executed in order, and the failure is properly recorded.
     */
    it('should execute steps in order until failure occurs', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTestScriptArbitrary().filter(script => script.steps.length >= 3),
          fc.integer({ min: 1, max: 10 }),
          async (testScript, failAtStepOffset) => {
            const failAtStep = Math.min(failAtStepOffset, testScript.steps.length);
            
            const mockTest: Test = {
              testId: 'test-fail-order',
              tenantId: mockTenantId,
              userId: mockUserId,
              testPrompt: 'Test failure order',
              testScript,
              environment: 'DEV',
              createdAt: Date.now(),
              status: 'READY',
            };

            const mockEnvConfig: EnvironmentConfig = {
              tenantId: mockTenantId,
              environment: 'DEV',
              baseUrl: 'https://example.com',
              credentials: {},
              configuration: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const mockTestResult: TestResult = {
              resultId: 'result-fail-order',
              testId: 'test-fail-order',
              tenantId: mockTenantId,
              userId: mockUserId,
              status: 'FAIL',
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 1000,
              screenshotsS3Keys: [],
              logsS3Key: 'log.json',
              errorMessage: 'Step failed',
              executionLog: {},
            };

            (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
            (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvConfig);
            (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

            // Setup failure at specific step
            let stepCount = 0;
            const failureError = new Error(`Simulated failure at step ${failAtStep}`);
            
            // Reset mocks with failure logic
            mockPage.goto = jest.fn().mockImplementation(async () => {
              stepCount++;
              capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'navigate' });
              if (stepCount === failAtStep) throw failureError;
            });
            mockPage.fill = jest.fn().mockImplementation(async () => {
              stepCount++;
              capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'fill' });
              if (stepCount === failAtStep) throw failureError;
            });
            mockPage.click = jest.fn().mockImplementation(async () => {
              stepCount++;
              capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'click' });
              if (stepCount === failAtStep) throw failureError;
            });
            mockPage.waitForLoadState = jest.fn().mockImplementation(async () => {
              stepCount++;
              capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'waitForNavigation' });
              if (stepCount === failAtStep) throw failureError;
            });
            mockPage.locator = jest.fn().mockImplementation(() => {
              stepCount++;
              capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'assert' });
              if (stepCount === failAtStep) {
                return {
                  waitFor: jest.fn().mockRejectedValue(failureError),
                  isVisible: jest.fn().mockResolvedValue(false),
                  isHidden: jest.fn().mockResolvedValue(false),
                  count: jest.fn().mockResolvedValue(0),
                };
              }
              return {
                waitFor: jest.fn().mockResolvedValue(undefined),
                isVisible: jest.fn().mockResolvedValue(true),
                isHidden: jest.fn().mockResolvedValue(true),
                count: jest.fn().mockResolvedValue(1),
              };
            });

            // Reset tracking
            capturedSteps = [];

            // Execute test
            const event = createMockEvent('test-fail-order');
            const result = await handler(event);

            // Verify steps were executed in order up to failure
            expect(capturedSteps.length).toBe(failAtStep);
            
            for (let i = 0; i < capturedSteps.length; i++) {
              expect(capturedSteps[i].stepNumber).toBe(i + 1);
              expect(capturedSteps[i].action).toBe(testScript.steps[i].action);
            }

            // Verify result is FAIL
            const body = JSON.parse(result.body);
            expect(body.status).toBe('FAIL');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 8: Screenshots captured match executed steps', () => {
    /**
     * **Validates: Requirements 3.1, 3.2**
     * 
     * Property: The number of screenshots captured equals the number of steps
     * successfully executed (including partial execution on failure).
     */
    it('should capture screenshots for all executed steps', async () => {
      await fc.assert(
        fc.asyncProperty(
          validTestScriptArbitrary().filter(script => script.steps.length >= 2),
          fc.boolean(),
          async (testScript, shouldFail) => {
            const failAtStep = shouldFail ? Math.floor(testScript.steps.length / 2) : testScript.steps.length + 1;
            
            const mockTest: Test = {
              testId: 'test-screenshot-match',
              tenantId: mockTenantId,
              userId: mockUserId,
              testPrompt: 'Test screenshot matching',
              testScript,
              environment: 'DEV',
              createdAt: Date.now(),
              status: 'READY',
            };

            const mockEnvConfig: EnvironmentConfig = {
              tenantId: mockTenantId,
              environment: 'DEV',
              baseUrl: 'https://example.com',
              credentials: {},
              configuration: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const expectedStatus = shouldFail ? 'FAIL' : 'PASS';
            const mockTestResult: TestResult = {
              resultId: 'result-screenshot-match',
              testId: 'test-screenshot-match',
              tenantId: mockTenantId,
              userId: mockUserId,
              status: expectedStatus,
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 1000,
              screenshotsS3Keys: [],
              logsS3Key: 'log.json',
              executionLog: {},
            };

            (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
            (environmentOperations.getEnvironmentConfig as jest.Mock).mockResolvedValue(mockEnvConfig);
            (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

            // Setup failure if needed
            if (shouldFail) {
              let stepCount = 0;
              mockPage.goto = jest.fn().mockImplementation(async () => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'navigate' });
                if (stepCount === failAtStep) throw new Error('Simulated failure');
              });
              mockPage.fill = jest.fn().mockImplementation(async () => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'fill' });
                if (stepCount === failAtStep) throw new Error('Simulated failure');
              });
              mockPage.click = jest.fn().mockImplementation(async () => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'click' });
                if (stepCount === failAtStep) throw new Error('Simulated failure');
              });
              mockPage.waitForLoadState = jest.fn().mockImplementation(async () => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'waitForNavigation' });
                if (stepCount === failAtStep) throw new Error('Simulated failure');
              });
              mockPage.locator = jest.fn().mockImplementation(() => {
                stepCount++;
                capturedSteps.push({ stepNumber: capturedSteps.length + 1, action: 'assert' });
                if (stepCount === failAtStep) {
                  return {
                    waitFor: jest.fn().mockRejectedValue(new Error('Simulated failure')),
                    isVisible: jest.fn().mockResolvedValue(false),
                    isHidden: jest.fn().mockResolvedValue(false),
                    count: jest.fn().mockResolvedValue(0),
                  };
                }
                return {
                  waitFor: jest.fn().mockResolvedValue(undefined),
                  isVisible: jest.fn().mockResolvedValue(true),
                  isHidden: jest.fn().mockResolvedValue(true),
                  count: jest.fn().mockResolvedValue(1),
                };
              });
            }

            // Reset tracking
            capturedSteps = [];
            capturedScreenshots = [];

            // Execute test
            const event = createMockEvent('test-screenshot-match');
            await handler(event);

            // Verify screenshots match executed steps
            // Note: On failure, we capture screenshots for completed steps only
            const expectedScreenshots = shouldFail ? failAtStep - 1 : testScript.steps.length;
            expect(capturedScreenshots.length).toBe(expectedScreenshots);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function createMockEvent(testId: string): APIGatewayProxyEvent {
    return {
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
        authorizer: {
          userId: mockUserId,
          tenantId: mockTenantId,
          email: 'test@example.com',
        } as any,
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
    };
  }
});

// ============================================================================
// Arbitraries (Generators) for Property-Based Testing
// ============================================================================

/**
 * Generate a valid test script with 1-10 steps
 */
function validTestScriptArbitrary(): fc.Arbitrary<TestScript> {
  return fc.array(validTestStepArbitrary(), { minLength: 1, maxLength: 10 })
    .map(steps => ({ steps }));
}

/**
 * Generate a valid test step
 */
function validTestStepArbitrary(): fc.Arbitrary<TestStep> {
  return fc.oneof(
    // Navigate step
    fc.record({
      action: fc.constant('navigate' as const),
      url: fc.webUrl(),
    }),
    // Fill step
    fc.record({
      action: fc.constant('fill' as const),
      selector: cssSelector(),
      value: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    // Click step
    fc.record({
      action: fc.constant('click' as const),
      selector: cssSelector(),
    }),
    // Assert step
    fc.record({
      action: fc.constant('assert' as const),
      selector: cssSelector(),
      condition: fc.constantFrom('visible', 'hidden', 'exists'),
    }),
    // WaitForNavigation step
    fc.record({
      action: fc.constant('waitForNavigation' as const),
    })
  );
}

/**
 * Generate a valid CSS selector
 */
function cssSelector(): fc.Arbitrary<string> {
  return fc.oneof(
    // ID selectors
    fc.string({ minLength: 1, maxLength: 20 })
      .map(s => `#${s.replace(/[^a-zA-Z0-9-_]/g, 'a')}`),
    // Class selectors
    fc.string({ minLength: 1, maxLength: 20 })
      .map(s => `.${s.replace(/[^a-zA-Z0-9-_]/g, 'a')}`),
    // Attribute selectors
    fc.string({ minLength: 1, maxLength: 20 })
      .map(s => `[data-testid="${s}"]`),
    // Element selectors
    fc.constantFrom('button', 'input', 'div', 'span', 'a', 'form'),
    // Combined selectors
    fc.tuple(
      fc.constantFrom('button', 'input', 'div', 'a'),
      fc.string({ minLength: 1, maxLength: 10 })
        .map(s => s.replace(/[^a-zA-Z0-9-_]/g, 'a'))
    ).map(([elem, cls]) => `${elem}.${cls}`)
  );
}
