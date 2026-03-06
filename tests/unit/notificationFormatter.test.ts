/**
 * Unit tests for notification message formatting
 * Tests Requirements 5.1, 5.2, 5.3
 */

import {
  formatPassNotification,
  formatFailNotification,
  formatTestNotification,
  formatSNSMessage,
  NotificationMessage,
} from '../../src/shared/utils/notificationFormatter';
import { TestResult, Test } from '../../src/shared/types';

describe('Notification Formatter', () => {
  const mockTestResult: TestResult = {
    resultId: 'result-123',
    testId: 'test-456',
    tenantId: 'tenant-789',
    userId: 'user-abc',
    status: 'PASS',
    startTime: 1707753600000,
    endTime: 1707753645000,
    duration: 45000,
    screenshotsS3Keys: ['screenshot1.png', 'screenshot2.png'],
    logsS3Key: 'logs/execution.json',
    executionLog: {},
  };

  const mockTest: Test = {
    testId: 'test-456',
    tenantId: 'tenant-789',
    userId: 'user-abc',
    testPrompt: 'Test login functionality with valid credentials',
    testScript: { steps: [] },
    environment: 'DEV',
    createdAt: 1707753500000,
    status: 'COMPLETED',
  };

  describe('formatPassNotification', () => {
    it('should format PASS notification with all required metadata', () => {
      const notification = formatPassNotification(mockTestResult, mockTest);

      expect(notification.subject).toContain('Test Passed');
      expect(notification.subject).toContain('Test login functionality');
      expect(notification.message).toContain('PASS ✅');
      expect(notification.message).toContain('result-123');
      expect(notification.message).toContain('test-456');
      expect(notification.message).toContain('45.00s');
      expect(notification.message).toContain('DEV');
      expect(notification.metadata.status).toBe('PASS');
      expect(notification.metadata.testId).toBe('test-456');
      expect(notification.metadata.resultId).toBe('result-123');
      expect(notification.metadata.duration).toBe(45000);
    });

    it('should format PASS notification without test object', () => {
      const notification = formatPassNotification(mockTestResult);

      expect(notification.subject).toContain('Test Passed');
      expect(notification.subject).toContain('test-456');
      expect(notification.message).toContain('PASS ✅');
      expect(notification.message).not.toContain('Environment:');
      expect(notification.metadata.environment).toBeUndefined();
    });

    it('should include tenant and user IDs', () => {
      const notification = formatPassNotification(mockTestResult, mockTest);

      expect(notification.message).toContain('tenant-789');
      expect(notification.message).toContain('user-abc');
      expect(notification.metadata.tenantId).toBe('tenant-789');
      expect(notification.metadata.userId).toBe('user-abc');
    });

    it('should format duration correctly', () => {
      const shortResult = { ...mockTestResult, duration: 1500 };
      const notification = formatPassNotification(shortResult, mockTest);

      expect(notification.message).toContain('1.50s');
    });

    it('should truncate long test prompts in subject', () => {
      const longPromptTest = {
        ...mockTest,
        testPrompt: 'This is a very long test prompt that should be truncated in the subject line to avoid overly long email subjects',
      };
      const notification = formatPassNotification(mockTestResult, longPromptTest);

      expect(notification.subject.length).toBeLessThan(100);
    });
  });

  describe('formatFailNotification', () => {
    const failedResult: TestResult = {
      ...mockTestResult,
      status: 'FAIL',
      errorMessage: 'Element not found: #login-button',
      executionLog: {
        failedStep: 'click',
        stepNumber: 3,
      },
    };

    it('should format FAIL notification with error summary', () => {
      const notification = formatFailNotification(failedResult, mockTest);

      expect(notification.subject).toContain('Test Failed');
      expect(notification.message).toContain('FAIL ❌');
      expect(notification.message).toContain('Element not found: #login-button');
      expect(notification.message).toContain('Failed Step: click');
      expect(notification.message).toContain('Step Number: 3');
      expect(notification.metadata.status).toBe('FAIL');
    });

    it('should format FAIL notification without test object', () => {
      const notification = formatFailNotification(failedResult);

      expect(notification.subject).toContain('Test Failed');
      expect(notification.message).toContain('FAIL ❌');
      expect(notification.message).toContain('Element not found: #login-button');
    });

    it('should handle missing error message', () => {
      const resultWithoutError = { ...failedResult, errorMessage: undefined };
      const notification = formatFailNotification(resultWithoutError, mockTest);

      expect(notification.message).toContain('Test execution failed');
    });

    it('should include execution log details when available', () => {
      const notification = formatFailNotification(failedResult, mockTest);

      expect(notification.message).toContain('Failed Step: click');
      expect(notification.message).toContain('Step Number: 3');
    });

    it('should handle missing execution log details', () => {
      const resultWithoutLog = { ...failedResult, executionLog: {} };
      const notification = formatFailNotification(resultWithoutLog, mockTest);

      expect(notification.message).not.toContain('Failed Step:');
      expect(notification.message).not.toContain('Step Number:');
    });
  });

  describe('formatTestNotification', () => {
    it('should route to formatPassNotification for PASS status', () => {
      const notification = formatTestNotification(mockTestResult, mockTest);

      expect(notification.metadata.status).toBe('PASS');
      expect(notification.subject).toContain('Test Passed');
    });

    it('should route to formatFailNotification for FAIL status', () => {
      const failedResult = { ...mockTestResult, status: 'FAIL' as const };
      const notification = formatTestNotification(failedResult, mockTest);

      expect(notification.metadata.status).toBe('FAIL');
      expect(notification.subject).toContain('Test Failed');
    });
  });

  describe('formatSNSMessage', () => {
    it('should format notification for SNS publishing', () => {
      const notification = formatPassNotification(mockTestResult, mockTest);
      const snsMessage = formatSNSMessage(notification);

      expect(snsMessage.Subject).toBe(notification.subject);
      expect(snsMessage.Message).toBe(notification.message);
      expect(snsMessage.MessageAttributes.testId.StringValue).toBe('test-456');
      expect(snsMessage.MessageAttributes.resultId.StringValue).toBe('result-123');
      expect(snsMessage.MessageAttributes.status.StringValue).toBe('PASS');
      expect(snsMessage.MessageAttributes.tenantId.StringValue).toBe('tenant-789');
      expect(snsMessage.MessageAttributes.userId.StringValue).toBe('user-abc');
      expect(snsMessage.MessageAttributes.duration.StringValue).toBe('45000');
    });

    it('should include environment in message attributes when available', () => {
      const notification = formatPassNotification(mockTestResult, mockTest);
      const snsMessage = formatSNSMessage(notification);

      expect(snsMessage.MessageAttributes.environment).toBeDefined();
      expect(snsMessage.MessageAttributes.environment.StringValue).toBe('DEV');
    });

    it('should omit environment from message attributes when not available', () => {
      const notification = formatPassNotification(mockTestResult);
      const snsMessage = formatSNSMessage(notification);

      expect(snsMessage.MessageAttributes.environment).toBeUndefined();
    });

    it('should set correct data types for message attributes', () => {
      const notification = formatPassNotification(mockTestResult, mockTest);
      const snsMessage = formatSNSMessage(notification);

      expect(snsMessage.MessageAttributes.testId.DataType).toBe('String');
      expect(snsMessage.MessageAttributes.duration.DataType).toBe('Number');
    });
  });

  describe('Metadata completeness', () => {
    it('should include all required metadata fields', () => {
      const notification = formatPassNotification(mockTestResult, mockTest);

      expect(notification.metadata).toHaveProperty('testId');
      expect(notification.metadata).toHaveProperty('resultId');
      expect(notification.metadata).toHaveProperty('status');
      expect(notification.metadata).toHaveProperty('duration');
      expect(notification.metadata).toHaveProperty('startTime');
      expect(notification.metadata).toHaveProperty('endTime');
      expect(notification.metadata).toHaveProperty('tenantId');
      expect(notification.metadata).toHaveProperty('userId');
    });

    it('should include optional metadata fields when available', () => {
      const notification = formatPassNotification(mockTestResult, mockTest);

      expect(notification.metadata).toHaveProperty('environment');
      expect(notification.metadata).toHaveProperty('testName');
      expect(notification.metadata.environment).toBe('DEV');
      expect(notification.metadata.testName).toBe('Test login functionality with valid credentials');
    });
  });
});
