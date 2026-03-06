# Shared Utilities

This directory contains shared utility functions used across the platform.

## Execution Logger

The `executionLogger.ts` utility provides structured logging for test execution in AWS Lambda environment. It captures test execution events, step details, errors, and timing information in JSON format for debugging and audit purposes.

For detailed documentation, see [EXECUTION_LOGGER_README.md](./EXECUTION_LOGGER_README.md).

### Quick Start

```typescript
import { createExecutionLogger } from './executionLogger';

// Initialize the execution logger
const logger = await createExecutionLogger('test-123', 'result-456');

// Log execution lifecycle
logger.logExecutionStart(5, { environment: 'DEV' });

// Log step execution
logger.logStepStart(1, 'navigate', { url: 'https://example.com' });
logger.logStepComplete(1, 'navigate', 1500);

// Log failures
try {
  // ... step execution ...
} catch (error) {
  logger.logStepFailure(2, 'click', error, { selector: '#button' });
}

// Complete execution
logger.logExecutionComplete('PASS', { screenshotCount: 5 });

// Close and cleanup
await logger.close();
const logPath = logger.getLogFilePath();
// Upload to S3...
await logger.cleanup();
```

## Screenshot Capture

The `screenshotCapture.ts` utility provides robust screenshot capture functionality for Playwright test execution in AWS Lambda environment. It handles screenshot storage in Lambda's `/tmp` directory with proper naming conventions, metadata tracking, and error handling.

For detailed documentation, see [SCREENSHOT_CAPTURE_README.md](./SCREENSHOT_CAPTURE_README.md).

### Quick Start

```typescript
import { createScreenshotManager } from './screenshotCapture';

// Initialize the screenshot manager
const manager = await createScreenshotManager('test-123', 'result-456');

// Capture screenshots during test execution
await manager.captureStepScreenshot(page, 1, 'navigate');
await manager.captureFailureScreenshot(page, 3, 'assert');
await manager.captureSuccessScreenshot(page, 5);

// Get screenshot paths for S3 upload
const paths = manager.getScreenshotPaths();

// Cleanup after upload
await manager.cleanup();
```

## Playwright Configuration

The `playwrightConfig.ts` utility provides configuration and browser management for running Playwright in AWS Lambda environment.

For detailed documentation, see [PLAYWRIGHT_CONFIG_README.md](./PLAYWRIGHT_CONFIG_README.md).

## Prompt Builder

The `promptBuilder.ts` utility provides functions for constructing structured prompts for AI-powered test generation using Claude 3.5 Sonnet via Amazon Bedrock.

### Usage Example

```typescript
import { getBedrockClient } from './bedrock';
import { buildTestGenerationPrompt, parseTestScriptResponse } from './promptBuilder';

// Build a prompt for test generation
const prompt = buildTestGenerationPrompt({
  testPrompt: 'Test login functionality with valid credentials',
  environment: 'DEV',
  baseUrl: 'https://dev.example.com',
  additionalContext: 'Use test user: test@example.com',
});

// Invoke Bedrock with the prompt
const bedrockClient = getBedrockClient();
const response = await bedrockClient.invoke({
  prompt,
  maxTokens: 2000,
  temperature: 0.7,
});

// Parse the response into a TestScript
const testScript = parseTestScriptResponse(response.completion);

// testScript now contains structured test steps ready for execution
console.log(testScript);
// {
//   steps: [
//     { action: 'navigate', url: 'https://dev.example.com/login' },
//     { action: 'fill', selector: '#email', value: 'test@example.com' },
//     { action: 'fill', selector: '#password', value: 'password123' },
//     { action: 'click', selector: 'button[type="submit"]' },
//     { action: 'waitForNavigation' },
//     { action: 'assert', selector: '.dashboard', condition: 'visible' }
//   ]
// }
```

### API Reference

#### `buildTestGenerationPrompt(input: PromptBuilderInput): string`

Builds a structured prompt for test generation.

