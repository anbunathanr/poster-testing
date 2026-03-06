
# Notification Formatter

## Overview

The notification formatter utility provides functions for formatting test result notifications to be sent via Amazon SNS. It supports both PASS and FAIL notifications with comprehensive metadata.

## Requirements

- **Requirement 5.1**: Format PASS notifications
- **Requirement 5.2**: Format FAIL notifications with error summary
- **Requirement 5.3**: Include test metadata in notifications

## Features

- ✅ Format PASS notifications with success indicators
- ✅ Format FAIL notifications with error summaries and failure details
- ✅ Include comprehensive test metadata (testId, resultId, status, duration, etc.)
- ✅ Support for optional test context (environment, test prompt)
- ✅ SNS message formatting with message attributes
- ✅ Tenant and user isolation metadata

## Usage

### Basic Usage

```typescript
import { formatTestNotification, formatSNSMessage } from './notificationFormatter';
import { TestResult, Test } from '../types';

// Format notification based on test result status
const notification = formatTestNotification(testResult, test);

// Convert to SNS message format
const snsMessage = formatSNSMessage(notification);

// Publish to SNS
await snsClient.send(new PublishCommand({
  TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
  ...snsMessage,
}));
```

### Format PASS Notification

```typescript
import { formatPassNotification } from './notificationFormatter';

const testResult: TestResult = {
  resultId: 'result-123',
  testId: 'test-456',
  tenantId: 'tenant-789',
  userId: 'user-abc',
  status: 'PASS',
  startTime: 1707753600000,
  endTime: 1707753645000,
  duration: 45000,
  screenshotsS3Keys: ['screenshot1.png'],
  logsS3Key: 'logs/execution.json',
  executionLog: {},
};

const test: Test = {
  testId: 'test-456',
  tenantId: 'tenant-789',
  userId: 'user-abc',
  testPrompt: 'Test login functionality',
  testScript: { steps: [] },
  environment: 'DEV',
  createdAt: 1707753500000,
  status: 'COMPLETED',
};

const notification = formatPassNotification(testResult, test);
// Returns:
// {
//   subject: "✅ Test Passed: Test login functionality",
//   message: "Test Execution Successful\n...",
//   metadata: { testId, resultId, status, duration, ... }
// }
```

### Format FAIL Notification

```typescript
import { formatFailNotification } from './notificationFormatter';

const failedResult: TestResult = {
  ...testResult,
  status: 'FAIL',
  errorMessage: 'Element not found: #login-button',
  executionLog: {
    failedStep: 'click',
    stepNumber: 3,
  },
};

const notification = formatFailNotification(failedResult, test);
// Returns:
// {
//   subject: "❌ Test Failed: Test login functionality",
//   message: "Test Execution Failed\n...\nError Summary: Element not found...",
//   metadata: { testId, resultId, status, duration, ... }
// }
```

### Format SNS Message

```typescript
import { formatSNSMessage } from './notificationFormatter';

const notification = formatTestNotification(testResult, test);
const snsMessage = formatSNSMessage(notification);
// Returns:
// {
//   Subject: "✅ Test Passed: Test login functionality",
//   Message: "Test Execution Successful\n...",
//   MessageAttributes: {
//     testId: { DataType: 'String', StringValue: 'test-456' },
//     resultId: { DataType: 'String', StringValue: 'result-123' },
//     status: { DataType: 'String', StringValue: 'PASS' },
//     tenantId: { DataType: 'String', StringValue: 'tenant-789' },
//     userId: { DataType: 'String', StringValue: 'user-abc' },
//     duration: { DataType: 'Number', StringValue: '45000' },
//     environment: { DataType: 'String', StringValue: 'DEV' }
//   }
// }
```

## API Reference

### `formatPassNotification(testResult, test?)`

Formats a PASS notification message.

**Parameters:**
- `testResult: TestResult` - The test result object (required)
- `test?: Test` - Optional test object for additional context

**Returns:** `NotificationMessage`

### `formatFailNotification(testResult, test?)`

Formats a FAIL notification message with error summary.

