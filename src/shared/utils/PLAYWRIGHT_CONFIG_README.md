# Playwright Configuration Module

This module provides a robust configuration and management system for running Playwright in AWS Lambda environment with headless Chromium browser.

## Overview

The Playwright configuration module (`playwrightConfig.ts`) offers:

- **Lambda-optimized browser launch** using `playwright-aws-lambda`
- **Lifecycle management** for browser, context, and page instances
- **Error handling** with descriptive error messages
- **Resource cleanup** to prevent memory leaks
- **Utility functions** for common browser operations

## Key Components

### PlaywrightBrowserManager

A class that manages the complete lifecycle of Playwright browser instances.

```typescript
import { PlaywrightBrowserManager } from '@/shared/utils/playwrightConfig';

const manager = new PlaywrightBrowserManager();
```

#### Methods

##### `launchBrowser(options?: PlaywrightLaunchOptions): Promise<Browser>`

Launches a Chromium browser instance optimized for AWS Lambda.

```typescript
const browser = await manager.launchBrowser({
  headless: true,
  timeout: 30000,
});
```

##### `createContext(options?: PlaywrightLaunchOptions): Promise<BrowserContext>`

Creates a new browser context with specified viewport and user agent.

```typescript
const context = await manager.createContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Custom User Agent',
});
```

##### `createPage(timeout?: number): Promise<Page>`

Creates a new page in the browser context.

```typescript
const page = await manager.createPage(30000);
```

##### `initialize(options?: PlaywrightLaunchOptions): Promise<{browser, context, page}>`

Initializes browser, context, and page in one call.

```typescript
const { browser, context, page } = await manager.initialize({
  headless: true,
  timeout: 30000,
  viewport: { width: 1920, height: 1080 },
});
```

##### `cleanup(): Promise<void>`

Cleans up all resources (page, context, browser). Should be called in finally block.

```typescript
try {
  const { page } = await manager.initialize();
  // Use page...
} finally {
  await manager.cleanup();
}
```

### Utility Functions

#### `createBrowserManager(options?: PlaywrightLaunchOptions): Promise<PlaywrightBrowserManager>`

Creates and initializes a browser manager in one call.

```typescript
import { createBrowserManager } from '@/shared/utils/playwrightConfig';

const manager = await createBrowserManager({
  headless: true,
  timeout: 30000,
});
```

#### `withBrowser<T>(callback, options?): Promise<T>`

Executes a callback with an initialized page and automatically cleans up resources.

```typescript
import { withBrowser } from '@/shared/utils/playwrightConfig';

const result = await withBrowser(async (page) => {
  await page.goto('https://example.com');
  return await page.title();
});
```

## Configuration Options

### PlaywrightLaunchOptions

```typescript
interface PlaywrightLaunchOptions {
  headless?: boolean;        // Default: true
  timeout?: number;          // Default: 30000 (30 seconds)
  viewport?: {
    width: number;           // Default: 1920
    height: number;          // Default: 1080
  };
  userAgent?: string;        // Optional custom user agent
}
```

### Default Configuration

```typescript
const DEFAULT_LAUNCH_OPTIONS = {
  headless: true,
  timeout: 30000,
  viewport: {
    width: 1920,
    height: 1080,
  },
};
```

## Usage Examples

### Basic Usage

```typescript
import { PlaywrightBrowserManager } from '@/shared/utils/playwrightConfig';

const manager = new PlaywrightBrowserManager();

try {
  const { page } = await manager.initialize();
  
  await page.goto('https://example.com');
  await page.screenshot({ path: '/tmp/screenshot.png' });
  
  console.log('Screenshot captured');
} finally {
  await manager.cleanup();
}
```

### Using withBrowser Helper

```typescript
import { withBrowser } from '@/shared/utils/playwrightConfig';

const title = await withBrowser(async (page) => {
  await page.goto('https://example.com');
  return await page.title();
});

console.log('Page title:', title);
```

### Custom Configuration

```typescript
import { createBrowserManager } from '@/shared/utils/playwrightConfig';

const manager = await createBrowserManager({
  headless: true,
  timeout: 60000,
  viewport: { width: 1280, height: 720 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
});

const page = manager.getPage();
await page.goto('https://example.com');
```

### Test Execution Example

