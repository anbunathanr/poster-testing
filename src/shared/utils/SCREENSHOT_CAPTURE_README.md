# Screenshot Capture Utility

## Overview

The Screenshot Capture Utility provides a robust and efficient way to capture screenshots during Playwright test execution in AWS Lambda environment. It handles screenshot storage in Lambda's `/tmp` directory with proper naming conventions, metadata tracking, and error handling.

## Features

- **Automatic Directory Management**: Creates and manages screenshot directories in `/tmp`
- **Metadata-Rich Filenames**: Includes step number, action, timestamp, and type in filenames
- **Multiple Screenshot Types**: Supports step, failure, and success screenshots
- **Error Handling**: Gracefully handles screenshot capture failures without breaking test execution
- **Storage Optimization**: Optimized for Lambda's storage constraints with configurable quality settings
- **Statistics Tracking**: Provides comprehensive statistics about captured screenshots
- **Easy Cleanup**: Simple cleanup method to remove screenshots after S3 upload

## Usage

### Basic Usage

```typescript
import { createScreenshotManager } from '../shared/utils/screenshotCapture';
import { Page } from 'playwright-core';

// Initialize the screenshot manager
const manager = await createScreenshotManager('test-123', 'result-456');

// Capture a step screenshot
await manager.captureStepScreenshot(page, 1, 'navigate');

// Capture a failure screenshot (full page by default)
await manager.captureFailureScreenshot(page, 3, 'assert');

// Capture a success screenshot
await manager.captureSuccessScreenshot(page, 5);

// Get all screenshot paths for S3 upload
const paths = manager.getScreenshotPaths();

// Get statistics
const stats = await manager.getStatistics();
console.log(`Captured ${stats.successful} screenshots (${stats.totalSizeMB} MB)`);

// Cleanup after upload
await manager.cleanup();
```

### Advanced Usage with Custom Options

```typescript
import { ScreenshotCaptureManager, ScreenshotOptions } from '../shared/utils/screenshotCapture';

// Create manager with custom tmp directory
const manager = new ScreenshotCaptureManager('test-123', 'result-456', '/custom/tmp');
await manager.initialize();

// Custom screenshot options
const options: ScreenshotOptions = {
  fullPage: true,      // Capture entire page
  quality: 90,         // Higher quality (larger file size)
  timeout: 10000,      // 10 second timeout
};

await manager.captureStepScreenshot(page, 1, 'navigate', options);
```

### Safe Capture (No Exceptions)

```typescript
import { safeCapture } from '../shared/utils/screenshotCapture';

// Capture screenshot without throwing exceptions
const result = await safeCapture(page, manager, 1, 'navigate', 'step');

if (result && result.success) {
  console.log(`Screenshot saved: ${result.fileName}`);
} else {
  console.log(`Screenshot failed: ${result?.error}`);
}
```

## Screenshot Types

### Step Screenshot
Captured after each test step during normal execution.
- **Type**: `step`
- **Full Page**: `false` (viewport only)
- **Use Case**: Regular test execution evidence

### Failure Screenshot
Captured when a test step fails.
- **Type**: `failure`
- **Full Page**: `true` (entire page by default)
- **Use Case**: Debugging test failures

### Success Screenshot
Captured when test completes successfully.
- **Type**: `success`
- **Full Page**: `false` (viewport only)
- **Use Case**: Final state verification

## Filename Format

Screenshots are saved with the following naming convention:

```
step-{stepNumber}-{stepAction}-{timestamp}-{type}.png
```

**Example**:
```
step-1-navigate-1707753600000-step.png
step-3-fill--email-1707753605000-step.png
step-5-assert-1707753610000-failure.png
```

## Directory Structure

Screenshots are organized in Lambda's `/tmp` directory:

```
/tmp/
└── screenshots/
    └── {resultId}/
        ├── step-1-navigate-1707753600000-step.png
        ├── step-2-fill-1707753605000-step.png
        ├── step-3-click-1707753610000-step.png
        └── step-4-assert-1707753615000-failure.png
```