**Parameters:**
- `testResult: TestResult` - The test result object (required)
- `test?: Test` - Optional test object for additional context

**Returns:** `NotificationMessage`

### `formatTestNotification(testResult, test?)`

Main entry point that routes to the appropriate formatter based on status.

**Parameters:**
- `testResult: TestResult` - The test result object (required)
- `test?: Test` - Optional test object for additional context

**Returns:** `NotificationMessage`

### `formatSNSMessage(notification)`

Converts a NotificationMessage to SNS message format.

**Parameters:**
- `notification: NotificationMessage` - The notification message object

**Returns:** SNS message structure with Subject, Message, and MessageAttributes

## Notification Message Structure

### NotificationMessage

```typescript
interface NotificationMessage {
  subject: string;        // Email subject line
  message: string;        // Email body content
  metadata: NotificationMetadata;
}
```

### NotificationMetadata

```typescript
interface NotificationMetadata {
  testId: string;         // Test identifier
  resultId: string;       // Result identifier
  status: 'PASS' | 'FAIL'; // Test status
  duration: number;       // Duration in milliseconds
  startTime: number;      // Start timestamp
  endTime: number;        // End timestamp
  environment?: string;   // Target environment (DEV, STAGING, PROD)
  testName?: string;      // Test prompt/description
  tenantId: string;       // Tenant identifier
  userId: string;         // User identifier
}
```

## Message Format

### PASS Notification Format

```
✅ Test Passed: [Test Description]

Test Execution Successful
========================

Status: PASS ✅
Test ID: [testId]
Result ID: [resultId]
Duration: [duration]s
Completed: [timestamp]
Environment: [environment]

Test Description:
[testPrompt]

All test steps completed successfully.

---
Tenant ID: [tenantId]
User ID: [userId]
```

### FAIL Notification Format

```
❌ Test Failed: [Test Description]

Test Execution Failed
=====================

Status: FAIL ❌
Test ID: [testId]
Result ID: [resultId]
Duration: [duration]s
Failed: [timestamp]
Environment: [environment]

Test Description:
[testPrompt]

Error Summary:
[errorMessage]

Failed Step: [failedStep]
Step Number: [stepNumber]

Please review the execution logs and screenshots for detailed failure information.

---
Tenant ID: [tenantId]
User ID: [userId]
```

## Integration with Test Execution Lambda

The notification formatter is designed to be used in the Test Execution Lambda after test completion:

```typescript
import { formatTestNotification, formatSNSMessage } from '../../shared/utils/notificationFormatter';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// After test execution completes
const testResult = await createTestResult({...});
const test = await getTest(testId, tenantId);

// Format notification
const notification = formatTestNotification(testResult, test);
const snsMessage = formatSNSMessage(notification);

// Publish to SNS
const snsClient = new SNSClient({});
await snsClient.send(new PublishCommand({
  TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
  ...snsMessage,
}));
```

## Testing

Comprehensive unit tests are available in `tests/unit/notificationFormatter.test.ts`:

```bash
npm test -- notificationFormatter.test.ts
```

Test coverage includes:
- ✅ PASS notification formatting
- ✅ FAIL notification formatting with error details
- ✅ Metadata completeness
- ✅ SNS message formatting
- ✅ Optional field handling
- ✅ Edge cases (missing data, long prompts, etc.)

## Best Practices

1. **Always include test context**: Pass the `test` object when available for richer notifications
2. **Use formatTestNotification**: Use the main entry point instead of calling format functions directly
3. **Include error details**: Ensure `errorMessage` and `executionLog` are populated for FAIL results
4. **Validate metadata**: Ensure all required fields are present in TestResult before formatting
5. **Handle SNS errors**: Implement retry logic when publishing to SNS

## Related Files

- `src/shared/types/index.ts` - Type definitions
- `src/shared/utils/notificationFormatter.ts` - Implementation
- `tests/unit/notificationFormatter.test.ts` - Unit tests
- `infrastructure/lib/stacks/notification-stack.ts` - SNS infrastructure
