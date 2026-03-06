# Execution Logger Utility

## Overview

The Execution Logger utility provides structured logging for test execution in AWS Lambda environment. It captures test execution events, step details, errors, and timing information in JSON format for debugging and audit purposes.

## Features

- **Structured JSON Logging**: All logs are stored in JSON format for easy parsing and analysis
- **Comprehensive Event Tracking**: Logs test execution lifecycle events (start, step execution, completion, failures)
- **Error Details**: Captures error messages, stack traces, and error codes
- **Timestamps**: All log entries include ISO 8601 timestamps
- **Lambda-Optimized**: Stores logs in `/tmp` directory with size constraints
- **Graceful Error Handling**: Continues operation even if file system operations fail
- **Memory-Efficient**: Automatic flushing when approaching size limits
- **Auto-Flush Support**: Optional periodic flushing to disk
- **Statistics**: Provides log statistics and filtering capabilities

## Installation

The utility is part of the shared utilities package:

```typescript
import { createExecutionLogger, ExecutionLogger, LogLevel } from '@shared/utils/executionLogger';
```

## Quick Start

### Basic Usage

```typescript
import { createExecutionLogger } from '@shared/utils/executionLogger';

// Create and initialize logger
const logger = await createExecutionLogger('test-123', 'result-456');

// Log execution start
logger.logExecutionStart(5, { environment: 'DEV' });

// Log step execution
logger.logStepStart(1, 'navigate', { url: 'https://example.com' });
// ... perform step ...
logger.logStepComplete(1, 'navigate', 1500);

// Log step failure
try {
  // ... perform step ...
} catch (error) {
  logger.logStepFailure(2, 'click', error, { selector: '#button' });
}

// Log execution completion
logger.logExecutionComplete('PASS', { screenshotCount: 5 });

// Close logger and flush to disk
await logger.close();

// Get log file path for S3 upload
const logPath = logger.getLogFilePath();

// Cleanup after upload
await logger.cleanup();
```

### Advanced Usage with Custom Options

```typescript
import { createExecutionLogger } from '@shared/utils/executionLogger';

const logger = await createExecutionLogger('test-123', 'result-456', {
  tmpDir: '/tmp',
  maxLogSize: 5 * 1024 * 1024, // 5MB
  flushInterval: 10000, // Auto-flush every 10 seconds
});

// Use logger...
await logger.close();
```

## API Reference

### `createExecutionLogger(testId, resultId, options?)`

Creates and initializes an execution logger.

**Parameters:**
- `testId` (string): Test identifier
- `resultId` (string): Test result identifier
- `options` (ExecutionLoggerOptions, optional):
  - `tmpDir` (string): Temporary directory path (default: `/tmp`)
  - `maxLogSize` (number): Maximum log size in bytes (default: 5MB)
  - `flushInterval` (number): Auto-flush interval in milliseconds (default: 0 = disabled)

**Returns:** Promise<ExecutionLogger>

### ExecutionLogger Methods

#### Execution Lifecycle

##### `logExecutionStart(totalSteps, details?)`

Logs the start of test execution.

```typescript
logger.logExecutionStart(5, { 
  environment: 'DEV',
  baseUrl: 'https://dev.example.com'
});
```

##### `logExecutionComplete(status, details?)`

Logs the completion of test execution.

```typescript
logger.logExecutionComplete('PASS', { 
  screenshotCount: 5,
  totalAssertions: 10
});
```

**Parameters:**
- `status`: 'PASS' | 'FAIL'
- `details`: Optional metadata object

#### Step Logging

##### `logStepStart(stepNumber, action, details?)`

Logs the start of a test step.

```typescript
logger.logStepStart(1, 'navigate', { 
  url: 'https://example.com',
  timeout: 30000
});
```

##### `logStepComplete(stepNumber, action, duration, details?)`

Logs the successful completion of a test step.

```typescript
logger.logStepComplete(1, 'navigate', 1500, { 
  finalUrl: 'https://example.com/dashboard'
});
```

