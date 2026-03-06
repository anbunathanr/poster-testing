/**
 * Test Execution Lambda
 *
 * Executes Playwright tests based on test scripts stored in DynamoDB.
 * Handles test step execution, screenshot capture, logging, and result storage.
 *
 * POST /tests/{testId}/execute
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { JWTPayload, TestResult, Test } from '../../shared/types';
import { getTest, updateTestStatus } from '../../shared/database/testOperations';
import { getEnvironmentConfig } from '../../shared/database/environmentOperations';
import { createTestResult } from '../../shared/database/testResultOperations';
import { PlaywrightBrowserManager } from '../../shared/utils/playwrightConfig';
import {
  createScreenshotManager,
  ScreenshotCaptureManager,
} from '../../shared/utils/screenshotCapture';
import { createExecutionLogger, LogLevel } from '../../shared/utils/executionLogger';
import { uploadScreenshotsToS3, uploadLogToS3 } from '../../shared/utils/s3Upload';
import { formatTestNotification, formatSNSMessage } from '../../shared/utils/notificationFormatter';
import {
  emitTestExecutionDuration,
  emitTestSuccessRate,
  emitTestFailureRate,
  emitAPILatency,
} from '../../shared/utils/cloudwatchMetrics';
import type { Page } from 'playwright-core';
import { v4 as uuidv4 } from 'uuid';

// Task 7.5: 5-minute timeout limit (300 seconds)
const EXECUTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const TIMEOUT_BUFFER_MS = 10 * 1000; // 10 second buffer for cleanup

// Task 9.5: Initialize SNS client for notifications
const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const NOTIFICATION_TOPIC_ARN = process.env.NOTIFICATION_TOPIC_ARN;

/**
 * Lambda handler for test execution
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Test Execution Lambda invoked', { path: event.path, method: event.httpMethod });

  try {
    // Extract JWT payload from authorizer context
    const jwtPayload = event.requestContext.authorizer as unknown as JWTPayload;
    if (!jwtPayload || !jwtPayload.tenantId || !jwtPayload.userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized: Invalid token' }),
      };
    }

    // Extract testId from path parameters
    const testId = event.pathParameters?.testId;
    if (!testId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Test ID is required' }),
      };
    }

    // Task 7.5: Execute the test with timeout
    const result = await executeTestWithTimeout(
      testId,
      jwtPayload.tenantId,
      jwtPayload.userId,
      EXECUTION_TIMEOUT_MS - TIMEOUT_BUFFER_MS
    );

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    // Task 7.4.2: Log error details and stack traces to CloudWatch
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Error',
      code: (error as any)?.code,
      testId: event.pathParameters?.testId,
      tenantId: (event.requestContext.authorizer as any)?.tenantId,
      userId: (event.requestContext.authorizer as any)?.userId,
      timestamp: new Date().toISOString(),
    };

    console.error('Test execution failed:', JSON.stringify(errorDetails, null, 2));

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Test execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

/**
 * Task 7.5: Execute test with timeout management
 * Wraps test execution with a timeout to ensure Lambda doesn't exceed 5-minute limit
 */
