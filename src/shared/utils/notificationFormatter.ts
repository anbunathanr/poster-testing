/**
 * Notification Message Formatter
 * 
 * Formats notification messages for test results to be sent via SNS.
 * Supports PASS and FAIL notifications with comprehensive metadata.
 * 
 * Requirements:
 * - 5.1: Format PASS notifications
 * - 5.2: Format FAIL notifications with error summary
 * - 5.3: Include test metadata in notifications
 */

import { TestResult, Test } from '../types';

/**
 * Notification message structure for SNS
 */
export interface NotificationMessage {
  subject: string;
  message: string;
  metadata: NotificationMetadata;
}

/**
 * Metadata included in all notifications
 */
export interface NotificationMetadata {
  testId: string;
  resultId: string;
  status: 'PASS' | 'FAIL';
  duration: number;
  startTime: number;
  endTime: number;
  environment?: string;
  testName?: string;
  tenantId: string;
  userId: string;
}

/**
 * Task 9.4.1: Format PASS notification
 * Creates a success notification message with test metadata
 * 
 * @param testResult - The test result object
 * @param test - Optional test object for additional context
 * @returns Formatted notification message
 */
export function formatPassNotification(
  testResult: TestResult,
  test?: Test
): NotificationMessage {
  const durationSeconds = (testResult.duration / 1000).toFixed(2);
  const timestamp = new Date(testResult.endTime).toISOString();

  const subject = `✅ Test Passed: ${test?.testPrompt?.substring(0, 50) || testResult.testId}`;

  const message = `
Test Execution Successful
========================

Status: PASS ✅
Test ID: ${testResult.testId}
Result ID: ${testResult.resultId}
Duration: ${durationSeconds}s
Completed: ${timestamp}
${test?.environment ? `Environment: ${test.environment}` : ''}

${test?.testPrompt ? `Test Description:\n${test.testPrompt}\n` : ''}
All test steps completed successfully.

---
Tenant ID: ${testResult.tenantId}
User ID: ${testResult.userId}
`.trim();

  return {
    subject,
    message,
    metadata: {
      testId: testResult.testId,
      resultId: testResult.resultId,
      status: 'PASS',
      duration: testResult.duration,
      startTime: testResult.startTime,
      endTime: testResult.endTime,
      environment: test?.environment,
      testName: test?.testPrompt,
      tenantId: testResult.tenantId,
      userId: testResult.userId,
    },
  };
}

/**
 * Task 9.4.2: Format FAIL notification with error summary
 * Creates a failure notification message with error details and test metadata
 * 
 * @param testResult - The test result object
 * @param test - Optional test object for additional context
 * @returns Formatted notification message
 */
export function formatFailNotification(
  testResult: TestResult,
  test?: Test
): NotificationMessage {
  const durationSeconds = (testResult.duration / 1000).toFixed(2);
  const timestamp = new Date(testResult.endTime).toISOString();
  const errorSummary = testResult.errorMessage || 'Test execution failed';

  const subject = `❌ Test Failed: ${test?.testPrompt?.substring(0, 50) || testResult.testId}`;

  const message = `
Test Execution Failed
=====================

Status: FAIL ❌
Test ID: ${testResult.testId}
Result ID: ${testResult.resultId}
Duration: ${durationSeconds}s
Failed: ${timestamp}
${test?.environment ? `Environment: ${test.environment}` : ''}

${test?.testPrompt ? `Test Description:\n${test.testPrompt}\n` : ''}
Error Summary:
${errorSummary}

${testResult.executionLog?.failedStep ? `Failed Step: ${testResult.executionLog.failedStep}` : ''}
${testResult.executionLog?.stepNumber ? `Step Number: ${testResult.executionLog.stepNumber}` : ''}

Please review the execution logs and screenshots for detailed failure information.

---
Tenant ID: ${testResult.tenantId}
User ID: ${testResult.userId}
`.trim();

  return {
    subject,
    message,
    metadata: {
      testId: testResult.testId,
      resultId: testResult.resultId,
      status: 'FAIL',
      duration: testResult.duration,
      startTime: testResult.startTime,
      endTime: testResult.endTime,
      environment: test?.environment,
      testName: test?.testPrompt,
      tenantId: testResult.tenantId,
      userId: testResult.userId,
    },
  };
}

/**
 * Task 9.4.3: Format notification with complete test metadata
 * Main entry point for formatting notifications based on test result status
 * 
 * @param testResult - The test result object
 * @param test - Optional test object for additional context
 * @returns Formatted notification message
 */
export function formatTestNotification(
  testResult: TestResult,
  test?: Test
): NotificationMessage {
  if (testResult.status === 'PASS') {
    return formatPassNotification(testResult, test);
  } else {
    return formatFailNotification(testResult, test);
  }
}

/**
 * Format notification message for SNS publishing
 * Converts NotificationMessage to SNS message format
 * 
 * @param notification - The notification message object
 * @returns SNS message structure
 */
export function formatSNSMessage(notification: NotificationMessage): {
  Subject: string;
  Message: string;
  MessageAttributes: Record<string, { DataType: string; StringValue: string }>;
} {
  return {
    Subject: notification.subject,
    Message: notification.message,
    MessageAttributes: {
      testId: {
        DataType: 'String',
        StringValue: notification.metadata.testId,
      },
      resultId: {
        DataType: 'String',
        StringValue: notification.metadata.resultId,
      },
      status: {
        DataType: 'String',
        StringValue: notification.metadata.status,
      },
      tenantId: {
        DataType: 'String',
        StringValue: notification.metadata.tenantId,
      },
      userId: {
        DataType: 'String',
        StringValue: notification.metadata.userId,
      },
      duration: {
        DataType: 'Number',
        StringValue: notification.metadata.duration.toString(),
      },
      ...(notification.metadata.environment && {
        environment: {
          DataType: 'String',
          StringValue: notification.metadata.environment,
        },
      }),
    },
  };
}