**Parameters:**
- `stepNumber` (number): Step number
- `action` (string): Step action type
- `duration` (number): Step duration in milliseconds
- `details` (object, optional): Additional metadata

##### `logStepFailure(stepNumber, action, error, details?)`

Logs a test step failure with error details.

```typescript
try {
  await page.click('#button');
} catch (error) {
  logger.logStepFailure(2, 'click', error, { 
    selector: '#button',
    retryCount: 3
  });
}
```

**Parameters:**
- `stepNumber` (number): Step number
- `action` (string): Step action type
- `error` (Error): Error object
- `details` (object, optional): Additional metadata

#### General Logging

##### `log(level, message, metadata?)`

Logs a message with specified log level.

```typescript
logger.log(LogLevel.INFO, 'Browser initialized', { 
  browserType: 'chromium',
  headless: true
});
```

##### `logError(message, error, metadata?)`

Logs an error with stack trace.

```typescript
try {
  // ... operation ...
} catch (error) {
  logger.logError('Browser crashed', error, { 
    browserType: 'chromium'
  });
}
```

##### `logWarning(message, metadata?)`

Logs a warning message.

```typescript
logger.logWarning('Slow network detected', { 
  latency: 5000
});
```

##### `logDebug(message, metadata?)`

Logs a debug message.

```typescript
logger.logDebug('Page loaded', { 
  loadTime: 1200,
  resourceCount: 45
});
```

#### Log Management

##### `flush()`

Manually flush logs to disk.

```typescript
await logger.flush();
```

##### `close()`

Close the logger, flush remaining logs, and stop auto-flush timer.

```typescript
await logger.close();
```

##### `cleanup()`

Delete the log file from disk (call after uploading to S3).

```typescript
await logger.cleanup();
```

#### Log Retrieval

##### `getExecutionLog()`

Get the complete execution log with metadata and entries.

```typescript
const log = logger.getExecutionLog();
console.log(log.metadata.status); // 'PASS' or 'FAIL'
console.log(log.entries.length); // Number of log entries
```

**Returns:**
```typescript
{
  metadata: {
    testId: string;
    resultId: string;
    startTime: string;
    endTime?: string;
    totalDuration?: number;
    status?: 'RUNNING' | 'PASS' | 'FAIL';
    totalSteps?: number;
    completedSteps?: number;
  },
  entries: LogEntry[]
}
```

##### `getEntriesByLevel(level)`

Get log entries filtered by log level.

```typescript
const errors = logger.getEntriesByLevel(LogLevel.ERROR);
const warnings = logger.getEntriesByLevel(LogLevel.WARN);
```

##### `getErrors()`

Get all error log entries.

```typescript
const errors = logger.getErrors();
errors.forEach(error => {
  console.log(error.message);
  console.log(error.error?.stack);
});
```

##### `getLogFilePath()`

Get the path to the log file.

```typescript
const logPath = logger.getLogFilePath();
// Upload to S3
await uploadToS3(logPath, bucket, key);
```

##### `getStatistics()`

Get log statistics.

