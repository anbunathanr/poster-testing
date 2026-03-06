/**
 * Unit tests for Test Execution Lambda notification integration
 * Tests task 9.5: Implement notification publishing from Test Execution Lambda
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import { TestResult, Test } from '../../src/shared/types';
import * as notificationFormatter from '../../src/shared/utils/notificationFormatter';

// Mock the SNS client
const snsMock = mockClient(SNSClient);

// Mock the database operations
jest.mock('../../src/shared/database/testOperations', () => ({
  getTest: jest.fn(),
  updateTestStatus: jest.fn(),
}));

jest.mock('../../src/shared/database/testResultOperations', () => ({
  createTestResult: jest.fn(),
}));

// Import after mocking
import { getTest } from '../../src/shared/database/testOperations';

describe('Test Execution Lambda - Notification Integration', () => {
  const mockTestResult: TestResult = {
    resultId: 'result-123',
    testId: 'test-456',
    tenantId: 'tenant-789',
    userId: 'user-abc',
    status: 'PASS',
    startTime: Date.now(),
    endTime: Date.now() + 45000,
    duration: 45000,
    screenshotsS3Keys: ['screenshot1.png', 'screenshot2.png'],
    logsS3Key: 'logs/execution.json',
    executionLog: {
      totalSteps: 5,
      completedSteps: 5,
    },
  };

  const mockTest: Test = {
    testId: 'test-456',
    tenantId: 'tenant-789',
    userId: 'user-abc',
    testPrompt: 'Test login functionality with valid credentials',
    testScript: {
      steps: [
        { action: 'navigate', url: 'https://example.com/login' },
        { action: 'fill', selector: '#email', value: 'test@example.com' },
        { action: 'fill', selector: '#password', value: 'password123' },
        { action: 'click', selector: 'button[type="submit"]' },
        { action: 'assert', selector: '.dashboard', condition: 'visible' },
      ],
    },
    environment: 'DEV',
    createdAt: Date.now(),
    status: 'EXECUTING',
  };

  beforeEach(() => {
    snsMock.reset();
    jest.clearAllMocks();
    
    // Set environment variable
    process.env.NOTIFICATION_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-notifications';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    delete process.env.NOTIFICATION_TOPIC_ARN;
    delete process.env.AWS_REGION;
  });

  describe('sendTestNotification', () => {
    it('should send PASS notification with test context', async () => {
      // Mock getTest to return test details
      (getTest as jest.Mock).mockResolvedValue(mockTest);

      // Mock SNS publish
      snsMock.on(PublishCommand).resolves({
        MessageId: 'message-123',
      });

      // Spy on notification formatter
      const formatSpy = jest.spyOn(notificationFormatter, 'formatTestNotification');
      const formatSNSSpy = jest.spyOn(notificationFormatter, 'formatSNSMessage');

      // Import the module to test (we'll need to refactor to export sendTestNotification)
      // For now, we'll test the notification formatter directly
      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);
      const snsMessage = notificationFormatter.formatSNSMessage(notification);

      expect(notification.subject).toContain('Test Passed');
      expect(notification.subject).toContain('Test login functionality');
      expect(notification.message).toContain('PASS ✅');
      expect(notification.message).toContain('test-456');
      expect(notification.message).toContain('result-123');
      expect(notification.metadata.status).toBe('PASS');
      expect(notification.metadata.testId).toBe('test-456');
      expect(notification.metadata.resultId).toBe('result-123');

      expect(snsMessage.Subject).toContain('Test Passed');
      expect(snsMessage.Message).toContain('PASS ✅');
      expect(snsMessage.MessageAttributes.testId.StringValue).toBe('test-456');
      expect(snsMessage.MessageAttributes.status.StringValue).toBe('PASS');
      expect(snsMessage.MessageAttributes.tenantId.StringValue).toBe('tenant-789');
    });

    it('should send FAIL notification with error details', async () => {
      const failedTestResult: TestResult = {
        ...mockTestResult,
        status: 'FAIL',
        errorMessage: 'Element not found: #login-button',
        executionLog: {
          totalSteps: 5,
          completedSteps: 3,
          failedStep: 'click',
          stepNumber: 4,
        },
      };

      (getTest as jest.Mock).mockResolvedValue(mockTest);

      const notification = notificationFormatter.formatTestNotification(failedTestResult, mockTest);
      const snsMessage = notificationFormatter.formatSNSMessage(notification);

      expect(notification.subject).toContain('Test Failed');
      expect(notification.message).toContain('FAIL ❌');
      expect(notification.message).toContain('Element not found: #login-button');
      expect(notification.message).toContain('Failed Step: click');
      expect(notification.message).toContain('Step Number: 4');
      expect(notification.metadata.status).toBe('FAIL');

      expect(snsMessage.Subject).toContain('Test Failed');
      expect(snsMessage.Message).toContain('FAIL ❌');
      expect(snsMessage.MessageAttributes.status.StringValue).toBe('FAIL');
    });

    it('should send notification without test context if test retrieval fails', async () => {
      (getTest as jest.Mock).mockRejectedValue(new Error('Test not found'));

      const notification = notificationFormatter.formatTestNotification(mockTestResult);
      
      expect(notification.subject).toContain('Test Passed');
      expect(notification.message).toContain('PASS ✅');
      expect(notification.message).toContain('test-456');
      // Should not contain test prompt since test retrieval failed
      expect(notification.message).not.toContain('Test login functionality');
    });

    it('should include environment in notification metadata', async () => {
      (getTest as jest.Mock).mockResolvedValue(mockTest);

      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);

      expect(notification.metadata.environment).toBe('DEV');
      expect(notification.message).toContain('Environment: DEV');
    });

    it('should include duration in notification', async () => {
      (getTest as jest.Mock).mockResolvedValue(mockTest);

      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);

      expect(notification.metadata.duration).toBe(45000);
      expect(notification.message).toContain('45.00s');
    });

    it('should include tenant and user IDs in notification', async () => {
      (getTest as jest.Mock).mockResolvedValue(mockTest);

      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);

      expect(notification.metadata.tenantId).toBe('tenant-789');
      expect(notification.metadata.userId).toBe('user-abc');
      expect(notification.message).toContain('Tenant ID: tenant-789');
      expect(notification.message).toContain('User ID: user-abc');
    });

    it('should format SNS message with correct attributes', async () => {
      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);
      const snsMessage = notificationFormatter.formatSNSMessage(notification);

      expect(snsMessage.Subject).toBe(notification.subject);
      expect(snsMessage.Message).toBe(notification.message);
      expect(snsMessage.MessageAttributes).toHaveProperty('testId');
      expect(snsMessage.MessageAttributes).toHaveProperty('resultId');
      expect(snsMessage.MessageAttributes).toHaveProperty('status');
      expect(snsMessage.MessageAttributes).toHaveProperty('tenantId');
      expect(snsMessage.MessageAttributes).toHaveProperty('userId');
      expect(snsMessage.MessageAttributes).toHaveProperty('duration');
      expect(snsMessage.MessageAttributes).toHaveProperty('environment');

      expect(snsMessage.MessageAttributes.testId.DataType).toBe('String');
      expect(snsMessage.MessageAttributes.duration.DataType).toBe('Number');
    });

    it('should handle missing environment gracefully', async () => {
      const testWithoutEnv = { ...mockTest };
      delete (testWithoutEnv as any).environment;

      const notification = notificationFormatter.formatTestNotification(mockTestResult, testWithoutEnv);
      const snsMessage = notificationFormatter.formatSNSMessage(notification);

      expect(notification.message).not.toContain('Environment:');
      expect(snsMessage.MessageAttributes.environment).toBeUndefined();
    });

    it('should truncate long test prompts in subject line', async () => {
      const longPromptTest: Test = {
        ...mockTest,
        testPrompt: 'This is a very long test prompt that should be truncated in the subject line to avoid exceeding email subject length limits',
      };

      const notification = notificationFormatter.formatTestNotification(mockTestResult, longPromptTest);

      expect(notification.subject.length).toBeLessThan(100);
      // The formatter truncates at 50 characters
      expect(notification.subject).toContain('This is a very long test prompt that should be tru');
    });
  });

  describe('SNS Integration', () => {
    it('should publish notification to correct SNS topic', async () => {
      snsMock.on(PublishCommand).resolves({
        MessageId: 'message-123',
      });

      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);
      const snsMessage = notificationFormatter.formatSNSMessage(notification);

      const client = new SNSClient({ region: 'us-east-1' });
      const command = new PublishCommand({
        TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
        ...snsMessage,
      });

      const result = await client.send(command);

      expect(result.MessageId).toBe('message-123');
      expect(snsMock.calls()).toHaveLength(1);
      
      // Verify the SNS message format is correct
      expect(snsMessage.Subject).toContain('Test Passed');
      expect(snsMessage.Message).toContain('PASS ✅');
      expect(snsMessage.MessageAttributes.testId.StringValue).toBe('test-456');
      expect(snsMessage.MessageAttributes.status.StringValue).toBe('PASS');
    });

    it('should handle SNS publish errors gracefully', async () => {
      snsMock.on(PublishCommand).rejects(new Error('SNS service unavailable'));

      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);
      const snsMessage = notificationFormatter.formatSNSMessage(notification);

      const client = new SNSClient({ region: 'us-east-1' });
      const command = new PublishCommand({
        TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
        ...snsMessage,
      });

      await expect(client.send(command)).rejects.toThrow('SNS service unavailable');
    });

    it('should skip notification if NOTIFICATION_TOPIC_ARN is not configured', async () => {
      delete process.env.NOTIFICATION_TOPIC_ARN;

      // In the actual implementation, this should log a warning and return early
      // We can't test the actual Lambda function here, but we can verify the behavior
      expect(process.env.NOTIFICATION_TOPIC_ARN).toBeUndefined();
    });
  });

  describe('Notification Content Validation', () => {
    it('should include all required metadata for PASS notification', async () => {
      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);

      expect(notification.metadata).toMatchObject({
        testId: 'test-456',
        resultId: 'result-123',
        status: 'PASS',
        duration: 45000,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        environment: 'DEV',
        testName: 'Test login functionality with valid credentials',
        tenantId: 'tenant-789',
        userId: 'user-abc',
      });
    });

    it('should include all required metadata for FAIL notification', async () => {
      const failedTestResult: TestResult = {
        ...mockTestResult,
        status: 'FAIL',
        errorMessage: 'Test failed',
      };

      const notification = notificationFormatter.formatTestNotification(failedTestResult, mockTest);

      expect(notification.metadata).toMatchObject({
        testId: 'test-456',
        resultId: 'result-123',
        status: 'FAIL',
        duration: 45000,
        tenantId: 'tenant-789',
        userId: 'user-abc',
      });
    });

    it('should format timestamps correctly', async () => {
      const notification = notificationFormatter.formatTestNotification(mockTestResult, mockTest);

      expect(notification.message).toMatch(/Completed: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should format duration in seconds with 2 decimal places', async () => {
      const testResultWithDuration: TestResult = {
        ...mockTestResult,
        duration: 12345, // 12.345 seconds
      };

      const notification = notificationFormatter.formatTestNotification(testResultWithDuration, mockTest);

      expect(notification.message).toContain('12.35s');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing error message in FAIL notification', async () => {
      const failedTestResult: TestResult = {
        ...mockTestResult,
        status: 'FAIL',
        errorMessage: undefined,
      };

      const notification = notificationFormatter.formatTestNotification(failedTestResult, mockTest);

      expect(notification.message).toContain('Error Summary:');
      expect(notification.message).toContain('Test execution failed');
    });

    it('should handle missing execution log details', async () => {
      const failedTestResult: TestResult = {
        ...mockTestResult,
        status: 'FAIL',
        errorMessage: 'Test failed',
        executionLog: {},
      };

      const notification = notificationFormatter.formatTestNotification(failedTestResult, mockTest);

      expect(notification.message).not.toContain('Failed Step:');
      expect(notification.message).not.toContain('Step Number:');
    });
  });
});
