/**
 * Playwright Configuration for AWS Lambda
 * 
 * This module provides configuration and utilities for running Playwright
 * in AWS Lambda environment with headless Chromium browser.
 */

import playwright from 'playwright-aws-lambda';
import type { Browser, Page, BrowserContext } from 'playwright-core';

/**
 * Browser launch options for Lambda environment
 */
export interface PlaywrightLaunchOptions {
  headless?: boolean;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
}

/**
 * Default configuration optimized for AWS Lambda
 */
export const DEFAULT_LAUNCH_OPTIONS: PlaywrightLaunchOptions = {
  headless: true,
  timeout: 30000, // 30 seconds
  viewport: {
    width: 1920,
    height: 1080,
  },
};

/**
 * Browser manager for handling Playwright browser lifecycle
 */
export class PlaywrightBrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * Launch a Chromium browser instance optimized for Lambda
   * 
   * @param options - Browser launch options
   * @returns Browser instance
   * @throws Error if browser launch fails
   */
  async launchBrowser(options: PlaywrightLaunchOptions = {}): Promise<Browser> {
    try {
      const launchOptions = { ...DEFAULT_LAUNCH_OPTIONS, ...options };

      console.log('Launching Chromium browser with options:', launchOptions);

      // Use playwright-aws-lambda which handles Lambda-specific optimizations
      this.browser = await playwright.launchChromium({
        headless: launchOptions.headless,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--single-process',
          '--no-zygote',
        ],
      });

      console.log('Browser launched successfully');
      return this.browser;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to launch browser:', errorMessage);
      throw new Error(`Browser launch failed: ${errorMessage}`);
    }
  }

  /**
   * Create a new browser context with specified options
   * 
   * @param options - Browser launch options for viewport and user agent
   * @returns Browser context
   * @throws Error if browser is not launched or context creation fails
   */
  async createContext(options: PlaywrightLaunchOptions = {}): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launchBrowser() first.');
    }

    try {
      const contextOptions = { ...DEFAULT_LAUNCH_OPTIONS, ...options };

      this.context = await this.browser.newContext({
        viewport: contextOptions.viewport,
        userAgent: contextOptions.userAgent,
      });

      console.log('Browser context created');
      return this.context;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create browser context:', errorMessage);
      throw new Error(`Context creation failed: ${errorMessage}`);
    }
  }

  /**
   * Create a new page in the browser context
   * 
   * @param timeout - Default timeout for page operations (optional)
   * @returns Page instance
   * @throws Error if context is not created or page creation fails
   */
  async createPage(timeout?: number): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not created. Call createContext() first.');
    }

    try {
      this.page = await this.context.newPage();

      // Set default timeout if provided
      if (timeout) {
        this.page.setDefaultTimeout(timeout);
      }

      console.log('Page created successfully');
      return this.page;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create page:', errorMessage);
      throw new Error(`Page creation failed: ${errorMessage}`);
    }
  }

  /**
   * Initialize browser with context and page in one call
   * 
   * @param options - Browser launch options
   * @returns Object containing browser, context, and page
   * @throws Error if initialization fails
   */
  async initialize(options: PlaywrightLaunchOptions = {}): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
  }> {
    try {
      const browser = await this.launchBrowser(options);
      const context = await this.createContext(options);
      const page = await this.createPage(options.timeout);

      return { browser, context, page };
    } catch (error) {
      // Clean up any partially initialized resources
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Close the current page
   */
  async closePage(): Promise<void> {
    if (this.page) {
      try {
        await this.page.close();
        console.log('Page closed');
      } catch (error) {
        console.error('Error closing page:', error);
      } finally {
        this.page = null;
      }
    }
  }

  /**
   * Close the browser context
   */
  async closeContext(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
        console.log('Context closed');
      } catch (error) {
        console.error('Error closing context:', error);
      } finally {
        this.context = null;
      }
    }
  }

  /**
   * Close the browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('Browser closed');
      } catch (error) {
        console.error('Error closing browser:', error);
      } finally {
        this.browser = null;
      }
    }
  }

  /**
   * Clean up all resources (page, context, browser)
   * Should be called in finally block to ensure cleanup
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up browser resources');
    await this.closePage();
    await this.closeContext();
    await this.closeBrowser();
  }

  /**
   * Get the current browser instance
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Get the current context instance
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Get the current page instance
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Check if browser is currently running
   */
  isBrowserRunning(): boolean {
    return this.browser !== null;
  }
}

/**
 * Utility function to create a browser manager with initialized browser
 * 
 * @param options - Browser launch options
 * @returns Initialized PlaywrightBrowserManager
 */
export async function createBrowserManager(
  options: PlaywrightLaunchOptions = {}
): Promise<PlaywrightBrowserManager> {
  const manager = new PlaywrightBrowserManager();
  await manager.initialize(options);
  return manager;
}

/**
 * Utility function for quick browser operations with automatic cleanup
 * 
 * @param callback - Function to execute with the page
 * @param options - Browser launch options
 * @returns Result from the callback
 */
export async function withBrowser<T>(
  callback: (page: Page) => Promise<T>,
  options: PlaywrightLaunchOptions = {}
): Promise<T> {
  const manager = new PlaywrightBrowserManager();

  try {
    const { page } = await manager.initialize(options);
    return await callback(page);
  } finally {
    await manager.cleanup();
  }
}
