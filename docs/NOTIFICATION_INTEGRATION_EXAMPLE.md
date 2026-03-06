# Notification Integration Example

This document provides an example of how to integrate the notification formatter with the Test Execution Lambda to send notifications via SNS.

## Overview

After test execution completes, the Test Execution Lambda should:
1. Create a test result record in DynamoDB
2. Format a notification message using the notification formatter
3. Publish the notification to SNS

## Implementation Example

### Step 1: Import Required Dependencies

```typescript
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { formatTestNotification, formatSNSMessage } from '../../shared/utils/notificationFormatter';
import { getTest } from '../../shared/database/testOperations';
import { createTestResult } from '../../shared/database/testResultOperations';
```

### Step 2: Initialize SNS Client

```typescript
const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const NOTIFICATION_TOPIC_ARN = process.env.NOTIFICATION_TOPIC_ARN;
```

### Step 3: Send Notification After Test Execution

```typescript
async function sendTestNotification(
  testResult: TestResult,
  testId: string,
  tenantId: string
): Promise<void> {
  try {
    // Retrieve test details for richer notification context
    const test = await getTest(testId, tenantId);

    // Format the notification message
    const notification = formatTestNotification(testResult, test);

    // Convert to SNS message format
    const snsMessage = formatSNSMessage(notification);

    // Publish to SNS
    await snsClient.send(new PublishCommand({
      TopicArn: NOTIFICATION_TOPIC_ARN,
      ...snsMessage,
    }));

    console.log('Notification sent successfully', {
      resultId: testResult.resultId,
      status: testResult.status,
    });
  } catch (error) {
    // Log error but don't fail the test execution
    console.error('Failed to send notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      resultId: testResult.resultId,
      testId,
    });
    
    // Optionally: Send to DLQ or retry queue
    // The SNS delivery policy will handle retries automatically
  }
}
```

### Step 4: Integrate with Test Execution Flow

```typescript
async function executeTest(testId: string, tenantId: string, userId: string) {
  const startTime = Date.now();
  let status: 'PASS' | 'FAIL' = 'PASS';
  let errorMessage: string | undefined;
  let executionLog: Record<string, any> = {};

  try {
    // ... test execution logic ...
    
    // If test passes
    status = 'PASS';
  } catch (error) {
    // If test fails
    status = 'FAIL';
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    executionLog = {
      failedStep: 'click',
      stepNumber: 3,
      error: errorMessage,
    };
  } finally {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Create test result record
    const testResult = await createTestResult({
      testId,
      tenantId,
      userId,
      status,
      startTime,
      endTime,
      duration,
      screenshotsS3Keys: [], // populated during execution
      logsS3Key: '', // populated during execution
      errorMessage,
      executionLog,
    });

    // Send notification (non-blocking)
    await sendTestNotification(testResult, testId, tenantId);

    return testResult;
  }
}
```

## Complete Lambda Handler Example

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { JWTPayload, TestResult } from '../../shared/types';
import { getTest } from '../../shared/database/testOperations';
import { createTestResult } from '../../shared/database/testResultOperations';
import { formatTestNotification, formatSNSMessage } from '../../shared/utils/notificationFormatter';

