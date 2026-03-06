/**
 * Screenshot Capture Utility for Test Execution
 *
 * This module provides utilities for capturing and managing screenshots
 * during Playwright test execution in AWS Lambda environment.
 * Screenshots are stored in /tmp directory (Lambda's writable directory)
 * and will be uploaded to S3 by the Storage Lambda.
 */

import type { Page } from 'playwright-core';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Screenshot metadata for organizing and identifying captures
 */
export interface ScreenshotMetadata {
  testId: string;
  resultId: string;
  stepNumber: number;
  stepAction: string;
  timestamp: number;
  screenshotType: 'step' | 'failure' | 'success';
}

/**
 * Screenshot capture result
 */
export interface ScreenshotResult {
  filePath: string;
  fileName: string;
  metadata: ScreenshotMetadata;
  success: boolean;
  error?: string;
}

/**
 * Options for screenshot capture
 */
export interface ScreenshotOptions {
  fullPage?: boolean;
  quality?: number;
  timeout?: number;
}

/**
 * Default screenshot options optimized for Lambda
 */
const DEFAULT_SCREENSHOT_OPTIONS: ScreenshotOptions = {
  fullPage: false, // Capture viewport only to reduce file size
  quality: 80, // Balance between quality and file size
  timeout: 5000, // 5 seconds timeout
};

/**
 * Screenshot capture manager for handling screenshot operations
 */
export class ScreenshotCaptureManager {
  private readonly tmpDir: string;
  private readonly testId: string;
  private readonly resultId: string;
  private capturedScreenshots: ScreenshotResult[] = [];

  /**
   * Initialize screenshot capture manager
   *
   * @param testId - Test identifier
   * @param resultId - Test result identifier
   * @param tmpDir - Temporary directory for storing screenshots (defaults to /tmp)
   */
  constructor(testId: string, resultId: string, tmpDir: string = '/tmp') {
    this.testId = testId;
    this.resultId = resultId;
    this.tmpDir = path.join(tmpDir, 'screenshots', resultId);
  }

  /**
   * Initialize the screenshot directory
   * Creates the directory structure in /tmp
   *
   * @throws Error if directory creation fails
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.tmpDir, { recursive: true });
      console.log(`Screenshot directory initialized: ${this.tmpDir}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize screenshot directory:', errorMessage);
      throw new Error(`Screenshot directory initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Generate screenshot filename with metadata
   * Format: {stepNumber}-{stepAction}-{timestamp}-{type}.png
   *
   * @param metadata - Screenshot metadata
   * @returns Filename string
   */
  private generateFileName(metadata: ScreenshotMetadata): string {
    const { stepNumber, stepAction, timestamp, screenshotType } = metadata;
    const sanitizedAction = stepAction.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `step-${stepNumber}-${sanitizedAction}-${timestamp}-${screenshotType}.png`;
  }