async function executeTestWithTimeout(
  testId: string,
  tenantId: string,
  userId: string,
  timeoutMs: number
): Promise<any> {
  return Promise.race([
    executeTest(testId, tenantId, userId),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Test execution timeout: exceeded ${timeoutMs / 1000} seconds`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Execute a test
 */
async function executeTest(testId: string, tenantId: string, userId: string) {
  const resultId = uuidv4();
  const startTime = Date.now();

  // Initialize logger
  const logger = await createExecutionLogger(testId, resultId);
  logger.logExecutionStart(0, { testId, tenantId, userId });

  let browserManager: PlaywrightBrowserManager | null = null;
  let screenshotManager: ScreenshotCaptureManager | null = null;

  try {
    // Task 7.2.1: Retrieve test script from DynamoDB
    logger.log(LogLevel.INFO, 'Retrieving test script from DynamoDB');
    const test = await getTest(tenantId, testId);

    if (!test) {
      throw new Error('Test not found');
    }

    if (!test.testScript || !test.testScript.steps || test.testScript.steps.length === 0) {
      throw new Error('Test script is empty or invalid');
    }

    logger.log(LogLevel.INFO, `Test script retrieved: ${test.testScript.steps.length} steps`);
    logger.logExecutionStart(test.testScript.steps.length);

    // Update test status to EXECUTING
    await updateTestStatus(tenantId, testId, 'EXECUTING');

    // Task 7.2.2: Retrieve environment configuration
    logger.log(LogLevel.INFO, 'Retrieving environment configuration');
    const envConfig = await getEnvironmentConfig(tenantId, test.environment);

    if (!envConfig) {
      throw new Error(`Environment configuration not found for ${test.environment}`);
    }

    logger.log(LogLevel.INFO, `Environment configuration retrieved: ${envConfig.baseUrl}`);

    // Task 7.2.3: Initialize Playwright browser
    logger.log(LogLevel.INFO, 'Initializing Playwright browser');
    browserManager = new PlaywrightBrowserManager();
    const { page } = await browserManager.initialize({
      headless: true,
      timeout: 30000,
    });

    logger.log(LogLevel.INFO, 'Browser initialized successfully');

    // Initialize screenshot manager
    screenshotManager = await createScreenshotManager(testId, resultId);
    logger.log(LogLevel.INFO, 'Screenshot manager initialized');

    // Task 7.3: Execute test steps
    await executeTestSteps(page, test.testScript.steps, screenshotManager, logger);

    // Test passed
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.logExecutionComplete('PASS', { duration });

    // Upload evidence to S3
    const screenshotPaths = screenshotManager.getScreenshotPaths();
    const screenshotsS3Keys = await uploadScreenshotsToS3(screenshotPaths, tenantId, resultId);

    await logger.close();
    const logsS3Key = await uploadLogToS3(logger.getLogFilePath(), tenantId, resultId);

    // Store test result in DynamoDB
    const testResult = await createTestResult({
      testId,
      tenantId,
      userId,
      status: 'PASS',
      startTime,
      endTime,
      duration,
      screenshotsS3Keys,
      logsS3Key,
      executionLog: logger.getExecutionLog(),
    });

    // Update test status to COMPLETED
    await updateTestStatus(tenantId, testId, 'COMPLETED');

    // Emit CloudWatch metrics for successful test
    await emitTestExecutionDuration(duration);
    await emitTestSuccessRate(1); // 100% success for this test
    await emitAPILatency(duration, '/tests/execute');

    // Task 9.5: Send notification after test execution completes (non-blocking)
    // Use Promise.resolve().then() to ensure notification is sent asynchronously
    // This prevents notification failures from affecting the test result response
    Promise.resolve()
      .then(() => sendTestNotification(testResult, testId, tenantId))
      .catch((error) => {
        console.error('Failed to send test notification:', error);
        // Don't throw - notification failures should not affect test execution
      });

    // Cleanup
    await screenshotManager.cleanup();
    await logger.cleanup();

    return {
      resultId: testResult.resultId,
      testId,
      status: 'PASS',
      duration,
      message: 'Test execution completed successfully',
    };
  } catch (error) {
    // Task 7.4: Test failed - comprehensive error handling
    const endTime = Date.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Task 7.4.2: Log error details and stack traces to CloudWatch
    const errorDetails = {
      testId,
      tenantId,
      userId,
      resultId,
      errorMessage,
      errorStack,
      errorName: error instanceof Error ? error.name : 'Error',
      errorCode: (error as any)?.code,
      duration,
      timestamp: new Date().toISOString(),
    };

    console.error('Test execution error:', JSON.stringify(errorDetails, null, 2));

    // Log to execution logger
    logger.logError('Test execution failed', error as Error);
    logger.logExecutionComplete('FAIL', { duration, error: errorMessage, stack: errorStack });

    // Task 7.4.1: Try to capture failure screenshot if browser is available
    // Task 7.4.3: Handle browser crashes gracefully
    if (browserManager?.getPage() && screenshotManager) {
      try {
        const page = browserManager.getPage();
        // Check if page is still accessible (not crashed)
        if (page && !page.isClosed()) {
          // Additional check: verify browser is still connected
          try {
            // Try to get the page title to verify browser is responsive
            await Promise.race([
              page.title(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Browser unresponsive')), 2000)
              ),
            ]);

            // Browser is responsive, capture screenshot
            await screenshotManager.captureFailureScreenshot(page, 0, 'execution_failure');
            logger.log(LogLevel.INFO, 'Failure screenshot captured successfully');
          } catch (responsiveError) {
            // Browser is unresponsive or crashed
            logger.logWarning(
              'Cannot capture failure screenshot: browser is unresponsive or crashed',
              {
                error: responsiveError instanceof Error ? responsiveError.message : 'Unknown error',
              }
            );
          }
        } else {
          logger.logWarning('Cannot capture failure screenshot: browser page is closed or crashed');
        }
      } catch (screenshotError) {
        // Task 7.4.3: Gracefully handle screenshot capture failures
        // Task 7.4.2: Log screenshot errors with full details
        const screenshotErrorDetails = {
          testId,
          resultId,
          errorMessage:
            screenshotError instanceof Error ? screenshotError.message : 'Unknown error',
          errorStack: screenshotError instanceof Error ? screenshotError.stack : undefined,
          errorName: screenshotError instanceof Error ? screenshotError.name : 'Error',
          context: 'failure_screenshot_capture',
          timestamp: new Date().toISOString(),
        };

        console.error(
          'Failed to capture failure screenshot:',
          JSON.stringify(screenshotErrorDetails, null, 2)
        );

        logger.logWarning('Failed to capture failure screenshot', {
          error: screenshotError instanceof Error ? screenshotError.message : 'Unknown error',
          stack: screenshotError instanceof Error ? screenshotError.stack : undefined,
        });
      }
    } else {
      logger.logWarning(
        'Cannot capture failure screenshot: browser or screenshot manager not initialized'
      );
    }

    // Upload evidence to S3
    let screenshotsS3Keys: string[] = [];
    let logsS3Key = '';

    try {
      if (screenshotManager) {
        const screenshotPaths = screenshotManager.getScreenshotPaths();
        screenshotsS3Keys = await uploadScreenshotsToS3(screenshotPaths, tenantId, resultId);
      }

      await logger.close();
      logsS3Key = await uploadLogToS3(logger.getLogFilePath(), tenantId, resultId);
    } catch (uploadError) {
      // Task 7.4.2: Log upload errors with full details
      const uploadErrorDetails = {
        testId,
        resultId,
        tenantId,
        errorMessage: uploadError instanceof Error ? uploadError.message : 'Unknown error',
        errorStack: uploadError instanceof Error ? uploadError.stack : undefined,
        errorName: uploadError instanceof Error ? uploadError.name : 'Error',
        context: 'evidence_upload',
        timestamp: new Date().toISOString(),
      };

      console.error('Failed to upload evidence:', JSON.stringify(uploadErrorDetails, null, 2));
    }

    // Store test result in DynamoDB
    const testResult = await createTestResult({
      testId,
      tenantId,
      userId,
      status: 'FAIL',
      startTime,
      endTime,
      duration,
      screenshotsS3Keys,
      logsS3Key,
      errorMessage,
      executionLog: logger.getExecutionLog(),
    });

    // Update test status to COMPLETED
    await updateTestStatus(tenantId, testId, 'COMPLETED');

    // Emit CloudWatch metrics for failed test
    await emitTestExecutionDuration(duration);
    await emitTestFailureRate(1); // 100% failure for this test
    await emitAPILatency(duration, '/tests/execute');

    // Task 9.5: Send notification after test execution completes (non-blocking)
    // Use Promise.resolve().then() to ensure notification is sent asynchronously
    // This prevents notification failures from affecting the test result response
    Promise.resolve()
      .then(() => sendTestNotification(testResult, testId, tenantId))
      .catch((error) => {
        console.error('Failed to send test notification:', error);
        // Don't throw - notification failures should not affect test execution
      });

    // Cleanup
    if (screenshotManager) {
      await screenshotManager.cleanup();
    }
    await logger.cleanup();

    return {
      resultId: testResult.resultId,
      testId,
      status: 'FAIL',
      duration,
      errorMessage,
      message: 'Test execution failed',
    };
  } finally {
    // Task 7.4.3: Cleanup browser resources gracefully, even after crashes
    if (browserManager) {
      try {
        // Add timeout to cleanup to prevent hanging
        await Promise.race([
          browserManager.cleanup(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Browser cleanup timeout')), 10000)
          ),
        ]);
        logger.log(LogLevel.INFO, 'Browser resources cleaned up successfully');
      } catch (cleanupError) {
        // Task 7.4.2: Log cleanup errors with full details
        const cleanupErrorDetails = {
          testId,
          resultId,
          errorMessage: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
          errorStack: cleanupError instanceof Error ? cleanupError.stack : undefined,
          errorName: cleanupError instanceof Error ? cleanupError.name : 'Error',
          context: 'browser_cleanup',
          timestamp: new Date().toISOString(),
        };

        console.error('Browser cleanup error:', JSON.stringify(cleanupErrorDetails, null, 2));

        logger.logWarning('Browser cleanup encountered errors', {
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
          stack: cleanupError instanceof Error ? cleanupError.stack : undefined,
        });

        // Task 7.4.3: Force cleanup if normal cleanup fails
        // This ensures resources are released even if browser crashed
        try {
          const browser = browserManager.getBrowser();
          if (browser) {
            // Try to force close the browser process
            await Promise.race([
              browser.close(),
              new Promise((resolve) => setTimeout(resolve, 3000)),
            ]);
          }
        } catch (forceCleanupError) {
          console.error('Force cleanup also failed:', {
            error: forceCleanupError instanceof Error ? forceCleanupError.message : 'Unknown error',
          });
        }
      }
    }
  }
}

/**
 * Task 9.5: Send test notification via SNS
 * Publishes notification to SNS after test execution completes
 * Handles both PASS and FAIL test results
 * Ensures notifications are sent asynchronously (non-blocking)
 *
 * @param testResult - The test result object
 * @param testId - The test ID
 * @param tenantId - The tenant ID
 */
async function sendTestNotification(
  testResult: TestResult,
  testId: string,
  tenantId: string
): Promise<void> {
  // Task 9.5: Validate SNS topic ARN is configured
  if (!NOTIFICATION_TOPIC_ARN) {
    console.warn('NOTIFICATION_TOPIC_ARN not configured, skipping notification', {
      resultId: testResult.resultId,
      testId,
      status: testResult.status,
    });
    return;
  }

  try {
    console.log('Sending test notification', {
      resultId: testResult.resultId,
      testId,
      status: testResult.status,
      tenantId,
    });

    // Task 9.5: Retrieve test details for richer notification context
    let test: Test | null = null;
    try {
      test = await getTest(tenantId, testId);
    } catch (error) {
      // Log error but continue with notification (without test context)
      console.warn('Failed to retrieve test details for notification', {
        testId,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Task 9.5: Format the notification message using the notification formatter
    const notification = formatTestNotification(testResult, test || undefined);

    // Task 9.5: Convert to SNS message format
    const snsMessage = formatSNSMessage(notification);

    // Task 9.5: Publish notification to SNS
    const publishCommand = new PublishCommand({
      TopicArn: NOTIFICATION_TOPIC_ARN,
      ...snsMessage,
    });

    await snsClient.send(publishCommand);

    console.log('Notification sent successfully', {
      resultId: testResult.resultId,
      testId,
      status: testResult.status,
      subject: notification.subject,
    });
  } catch (error) {
    // Task 9.5: Add proper error handling for notification failures
    // Log error but don't fail the test execution
    const notificationError = {
      resultId: testResult.resultId,
      testId,
      tenantId,
      status: testResult.status,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : 'Error',
      errorCode: (error as any)?.code,
      timestamp: new Date().toISOString(),
    };

    console.error('Failed to send notification:', JSON.stringify(notificationError, null, 2));

    // The SNS delivery policy will handle retries automatically
    // Failed notifications will be sent to the DLQ if configured
  }
}

/**
 * Execute test steps sequentially
 * Task 7.3: Implement test step execution engine
 */
async function executeTestSteps(
  page: Page,
  steps: any[],
  screenshotManager: ScreenshotCaptureManager,
  logger: Awaited<ReturnType<typeof createExecutionLogger>>
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNumber = i + 1;
    const stepStartTime = Date.now();

    logger.logStepStart(stepNumber, step.action, { step });

    try {
      // Task 7.4.3: Check if browser is still alive before executing step
      if (page.isClosed()) {
        throw new Error('Browser page was closed unexpectedly (possible crash)');
      }

      // Execute step based on action type
      switch (step.action) {
        case 'navigate':
          await handleNavigate(page, step, logger);
          break;

        case 'fill':
          await handleFill(page, step, logger);
          break;

        case 'click':
          await handleClick(page, step, logger);
          break;

        case 'assert':
          await handleAssert(page, step, logger);
          break;

        case 'waitForNavigation':
          await handleWaitForNavigation(page, step, logger);
          break;

        default:
          throw new Error(`Unknown action: ${step.action}`);
      }

      // Task 7.3.6: Capture screenshot after each step
      // Task 7.4.3: Handle screenshot failures gracefully (browser might have crashed)
      try {
        await screenshotManager.captureStepScreenshot(page, stepNumber, step.action);
      } catch (screenshotError) {
        logger.logWarning('Failed to capture step screenshot', {
          stepNumber,
          error: screenshotError instanceof Error ? screenshotError.message : 'Unknown error',
        });
        // Don't fail the test if screenshot capture fails
      }

      const stepDuration = Date.now() - stepStartTime;
      logger.logStepComplete(stepNumber, step.action, stepDuration);
    } catch (error) {
      // Task 7.4.3: Detect browser crashes from error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isBrowserCrash =
        errorMessage.includes('Target closed') ||
        errorMessage.includes('Browser closed') ||
        errorMessage.includes('Session closed') ||
        errorMessage.includes('Protocol error') ||
        errorMessage.includes('Browser crashed') ||
        page.isClosed();

      if (isBrowserCrash) {
        logger.logError('Browser crash detected during step execution', error as Error);
        console.error('Browser crash detected:', {
          stepNumber,
          stepAction: step.action,
          errorMessage,
          timestamp: new Date().toISOString(),
        });
      }

      // Capture failure screenshot (will be skipped if browser crashed)
      try {
        if (!page.isClosed()) {
          await screenshotManager.captureFailureScreenshot(page, stepNumber, step.action);
        }
      } catch (screenshotError) {
        logger.logWarning('Failed to capture failure screenshot', {
          error: screenshotError instanceof Error ? screenshotError.message : 'Unknown error',
        });
      }

      // Task 7.4.2: Log error with full context to CloudWatch
      const stepErrorDetails = {
        stepNumber,
        stepAction: step.action,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : 'Error',
        isBrowserCrash,
        step,
        timestamp: new Date().toISOString(),
      };

      console.error('Step execution error:', JSON.stringify(stepErrorDetails, null, 2));

      logger.logStepFailure(stepNumber, step.action, error as Error);
      throw error;
    }
  }
}

/**
 * Task 7.3.1: Handle 'navigate' action
 */
async function handleNavigate(
  page: Page,
  step: any,
  logger: Awaited<ReturnType<typeof createExecutionLogger>>
): Promise<void> {
  if (!step.url) {
    throw new Error('Navigate action requires a URL');
  }

  logger.logDebug(`Navigating to: ${step.url}`);

  try {
    await page.goto(step.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    logger.logDebug(`Navigation successful: ${step.url}`);
  } catch (error) {
    throw new Error(
      `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Task 7.3.2: Handle 'fill' action
 */
async function handleFill(
  page: Page,
  step: any,
  logger: Awaited<ReturnType<typeof createExecutionLogger>>
): Promise<void> {
  if (!step.selector) {
    throw new Error('Fill action requires a selector');
  }
  if (step.value === undefined || step.value === null) {
    throw new Error('Fill action requires a value');
  }

  logger.logDebug(`Filling field: ${step.selector} with value: ${step.value}`);

  try {
    await page.fill(step.selector, String(step.value), {
      timeout: 10000,
    });

    logger.logDebug(`Fill successful: ${step.selector}`);
  } catch (error) {
    throw new Error(
      `Fill failed for selector "${step.selector}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Task 7.3.3: Handle 'click' action
 */
async function handleClick(
  page: Page,
  step: any,
  logger: Awaited<ReturnType<typeof createExecutionLogger>>
): Promise<void> {
  if (!step.selector) {
    throw new Error('Click action requires a selector');
  }

  logger.logDebug(`Clicking element: ${step.selector}`);

  try {
    await page.click(step.selector, {
      timeout: 10000,
    });

    logger.logDebug(`Click successful: ${step.selector}`);
  } catch (error) {
    throw new Error(
      `Click failed for selector "${step.selector}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Task 7.3.4: Handle 'assert' action
 */
async function handleAssert(
  page: Page,
  step: any,
  logger: Awaited<ReturnType<typeof createExecutionLogger>>
): Promise<void> {
  if (!step.selector) {
    throw new Error('Assert action requires a selector');
  }
  if (!step.condition) {
    throw new Error('Assert action requires a condition');
  }

  logger.logDebug(`Asserting: ${step.selector} is ${step.condition}`);

  try {
    const element = page.locator(step.selector);

    switch (step.condition) {
      case 'visible':
        await element.waitFor({ state: 'visible', timeout: 10000 });
        const isVisible = await element.isVisible();
        if (!isVisible) {
          throw new Error(`Element "${step.selector}" is not visible`);
        }
        break;

      case 'hidden':
        await element.waitFor({ state: 'hidden', timeout: 10000 });
        const isHidden = await element.isHidden();
        if (!isHidden) {
          throw new Error(`Element "${step.selector}" is not hidden`);
        }
        break;

      case 'exists':
        const count = await element.count();
        if (count === 0) {
          throw new Error(`Element "${step.selector}" does not exist`);
        }
        break;

      default:
        throw new Error(`Unknown assertion condition: ${step.condition}`);
    }

    logger.logDebug(`Assertion successful: ${step.selector} is ${step.condition}`);
  } catch (error) {
    throw new Error(
      `Assertion failed for selector "${step.selector}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Task 7.3.5: Handle 'waitForNavigation' action
 */
async function handleWaitForNavigation(
  page: Page,
  _step: any,
  logger: Awaited<ReturnType<typeof createExecutionLogger>>
): Promise<void> {
  logger.logDebug('Waiting for navigation');

  try {
    await page.waitForLoadState('domcontentloaded', {
      timeout: 30000,
    });

    logger.logDebug('Navigation wait successful');
  } catch (error) {
    throw new Error(
      `Wait for navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