const snsClient = new SNSClient({});
const NOTIFICATION_TOPIC_ARN = process.env.NOTIFICATION_TOPIC_ARN;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const jwtPayload = event.requestContext.authorizer as unknown as JWTPayload;
    const testId = event.pathParameters?.testId;

    if (!testId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Test ID is required' }),
      };
    }

    // Execute test
    const testResult = await executeTest(
      testId,
      jwtPayload.tenantId,
      jwtPayload.userId
    );

    // Send notification
    await sendTestNotification(testResult, testId, jwtPayload.tenantId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        resultId: testResult.resultId,
        status: testResult.status,
        message: 'Test execution completed',
      }),
    };
  } catch (error) {
    console.error('Test execution failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Test execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

async function executeTest(
  testId: string,
  tenantId: string,
  userId: string
): Promise<TestResult> {
  // ... test execution implementation ...
  // Returns TestResult object
}

async function sendTestNotification(
  testResult: TestResult,
  testId: string,
  tenantId: string
): Promise<void> {
  try {
    const test = await getTest(testId, tenantId);
    const notification = formatTestNotification(testResult, test);
    const snsMessage = formatSNSMessage(notification);

    await snsClient.send(new PublishCommand({
      TopicArn: NOTIFICATION_TOPIC_ARN,
      ...snsMessage,
    }));

    console.log('Notification sent successfully', {
      resultId: testResult.resultId,
      status: testResult.status,
    });
  } catch (error) {
    console.error('Failed to send notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      resultId: testResult.resultId,
    });
  }
}
```

## Environment Variables

Ensure the following environment variables are configured in the Lambda function:

```yaml
Environment:
  Variables:
    NOTIFICATION_TOPIC_ARN: !Ref TestNotificationTopic
    AWS_REGION: !Ref AWS::Region
```

## IAM Permissions

The Lambda execution role must have permission to publish to SNS:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:*:*:ai-testing-notifications-*"
    }
  ]
}
```

## Testing the Integration

### Unit Test Example

```typescript
import { sendTestNotification } from './index';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

jest.mock('@aws-sdk/client-sns');

describe('sendTestNotification', () => {
  it('should send notification for PASS result', async () => {
    const mockSend = jest.fn().mockResolvedValue({});
    (SNSClient.prototype.send as jest.Mock) = mockSend;

    const testResult: TestResult = {
      resultId: 'result-123',
      testId: 'test-456',
      tenantId: 'tenant-789',
      userId: 'user-abc',
      status: 'PASS',
      startTime: Date.now(),
      endTime: Date.now() + 45000,
      duration: 45000,
      screenshotsS3Keys: [],
      logsS3Key: '',
      executionLog: {},
    };

    await sendTestNotification(testResult, 'test-456', 'tenant-789');

    expect(mockSend).toHaveBeenCalledWith(
      expect.any(PublishCommand)
    );
  });
});
```

## Notification Message Examples

### PASS Notification

```
Subject: ✅ Test Passed: Test login functionality with valid credentials

Body:
Test Execution Successful
========================

Status: PASS ✅
Test ID: test-456
Result ID: result-123
Duration: 45.00s
Completed: 2024-02-12T10:30:45.000Z
Environment: DEV

Test Description:
Test login functionality with valid credentials

All test steps completed successfully.

---
Tenant ID: tenant-789
User ID: user-abc
```

### FAIL Notification

```
Subject: ❌ Test Failed: Test login functionality with valid credentials

Body:
Test Execution Failed
=====================

Status: FAIL ❌
Test ID: test-456
Result ID: result-123
Duration: 23.50s
Failed: 2024-02-12T10:30:23.500Z
Environment: DEV

Test Description:
Test login functionality with valid credentials

Error Summary:
Element not found: #login-button

Failed Step: click
Step Number: 3

Please review the execution logs and screenshots for detailed failure information.

---
Tenant ID: tenant-789
User ID: user-abc
```

## Best Practices

1. **Non-blocking notifications**: Send notifications asynchronously to avoid blocking test execution
2. **Error handling**: Log notification failures but don't fail the test execution
3. **Retry logic**: Rely on SNS delivery policies for automatic retries
4. **Rich context**: Always pass the `test` object for richer notification content
5. **Monitoring**: Monitor SNS delivery failures via CloudWatch metrics
6. **DLQ**: Configure a Dead Letter Queue for failed notifications

## Related Documentation

- [Notification Formatter README](../src/shared/utils/NOTIFICATION_FORMATTER_README.md)
- [SNS Notification Setup](./SNS_NOTIFICATION_SETUP.md)
- [Test Execution Lambda](../src/lambdas/test-execution/index.ts)