```typescript
const stats = logger.getStatistics();
console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Errors: ${stats.errorCount}`);
console.log(`Warnings: ${stats.warningCount}`);
console.log(`Estimated size: ${stats.estimatedSize} bytes`);
```

**Returns:**
```typescript
{
  totalEntries: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  estimatedSize: number;
}
```

## Log Structure

### Log Entry Format

Each log entry has the following structure:

```typescript
{
  timestamp: "2024-01-15T10:30:45.123Z",
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  message: "Step 1 completed: navigate",
  stepNumber?: 1,
  stepAction?: "navigate",
  duration?: 1500,
  error?: {
    message: "Element not found",
    stack: "Error: Element not found\n  at ...",
    code: "ERR_ELEMENT_NOT_FOUND"
  },
  metadata?: {
    // Custom metadata
  }
}
```

### Complete Log Format

The complete log file stored in `/tmp/logs/` has this structure:

```json
{
  "metadata": {
    "testId": "test-123",
    "resultId": "result-456",
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:30:45.000Z",
    "totalDuration": 45000,
    "status": "PASS",
    "totalSteps": 5,
    "completedSteps": 5
  },
  "entries": [
    {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "level": "INFO",
      "message": "Execution logger initialized",
      "metadata": {
        "testId": "test-123",
        "resultId": "result-456"
      }
    },
    {
      "timestamp": "2024-01-15T10:30:01.000Z",
      "level": "INFO",
      "message": "Test execution started",
      "metadata": {
        "totalSteps": 5,
        "event": "execution_start"
      }
    },
    {
      "timestamp": "2024-01-15T10:30:02.000Z",
      "level": "INFO",
      "message": "Step 1 started: navigate",
      "metadata": {
        "stepNumber": 1,
        "stepAction": "navigate",
        "event": "step_start",
        "url": "https://example.com"
      }
    },
    {
      "timestamp": "2024-01-15T10:30:03.500Z",
      "level": "INFO",
      "message": "Step 1 completed: navigate",
      "metadata": {
        "stepNumber": 1,
        "stepAction": "navigate",
        "duration": 1500,
        "event": "step_complete"
      }
    }
  ]
}
```

## Integration with Test Execution Lambda

### Complete Example

```typescript
import { Page } from 'playwright-core';
import { createExecutionLogger } from '@shared/utils/executionLogger';
import { uploadToS3 } from '@shared/utils/s3';

async function executeTest(testId: string, resultId: string, testScript: TestScript) {
  // Initialize logger
  const logger = await createExecutionLogger(testId, resultId, {
    maxLogSize: 5 * 1024 * 1024,
    flushInterval: 10000, // Flush every 10 seconds
  });

  try {
    // Log execution start
    logger.logExecutionStart(testScript.steps.length, {
      environment: testScript.environment,
      baseUrl: testScript.baseUrl,
    });

    // Initialize browser
    const browser = await chromium.launch();
    const page = await browser.newPage();

    let stepNumber = 0;
    let allStepsPassed = true;

    // Execute each step
    for (const step of testScript.steps) {
      stepNumber++;
      const stepStartTime = Date.now();

      try {
        logger.logStepStart(stepNumber, step.action, {
          selector: step.selector,
          url: step.url,
        });

        // Execute step
        await executeStep(page, step);

        const duration = Date.now() - stepStartTime;
        logger.logStepComplete(stepNumber, step.action, duration);

      } catch (error) {
        allStepsPassed = false;
        logger.logStepFailure(stepNumber, step.action, error, {
          selector: step.selector,
        });
        break; // Stop on first failure
      }
    }

    // Log execution completion
    const status = allStepsPassed ? 'PASS' : 'FAIL';
    logger.logExecutionComplete(status, {
      completedSteps: stepNumber,
      totalSteps: testScript.steps.length,
    });

    await browser.close();

  } catch (error) {
    logger.logError('Test execution failed', error);
    logger.logExecutionComplete('FAIL', {
      error: error.message,
    });
  } finally {
    // Close logger and flush
    await logger.close();

    // Upload log to S3
    const logPath = logger.getLogFilePath();
    const s3Key = `${testId}/${resultId}/execution-log.json`;
    await uploadToS3(logPath, process.env.BUCKET_NAME!, s3Key);

    // Cleanup local file
    await logger.cleanup();

    // Get statistics for debugging
    const stats = logger.getStatistics();
    console.log('Log statistics:', stats);
  }
}
```

## Best Practices

### 1. Always Initialize

Always call `initialize()` or use `createExecutionLogger()` before logging:

```typescript
// Good
const logger = await createExecutionLogger(testId, resultId);