**Parameters:**
- `input.testPrompt` (string, required): Natural language description of the test scenario
- `input.environment` (Environment, required): Target environment (DEV, STAGING, or PROD)
- `input.baseUrl` (string, optional): Base URL for the application under test
- `input.additionalContext` (string, optional): Additional context or instructions

**Returns:** Formatted prompt string ready for Bedrock

#### `buildSimplePrompt(testPrompt: string): string`

Builds a simple prompt with default settings (DEV environment).

**Parameters:**
- `testPrompt` (string): Natural language test description

**Returns:** Formatted prompt string

#### `parseTestScriptResponse(response: string): TestScript`

Parses the JSON response from Bedrock into a validated TestScript object.

**Parameters:**
- `response` (string): Raw response string from Bedrock (may include markdown code blocks)

**Returns:** Parsed and validated TestScript object

**Throws:** Error if parsing fails or validation fails

#### `validateTestScript(obj: any): void`

Validates that an object conforms to the TestScript structure.

**Parameters:**
- `obj` (any): Object to validate

**Throws:** Error with descriptive message if validation fails

### Supported Test Actions

The prompt template instructs Claude to generate test scripts with the following actions:

1. **navigate**: Navigate to a URL
   - Required fields: `url`
   
2. **fill**: Fill an input field with a value
   - Required fields: `selector`, `value`
   
3. **click**: Click on an element
   - Required fields: `selector`
   
4. **assert**: Verify an element's state or content
   - Required fields: `selector`, `condition`
   - Supported conditions: visible, hidden, enabled, disabled, checked, unchecked, text
   
5. **waitForNavigation**: Wait for page navigation to complete
   - No required fields

### Selector Guidelines

The prompt template encourages Claude to use reliable selectors:

1. **Prefer data-testid attributes**: `[data-testid="login-button"]`
2. **Use IDs when available**: `#submit-button`
3. **Use specific CSS selectors**: `button.primary[type="submit"]`
4. **Avoid generic selectors**: Don't use `div`, `span`, `button` without qualifiers
5. **Text-based selection**: `text=Login` or `"Login"` for exact match

### Error Handling

The utility provides comprehensive validation and error handling:

- Invalid JSON responses are caught and reported with descriptive errors
- Missing required fields are detected and reported with step numbers
- Invalid action types are rejected
- Markdown code blocks are automatically stripped from responses

### Testing

The prompt builder includes comprehensive unit tests covering:
- Prompt generation with various input combinations
- JSON parsing with and without markdown code blocks
- Validation of all action types and their required fields
- Error handling for invalid inputs

Run tests with:
```bash
npm test -- promptBuilder.test.ts
```


## Notification Formatter

The `notificationFormatter.ts` utility provides functions for formatting test result notifications to be sent via Amazon SNS. It supports both PASS and FAIL notifications with comprehensive metadata.

For detailed documentation, see [NOTIFICATION_FORMATTER_README.md](./NOTIFICATION_FORMATTER_README.md).

### Quick Start

```typescript
import { formatTestNotification, formatSNSMessage } from './notificationFormatter';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// Format notification based on test result status
const notification = formatTestNotification(testResult, test);

// Convert to SNS message format
const snsMessage = formatSNSMessage(notification);

// Publish to SNS
const snsClient = new SNSClient({});
await snsClient.send(new PublishCommand({
  TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
  ...snsMessage,
}));
```

### Features

- ✅ Format PASS notifications with success indicators
- ✅ Format FAIL notifications with error summaries and failure details
- ✅ Include comprehensive test metadata (testId, resultId, status, duration, etc.)
- ✅ Support for optional test context (environment, test prompt)
- ✅ SNS message formatting with message attributes
- ✅ Tenant and user isolation metadata

### API Reference

#### `formatTestNotification(testResult, test?): NotificationMessage`

Main entry point that routes to the appropriate formatter based on status.

#### `formatPassNotification(testResult, test?): NotificationMessage`

Formats a PASS notification message.

#### `formatFailNotification(testResult, test?): NotificationMessage`

Formats a FAIL notification message with error summary.

#### `formatSNSMessage(notification): SNSMessage`

Converts a NotificationMessage to SNS message format with Subject, Message, and MessageAttributes.