```typescript
import { PlaywrightBrowserManager } from '@/shared/utils/playwrightConfig';

export const handler = async (event: any) => {
  const manager = new PlaywrightBrowserManager();
  
  try {
    const { page } = await manager.initialize();
    
    // Navigate to login page
    await page.goto('https://app.example.com/login');
    await page.screenshot({ path: '/tmp/step-1.png' });
    
    // Fill credentials
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.screenshot({ path: '/tmp/step-2.png' });
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    await page.screenshot({ path: '/tmp/step-3.png' });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'PASS' }),
    };
  } catch (error) {
    console.error('Test execution failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        status: 'FAIL',
        error: error.message 
      }),
    };
  } finally {
    await manager.cleanup();
  }
};
```

## Lambda-Specific Optimizations

The module uses `playwright-aws-lambda` which provides:

1. **Chromium binary optimized for Lambda** - Smaller size, faster startup
2. **Automatic /tmp directory handling** - Lambda's writable directory
3. **Memory optimization** - Efficient resource usage
4. **Lambda-specific browser args**:
   - `--disable-gpu` - No GPU in Lambda
   - `--disable-dev-shm-usage` - Use /tmp instead of /dev/shm
   - `--disable-setuid-sandbox` - Lambda doesn't support sandboxing
   - `--no-sandbox` - Required for Lambda
   - `--single-process` - Reduce memory usage
   - `--no-zygote` - Disable zygote process

## Error Handling

All methods include comprehensive error handling:

```typescript
try {
  const browser = await manager.launchBrowser();
} catch (error) {
  // Error message: "Browser launch failed: <original error>"
  console.error(error.message);
}
```

Cleanup methods handle errors gracefully and always set resources to null:

```typescript
await manager.cleanup(); // Never throws, logs errors
```

## Best Practices

1. **Always cleanup resources**:
   ```typescript
   try {
     // Use browser
   } finally {
     await manager.cleanup();
   }
   ```

2. **Use withBrowser for simple operations**:
   ```typescript
   await withBrowser(async (page) => {
     // Automatic cleanup
   });
   ```

3. **Set appropriate timeouts**:
   ```typescript
   await manager.initialize({ timeout: 60000 }); // 60 seconds
   ```

4. **Handle errors appropriately**:
   ```typescript
   try {
     await page.goto(url);
   } catch (error) {
     console.error('Navigation failed:', error);
     // Capture failure screenshot
     await page.screenshot({ path: '/tmp/failure.png' });
   }
   ```

5. **Close pages when done** (for multiple pages):
   ```typescript
   const page1 = await manager.createPage();
   // Use page1
   await manager.closePage();
   
   const page2 = await manager.createPage();
   // Use page2
   ```

## Lambda Configuration Requirements

For optimal performance in Lambda:

- **Memory**: Minimum 2048 MB (recommended for browser automation)
- **Timeout**: 300 seconds (5 minutes) for test execution
- **Layer**: Playwright Lambda Layer must be attached
- **Environment Variables**: None required for basic usage

## Testing

The module includes comprehensive unit tests covering:

- Browser launch with various options
- Context and page creation
- Error handling scenarios
- Resource cleanup
- Utility functions

Run tests:
```bash
npm test -- playwrightConfig.test.ts
```

## Dependencies

- `playwright-aws-lambda`: Lambda-optimized Playwright
- `playwright-core`: Core Playwright library

These are provided by the Playwright Lambda Layer.

## Related Documentation

- [Playwright Lambda Layer Setup](../../../layers/playwright/README.md)
- [Playwright Documentation](https://playwright.dev/)
- [playwright-aws-lambda](https://github.com/JupiterOne/playwright-aws-lambda)

## Troubleshooting

### "Browser not launched" error
Call `launchBrowser()` before `createContext()`.

### "Context not created" error
Call `createContext()` before `createPage()`.

### Out of memory errors
- Increase Lambda memory to 2048 MB or higher
- Ensure cleanup is called to free resources
- Close pages when done with them

### Browser launch timeout
- Increase timeout in launch options
- Check Lambda has sufficient memory
- Verify Playwright layer is attached

## Future Enhancements

Potential improvements:

- Support for multiple browser types (Firefox, WebKit)
- Browser pool management for concurrent executions
- Screenshot comparison utilities
- Video recording support
- Network request interception
- Cookie management utilities