  /**
   * Capture a screenshot during test execution
   *
   * @param page - Playwright page instance
   * @param metadata - Screenshot metadata
   * @param options - Screenshot capture options
   * @returns Screenshot result with file path and metadata
   */
  async captureScreenshot(
    page: Page,
    metadata: ScreenshotMetadata,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    const captureOptions = { ...DEFAULT_SCREENSHOT_OPTIONS, ...options };
    const fileName = this.generateFileName(metadata);
    const filePath = path.join(this.tmpDir, fileName);

    try {
      console.log(`Capturing screenshot: ${fileName}`);

      // Capture screenshot with timeout
      await page.screenshot({
        path: filePath,
        fullPage: captureOptions.fullPage,
        type: 'png',
        timeout: captureOptions.timeout,
      });

      // Verify file was created and get size
      const stats = await fs.stat(filePath);
      const fileSizeKB = Math.round(stats.size / 1024);

      console.log(`Screenshot captured successfully: ${fileName} (${fileSizeKB} KB)`);

      const result: ScreenshotResult = {
        filePath,
        fileName,
        metadata,
        success: true,
      };

      this.capturedScreenshots.push(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to capture screenshot ${fileName}:`, errorMessage);

      const result: ScreenshotResult = {
        filePath,
        fileName,
        metadata,
        success: false,
        error: errorMessage,
      };

      this.capturedScreenshots.push(result);
      return result;
    }
  }

  /**
   * Capture a step screenshot (normal execution)
   *
   * @param page - Playwright page instance
   * @param stepNumber - Current step number
   * @param stepAction - Action being performed
   * @param options - Screenshot capture options
   * @returns Screenshot result
   */
  async captureStepScreenshot(
    page: Page,
    stepNumber: number,
    stepAction: string,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    const metadata: ScreenshotMetadata = {
      testId: this.testId,
      resultId: this.resultId,
      stepNumber,
      stepAction,
      timestamp: Date.now(),
      screenshotType: 'step',
    };

    return this.captureScreenshot(page, metadata, options);
  }

  /**
   * Capture a failure screenshot (when test fails)
   *
   * @param page - Playwright page instance
   * @param stepNumber - Step number where failure occurred
   * @param stepAction - Action that failed
   * @param options - Screenshot capture options (defaults to full page for failures)
   * @returns Screenshot result
   */
  async captureFailureScreenshot(
    page: Page,
    stepNumber: number,
    stepAction: string,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    const metadata: ScreenshotMetadata = {
      testId: this.testId,
      resultId: this.resultId,
      stepNumber,
      stepAction,
      timestamp: Date.now(),
      screenshotType: 'failure',
    };

    // Default to full page for failure screenshots
    const failureOptions = { ...options, fullPage: options.fullPage ?? true };

    return this.captureScreenshot(page, metadata, failureOptions);
  }

  /**
   * Capture a success screenshot (when test completes successfully)
   *
   * @param page - Playwright page instance
   * @param stepNumber - Final step number
   * @param options - Screenshot capture options
   * @returns Screenshot result
   */
  async captureSuccessScreenshot(
    page: Page,
    stepNumber: number,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    const metadata: ScreenshotMetadata = {
      testId: this.testId,
      resultId: this.resultId,
      stepNumber,
      stepAction: 'completion',
      timestamp: Date.now(),
      screenshotType: 'success',
    };

    return this.captureScreenshot(page, metadata, options);
  }

  /**
   * Get all captured screenshots
   *
   * @returns Array of screenshot results
   */
  getCapturedScreenshots(): ScreenshotResult[] {
    return [...this.capturedScreenshots];
  }

  /**
   * Get successfully captured screenshots only
   *
   * @returns Array of successful screenshot results
   */
  getSuccessfulScreenshots(): ScreenshotResult[] {
    return this.capturedScreenshots.filter((s) => s.success);
  }

  /**
   * Get failed screenshot captures
   *
   * @returns Array of failed screenshot results
   */
  getFailedScreenshots(): ScreenshotResult[] {
    return this.capturedScreenshots.filter((s) => !s.success);
  }

  /**
   * Get file paths of all successfully captured screenshots
   *
   * @returns Array of file paths
   */
  getScreenshotPaths(): string[] {
    return this.getSuccessfulScreenshots().map((s) => s.filePath);
  }

  /**
   * Get total size of all captured screenshots in bytes
   *
   * @returns Total size in bytes
   */
  async getTotalSize(): Promise<number> {
    let totalSize = 0;

    for (const screenshot of this.getSuccessfulScreenshots()) {
      try {
        const stats = await fs.stat(screenshot.filePath);
        totalSize += stats.size;
      } catch (error) {
        console.error(`Failed to get size for ${screenshot.fileName}:`, error);
      }
    }

    return totalSize;
  }

  /**
   * Clean up screenshot directory
   * Removes all screenshots from /tmp directory
   * Should be called after screenshots are uploaded to S3
   */
  async cleanup(): Promise<void> {
    try {
      console.log(`Cleaning up screenshot directory: ${this.tmpDir}`);
      await fs.rm(this.tmpDir, { recursive: true, force: true });
      console.log('Screenshot directory cleaned up successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to clean up screenshot directory:', errorMessage);
      // Don't throw error on cleanup failure
    }
  }

  /**
   * Get screenshot directory path
   *
   * @returns Directory path
   */
  getScreenshotDirectory(): string {
    return this.tmpDir;
  }

  /**
   * Get screenshot statistics
   *
   * @returns Statistics object
   */
  async getStatistics(): Promise<{
    total: number;
    successful: number;
    failed: number;
    totalSizeBytes: number;
    totalSizeKB: number;
    totalSizeMB: number;
  }> {
    const totalSizeBytes = await this.getTotalSize();

    return {
      total: this.capturedScreenshots.length,
      successful: this.getSuccessfulScreenshots().length,
      failed: this.getFailedScreenshots().length,
      totalSizeBytes,
      totalSizeKB: Math.round(totalSizeBytes / 1024),
      totalSizeMB: Math.round((totalSizeBytes / 1024 / 1024) * 100) / 100,
    };
  }
}

/**
 * Utility function to create and initialize a screenshot manager
 *
 * @param testId - Test identifier
 * @param resultId - Test result identifier
 * @param tmpDir - Temporary directory (defaults to /tmp)
 * @returns Initialized ScreenshotCaptureManager
 */
export async function createScreenshotManager(
  testId: string,
  resultId: string,
  tmpDir?: string
): Promise<ScreenshotCaptureManager> {
  const manager = new ScreenshotCaptureManager(testId, resultId, tmpDir);
  await manager.initialize();
  return manager;
}

/**
 * Utility function to safely capture a screenshot with error handling
 * Returns null if capture fails instead of throwing
 *
 * @param page - Playwright page instance
 * @param manager - Screenshot capture manager
 * @param stepNumber - Current step number
 * @param stepAction - Action being performed
 * @param screenshotType - Type of screenshot
 * @returns Screenshot result or null if failed
 */
export async function safeCapture(
  page: Page,
  manager: ScreenshotCaptureManager,
  stepNumber: number,
  stepAction: string,
  screenshotType: 'step' | 'failure' | 'success' = 'step'
): Promise<ScreenshotResult | null> {
  try {
    switch (screenshotType) {
      case 'failure':
        return await manager.captureFailureScreenshot(page, stepNumber, stepAction);
      case 'success':
        return await manager.captureSuccessScreenshot(page, stepNumber);
      case 'step':
      default:
        return await manager.captureStepScreenshot(page, stepNumber, stepAction);
    }
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    return null;
  }
}