// Also good
const logger = new ExecutionLogger(testId, resultId);
await logger.initialize();
```

### 2. Always Close

Always close the logger to ensure logs are flushed:

```typescript
try {
  // ... logging ...
} finally {
  await logger.close();
}
```

### 3. Cleanup After Upload

Always cleanup log files after uploading to S3:

```typescript
await uploadToS3(logger.getLogFilePath(), bucket, key);
await logger.cleanup();
```

### 4. Use Appropriate Log Levels

- `INFO`: Normal execution events (step start, step complete)
- `WARN`: Non-critical issues (slow network, retries)
- `ERROR`: Failures and errors (step failures, exceptions)
- `DEBUG`: Detailed debugging information

### 5. Include Relevant Metadata

Always include relevant metadata for debugging:

```typescript
logger.logStepStart(1, 'click', {
  selector: '#submit-button',
  timeout: 30000,
  retryCount: 3,
});
```

### 6. Handle Errors Gracefully

The logger handles file system errors gracefully, but always wrap in try-catch:

```typescript
try {
  await logger.flush();
} catch (error) {
  console.error('Failed to flush logs:', error);
  // Continue execution
}
```

### 7. Monitor Log Size

For long-running tests, monitor log size:

```typescript
const stats = logger.getStatistics();
if (stats.estimatedSize > 4 * 1024 * 1024) {
  await logger.flush();
}
```

### 8. Use Auto-Flush for Long Tests

For tests that may run for several minutes:

```typescript
const logger = await createExecutionLogger(testId, resultId, {
  flushInterval: 30000, // Flush every 30 seconds
});
```

## Lambda Storage Considerations

### /tmp Directory Limits

AWS Lambda provides 512 MB of `/tmp` storage. The logger is optimized for this:

- Default max log size: 5 MB
- Automatic flushing when approaching limit
- Graceful degradation if disk is full

### Memory vs Disk

Logs are kept in memory until flushed. For memory-constrained environments:

```typescript
const logger = await createExecutionLogger(testId, resultId, {
  flushInterval: 5000, // Flush frequently
  maxLogSize: 2 * 1024 * 1024, // Smaller max size
});
```

### Cleanup Strategy

Always cleanup after uploading to S3:

```typescript
// Upload to S3
await uploadToS3(logger.getLogFilePath(), bucket, key);

// Cleanup immediately
await logger.cleanup();
```

## Error Handling

The logger handles errors gracefully:

1. **File System Errors**: Falls back to memory-only mode
2. **Write Errors**: Logs to console and continues
3. **Cleanup Errors**: Warns but doesn't throw

Example error handling:

```typescript
const logger = await createExecutionLogger(testId, resultId);

try {
  // ... logging operations ...
} catch (error) {
  // Logger errors are handled internally
  console.error('Unexpected error:', error);
} finally {
  // Always close
  await logger.close();
}
```

## Testing

The utility includes comprehensive unit tests:

```bash
npm test -- executionLogger.test.ts
```

Test coverage includes:
- Logger initialization
- All logging methods
- Error handling
- File operations
- Statistics and filtering
- Integration scenarios

## Performance Considerations

### Memory Usage

- Each log entry: ~200-500 bytes
- 1000 entries: ~200-500 KB
- Default 5MB limit: ~10,000-25,000 entries

### Disk I/O

- Flush operations are async and non-blocking
- Auto-flush reduces memory pressure
- Manual flush for critical points

### Recommendations

- Use auto-flush for tests > 2 minutes
- Flush manually at critical checkpoints
- Monitor statistics for large test suites

## Troubleshooting

### Logs Not Written to Disk

**Symptom**: `getLogFilePath()` returns path but file doesn't exist

**Solution**: Call `flush()` or `close()` to write logs

```typescript
await logger.flush(); // or
await logger.close();
```

### Out of Memory

**Symptom**: Lambda runs out of memory with large test suites

**Solution**: Enable auto-flush and reduce max log size

```typescript
const logger = await createExecutionLogger(testId, resultId, {
  flushInterval: 5000,
  maxLogSize: 1 * 1024 * 1024, // 1MB
});
```

### Disk Full

**Symptom**: Write operations fail with disk full error

**Solution**: Logger falls back to memory-only mode automatically. Check CloudWatch logs for warnings.

## Related Utilities

- **Screenshot Capture**: `screenshotCapture.ts` - Captures and manages test screenshots
- **Playwright Config**: `playwrightConfig.ts` - Configures Playwright for Lambda
- **S3 Upload**: Use AWS SDK to upload logs to S3

## License

MIT