## API Reference

### ScreenshotCaptureManager

#### Constructor
```typescript
constructor(testId: string, resultId: string, tmpDir?: string)
```

#### Methods

##### `initialize(): Promise<void>`
Creates the screenshot directory structure.

##### `captureStepScreenshot(page: Page, stepNumber: number, stepAction: string, options?: ScreenshotOptions): Promise<ScreenshotResult>`
Captures a screenshot during normal test execution.

##### `captureFailureScreenshot(page: Page, stepNumber: number, stepAction: string, options?: ScreenshotOptions): Promise<ScreenshotResult>`
Captures a screenshot when a test fails (full page by default).

##### `captureSuccessScreenshot(page: Page, stepNumber: number, options?: ScreenshotOptions): Promise<ScreenshotResult>`
Captures a screenshot when test completes successfully.

##### `getCapturedScreenshots(): ScreenshotResult[]`
Returns all captured screenshots (successful and failed).

##### `getSuccessfulScreenshots(): ScreenshotResult[]`
Returns only successfully captured screenshots.

##### `getFailedScreenshots(): ScreenshotResult[]`
Returns only failed screenshot captures.

##### `getScreenshotPaths(): string[]`
Returns file paths of all successful screenshots.

##### `getTotalSize(): Promise<number>`
Returns total size of all screenshots in bytes.

##### `getStatistics(): Promise<Statistics>`
Returns comprehensive statistics about captured screenshots.

##### `cleanup(): Promise<void>`
Removes all screenshots from the tmp directory.

##### `getScreenshotDirectory(): string`
Returns the screenshot directory path.

### Utility Functions

#### `createScreenshotManager(testId: string, resultId: string, tmpDir?: string): Promise<ScreenshotCaptureManager>`
Creates and initializes a screenshot manager in one call.

#### `safeCapture(page: Page, manager: ScreenshotCaptureManager, stepNumber: number, stepAction: string, screenshotType?: 'step' | 'failure' | 'success'): Promise<ScreenshotResult | null>`
Safely captures a screenshot without throwing exceptions.

## Types

### ScreenshotMetadata
```typescript
interface ScreenshotMetadata {
  testId: string;
  resultId: string;
  stepNumber: number;
  stepAction: string;
  timestamp: number;
  screenshotType: 'step' | 'failure' | 'success';
}
```

### ScreenshotResult
```typescript
interface ScreenshotResult {
  filePath: string;
  fileName: string;
  metadata: ScreenshotMetadata;
  success: boolean;
  error?: string;
}
```

### ScreenshotOptions
```typescript
interface ScreenshotOptions {
  fullPage?: boolean;   // Default: false
  quality?: number;     // Default: 80 (1-100)
  timeout?: number;     // Default: 5000ms
}
```

## Best Practices

### 1. Always Initialize
```typescript
const manager = await createScreenshotManager(testId, resultId);
// Now ready to capture screenshots
```

### 2. Capture After Each Step
```typescript
for (let i = 0; i < steps.length; i++) {
  await executeStep(page, steps[i]);
  await manager.captureStepScreenshot(page, i + 1, steps[i].action);
}
```

### 3. Capture Failures with Full Page
```typescript
try {
  await executeStep(page, step);
} catch (error) {
  await manager.captureFailureScreenshot(page, stepNumber, step.action);
  throw error;
}
```

### 4. Always Cleanup After Upload
```typescript
try {
  const paths = manager.getScreenshotPaths();
  await uploadToS3(paths);
} finally {
  await manager.cleanup();
}
```

### 5. Monitor Storage Usage
```typescript
const stats = await manager.getStatistics();
if (stats.totalSizeMB > 100) {
  console.warn('Screenshot storage exceeding 100MB');
}
```

## Lambda Optimization

### Storage Constraints
Lambda's `/tmp` directory has a 512 MB limit (or up to 10 GB with configuration). The utility is optimized for this:

- **Default Quality**: 80% (balance between quality and size)
- **Viewport Only**: Step screenshots capture viewport only (smaller files)
- **Full Page on Failure**: Only failure screenshots capture full page
- **Automatic Cleanup**: Easy cleanup after S3 upload

### Performance Tips

1. **Use Viewport Screenshots**: Faster and smaller files
   ```typescript
   await manager.captureStepScreenshot(page, 1, 'navigate', { fullPage: false });
   ```

2. **Adjust Quality**: Lower quality for faster captures
   ```typescript
   await manager.captureStepScreenshot(page, 1, 'navigate', { quality: 70 });
   ```

3. **Set Timeouts**: Prevent hanging on slow pages
   ```typescript
   await manager.captureStepScreenshot(page, 1, 'navigate', { timeout: 3000 });
   ```

4. **Cleanup Promptly**: Free up storage after upload
   ```typescript
   await manager.cleanup();
   ```

## Error Handling

The utility handles errors gracefully:

### Initialization Errors
```typescript
try {
  await manager.initialize();
} catch (error) {
  console.error('Failed to initialize screenshot directory:', error);
  // Handle error (e.g., fallback to no screenshots)
}
```

### Capture Errors
```typescript
const result = await manager.captureStepScreenshot(page, 1, 'navigate');
if (!result.success) {
  console.error(`Screenshot failed: ${result.error}`);
  // Test continues, screenshot failure doesn't break execution
}
```

### Cleanup Errors
```typescript
await manager.cleanup();
// Cleanup errors are logged but don't throw exceptions
```

## Integration with Test Execution

### Example Test Execution Flow

```typescript
import { createScreenshotManager } from '../shared/utils/screenshotCapture';
import { PlaywrightBrowserManager } from '../shared/utils/playwrightConfig';

async function executeTest(testId: string, resultId: string, testScript: TestScript) {
  const browserManager = new PlaywrightBrowserManager();
  const screenshotManager = await createScreenshotManager(testId, resultId);
  
  try {
    const { page } = await browserManager.initialize();
    
    for (let i = 0; i < testScript.steps.length; i++) {
      const step = testScript.steps[i];
      
      try {
        // Execute step
        await executeStep(page, step);
        
        // Capture step screenshot
        await screenshotManager.captureStepScreenshot(page, i + 1, step.action);
      } catch (error) {
        // Capture failure screenshot
        await screenshotManager.captureFailureScreenshot(page, i + 1, step.action);
        throw error;
      }
    }
    
    // Capture success screenshot
    await screenshotManager.captureSuccessScreenshot(page, testScript.steps.length);
    
    // Upload screenshots to S3
    const paths = screenshotManager.getScreenshotPaths();
    await uploadScreenshotsToS3(paths, testId, resultId);
    
    return { status: 'PASS', screenshots: paths };
  } catch (error) {
    // Upload screenshots even on failure
    const paths = screenshotManager.getScreenshotPaths();
    await uploadScreenshotsToS3(paths, testId, resultId);
    
    return { status: 'FAIL', screenshots: paths, error };
  } finally {
    await screenshotManager.cleanup();
    await browserManager.cleanup();
  }
}
```

## Troubleshooting

### Issue: Screenshots Not Captured
**Solution**: Check that the page is loaded and visible before capturing.

### Issue: Large File Sizes
**Solution**: Reduce quality or use viewport-only screenshots.

### Issue: Timeout Errors
**Solution**: Increase timeout or check page responsiveness.

### Issue: Storage Limit Exceeded
**Solution**: Cleanup screenshots more frequently or reduce quality.

## Related Documentation

- [Playwright Configuration](./PLAYWRIGHT_CONFIG_README.md)
- [Test Execution Service Design](../../../.kiro/specs/ai-testing-automation-platform/design.md)
- [AWS Lambda Storage Limits](https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-common.html#configuration-ephemeral-storage)
