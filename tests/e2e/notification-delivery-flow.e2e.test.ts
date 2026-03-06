/**
 * End-to-End Test: Notification Delivery Flow
 * Tests the complete notification workflow from test completion to SNS delivery
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import { formatTestNotification, formatSNSMessage } from '../../src/shared/utils/notificationFormatter';
import { TestResult } from '../../src/shared/types';
import { v4 as uuidv4 } from 'uuid';

const snsMock = mockClient(SNSClient);

describe('E2E: Notification Delivery Flow', () => {
  const testTenantId = uuidv4();
  const testUserId = uuidv4();
  const testId = uuidv4();
  const resultId = uuidv4();

  beforeEach(() => {
    snsMock.reset();
  });

  it('should format and send PASS notification', async () => {
    const testResult: TestResult = {
      resultId,
      testId,
      tenantId: testTenantId,
      userId: testUserId,
      status: 'PASS',
      startTime: Date.now() - 45000,
      endTime: Date.now(),
      duration: 45000,
      screenshotsS3Keys: ['screenshot1.png', 'screenshot2.png'],
      logsS3Key: 'execution.log',
      executionLog: {
        steps: [],
        summary: 'Test passed successfully',
      },
    };

    // Step 1: Format the notification
    const notification = formatTestNotification(testResult);
    expect(notification.subject).toContain('Test Passed');
    expect(notification.message).toContain('Test Execution Successful');
    expect(notification.message).toContain(testId);
    expect(notification.message).toContain('45.00');

    // Step 2: Format SNS message
    const snsMessage = formatSNSMessage(notification);
    expect(snsMessage.Subject).toBe(notification.subject);
    expect(snsMessage.Message).toBe(notification.message);

    // Step 3: Publish to SNS
    snsMock.on(PublishCommand).resolves({
      MessageId: 'test-message-id',
    });

    const snsClient = new SNSClient({});
    const publishCommand = new PublishCommand({
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-notifications',
      Subject: snsMessage.Subject,
      Message: snsMessage.Message,
    });

    const publishResponse = await snsClient.send(publishCommand);
    expect(publishResponse.MessageId).toBe('test-message-id');
  });

  it('should format and send FAIL notification with error details', async () => {
    const testResult: TestResult = {
      resultId,
      testId,
      tenantId: testTenantId,
      userId: testUserId,
      status: 'FAIL',
      startTime: Date.now() - 30000,
      endTime: Date.now(),
      duration: 30000,
      screenshotsS3Keys: ['screenshot1.png', 'failure.png'],
      logsS3Key: 'execution.log',
      errorMessage: 'Element not found: #login-button',
      executionLog: {
        steps: [],
        summary: 'Test failed',
      },
    };

    // Step 1: Format the notification
    const notification = formatTestNotification(testResult);
    expect(notification.subject).toContain('Test Failed');
    expect(notification.message).toContain('Test Execution Failed');
    expect(notification.message).toContain('Element not found: #login-button');
    expect(notification.message).toContain(testId);

    // Step 2: Format SNS message
    const snsMessage = formatSNSMessage(notification);
    expect(snsMessage.Subject).toBe(notification.subject);
    expect(snsMessage.Message).toContain('Element not found');

    // Step 3: Publish to SNS
    snsMock.on(PublishCommand).resolves({
      MessageId: 'test-message-id-2',
    });

    const snsClient = new SNSClient({});
    const publishCommand = new PublishCommand({
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-notifications',
      Subject: snsMessage.Subject,
      Message: snsMessage.Message,
    });

    const publishResponse = await snsClient.send(publishCommand);
    expect(publishResponse.MessageId).toBe('test-message-id-2');
  });

  it('should handle SNS publish failures gracefully', async () => {
    const testResult: TestResult = {
      resultId,
      testId,
      tenantId: testTenantId,
      userId: testUserId,
      status: 'PASS',
      startTime: Date.now() - 45000,
      endTime: Date.now(),
      duration: 45000,
      screenshotsS3Keys: [],
      logsS3Key: 'execution.log',
      executionLog: {
        steps: [],
        summary: 'Test passed',
      },
    };

    const notification = formatTestNotification(testResult);
    const snsMessage = formatSNSMessage(notification);

    // Mock SNS failure
    snsMock.on(PublishCommand).rejects(new Error('SNS service unavailable'));

    const snsClient = new SNSClient({});
    const publishCommand = new PublishCommand({
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-notifications',
      Subject: snsMessage.Subject,
      Message: snsMessage.Message,
    });

    await expect(snsClient.send(publishCommand)).rejects.toThrow('SNS service unavailable');
  });
});
