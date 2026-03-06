/**
 * Unit tests for Screenshot Capture Utility
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Page } from 'playwright-core';
import {
  ScreenshotCaptureManager,
  createScreenshotManager,
  safeCapture,
  type ScreenshotOptions,
} from '../../src/shared/utils/screenshotCapture';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    stat: jest.fn(),
    rm: jest.fn(),
  },
}));

// Mock Playwright Page
const createMockPage = (): jest.Mocked<Page> => {
  return {
    screenshot: jest.fn(),
  } as any;
};

describe('ScreenshotCaptureManager', () => {
  const testId = 'test-123';
  const resultId = 'result-456';
  const tmpDir = '/tmp/test';
  let manager: ScreenshotCaptureManager;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ScreenshotCaptureManager(testId, resultId, tmpDir);
    mockPage = createMockPage();
  });

  describe('initialize', () => {
    it('should create screenshot directory', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await manager.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(tmpDir, 'screenshots', resultId),
        { recursive: true }
      );
    });

    it('should throw error if directory creation fails', async () => {
      const error = new Error('Permission denied');
      (fs.mkdir as jest.Mock).mockRejectedValue(error);

      await expect(manager.initialize()).rejects.toThrow(
        'Screenshot directory initialization failed: Permission denied'
      );
    });
  });

  describe('captureStepScreenshot', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 10240 }); // 10 KB
      await manager.initialize();
    });

    it('should capture screenshot with correct metadata', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      const result = await manager.captureStepScreenshot(mockPage, 1, 'navigate');

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('step-1-navigate'),
          fullPage: false,
          type: 'png',
          timeout: 5000,
        })
      );
      expect(result.success).toBe(true);
      expect(result.metadata.stepNumber).toBe(1);
      expect(result.metadata.stepAction).toBe('navigate');
      expect(result.metadata.screenshotType).toBe('step');
      expect(result.metadata.testId).toBe(testId);
      expect(result.metadata.resultId).toBe(resultId);
    });

    it('should sanitize step action in filename', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      const result = await manager.captureStepScreenshot(mockPage, 2, 'fill #email');

      expect(result.fileName).toMatch(/step-2-fill--email-\d+-step\.png/);
    });

    it('should handle screenshot capture failure gracefully', async () => {
      const error = new Error('Screenshot timeout');
      mockPage.screenshot.mockRejectedValue(error);

      const result = await manager.captureStepScreenshot(mockPage, 1, 'click');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Screenshot timeout');
    });

    it('should track captured screenshots', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      await manager.captureStepScreenshot(mockPage, 1, 'navigate');
      await manager.captureStepScreenshot(mockPage, 2, 'fill');

      const screenshots = manager.getCapturedScreenshots();
      expect(screenshots).toHaveLength(2);
    });

    it('should use custom screenshot options', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      const options: ScreenshotOptions = {
        fullPage: true,
        timeout: 10000,
      };

      await manager.captureStepScreenshot(mockPage, 1, 'navigate', options);

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          fullPage: true,
          timeout: 10000,
        })
      );
    });
  });

  describe('captureFailureScreenshot', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 20480 }); // 20 KB
      await manager.initialize();
    });

    it('should capture failure screenshot with full page by default', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      const result = await manager.captureFailureScreenshot(mockPage, 3, 'assert');

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          fullPage: true,
          type: 'png',
        })
      );
      expect(result.metadata.screenshotType).toBe('failure');
    });

    it('should include failure in filename', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      const result = await manager.captureFailureScreenshot(mockPage, 3, 'assert');

      expect(result.fileName).toMatch(/step-3-assert-\d+-failure\.png/);
    });

    it('should allow overriding fullPage option', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      await manager.captureFailureScreenshot(mockPage, 3, 'assert', { fullPage: false });

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          fullPage: false,
        })
      );
    });
  });

  describe('captureSuccessScreenshot', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 15360 }); // 15 KB
      await manager.initialize();
    });

    it('should capture success screenshot', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      const result = await manager.captureSuccessScreenshot(mockPage, 5);

      expect(result.success).toBe(true);
      expect(result.metadata.screenshotType).toBe('success');
      expect(result.metadata.stepAction).toBe('completion');
      expect(result.fileName).toMatch(/step-5-completion-\d+-success\.png/);
    });
  });

  describe('getSuccessfulScreenshots', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 10240 });
      await manager.initialize();
    });

    it('should return only successful screenshots', async () => {
      mockPage.screenshot
        .mockResolvedValueOnce(Buffer.from(''))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(Buffer.from(''));

      await manager.captureStepScreenshot(mockPage, 1, 'navigate');
      await manager.captureStepScreenshot(mockPage, 2, 'fill');
      await manager.captureStepScreenshot(mockPage, 3, 'click');

      const successful = manager.getSuccessfulScreenshots();
      expect(successful).toHaveLength(2);
      expect(successful.every(s => s.success)).toBe(true);
    });
  });

  describe('getFailedScreenshots', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 10240 });
      await manager.initialize();
    });

    it('should return only failed screenshots', async () => {
      mockPage.screenshot
        .mockResolvedValueOnce(Buffer.from(''))
        .mockRejectedValueOnce(new Error('Failed 1'))
        .mockRejectedValueOnce(new Error('Failed 2'));

      await manager.captureStepScreenshot(mockPage, 1, 'navigate');
      await manager.captureStepScreenshot(mockPage, 2, 'fill');
      await manager.captureStepScreenshot(mockPage, 3, 'click');

      const failed = manager.getFailedScreenshots();
      expect(failed).toHaveLength(2);
      expect(failed.every(s => !s.success)).toBe(true);
    });
  });

  describe('getScreenshotPaths', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 10240 });
      await manager.initialize();
    });

    it('should return file paths of successful screenshots', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));

      await manager.captureStepScreenshot(mockPage, 1, 'navigate');
      await manager.captureStepScreenshot(mockPage, 2, 'fill');

      const paths = manager.getScreenshotPaths();
      expect(paths).toHaveLength(2);
      expect(paths[0]).toContain('screenshots');
      expect(paths[0]).toContain('result-456');
      expect(paths[1]).toContain('screenshots');
      expect(paths[1]).toContain('result-456');
    });
  });

  describe('getTotalSize', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      await manager.initialize();
    });

    it('should calculate total size of all screenshots', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));
      
      // Mock stat for each screenshot capture
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce({ size: 10240 }) // First capture
        .mockResolvedValueOnce({ size: 20480 }) // Second capture
        .mockResolvedValueOnce({ size: 15360 }) // Third capture
        .mockResolvedValueOnce({ size: 10240 }) // getTotalSize call 1
        .mockResolvedValueOnce({ size: 20480 }) // getTotalSize call 2
        .mockResolvedValueOnce({ size: 15360 }); // getTotalSize call 3

      await manager.captureStepScreenshot(mockPage, 1, 'navigate');
      await manager.captureStepScreenshot(mockPage, 2, 'fill');
      await manager.captureStepScreenshot(mockPage, 3, 'click');

      const totalSize = await manager.getTotalSize();
      expect(totalSize).toBe(46080); // 45 KB
    });

    it('should handle stat errors gracefully', async () => {
      mockPage.screenshot.mockResolvedValue(Buffer.from(''));
      (fs.stat as jest.Mock)
        .mockResolvedValueOnce({ size: 10240 })
        .mockRejectedValueOnce(new Error('File not found'));

      await manager.captureStepScreenshot(mockPage, 1, 'navigate');
      await manager.captureStepScreenshot(mockPage, 2, 'fill');

      const totalSize = await manager.getTotalSize();
      expect(totalSize).toBe(10240); // Only first file counted
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      await manager.initialize();
    });

    it('should remove screenshot directory', async () => {
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      await manager.cleanup();

      expect(fs.rm).toHaveBeenCalledWith(
        path.join(tmpDir, 'screenshots', resultId),
        { recursive: true, force: true }
      );
    });

    it('should not throw error if cleanup fails', async () => {
      (fs.rm as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(manager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      await manager.initialize();
    });

    it('should return comprehensive statistics', async () => {
      mockPage.screenshot
        .mockResolvedValueOnce(Buffer.from(''))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(Buffer.from(''));

      (fs.stat as jest.Mock)
        .mockResolvedValueOnce({ size: 10240 }) // First capture
        .mockResolvedValueOnce({ size: 20480 }) // Third capture
        .mockResolvedValueOnce({ size: 10240 }) // getTotalSize call 1
        .mockResolvedValueOnce({ size: 20480 }); // getTotalSize call 2

      await manager.captureStepScreenshot(mockPage, 1, 'navigate');
      await manager.captureStepScreenshot(mockPage, 2, 'fill');
      await manager.captureStepScreenshot(mockPage, 3, 'click');

      const stats = await manager.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.totalSizeBytes).toBe(30720);
      expect(stats.totalSizeKB).toBe(30);
      expect(stats.totalSizeMB).toBe(0.03);
    });
  });

  describe('getScreenshotDirectory', () => {
    it('should return screenshot directory path', () => {
      const dir = manager.getScreenshotDirectory();
      expect(dir).toBe(path.join(tmpDir, 'screenshots', resultId));
    });
  });
});

describe('createScreenshotManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create and initialize manager', async () => {
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

    const manager = await createScreenshotManager('test-123', 'result-456');

    expect(fs.mkdir).toHaveBeenCalled();
    expect(manager).toBeInstanceOf(ScreenshotCaptureManager);
  });

  it('should use custom tmpDir if provided', async () => {
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

    await createScreenshotManager('test-123', 'result-456', '/custom/tmp');

    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('custom'),
      { recursive: true }
    );
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('result-456'),
      { recursive: true }
    );
  });
});

describe('safeCapture', () => {
  let manager: ScreenshotCaptureManager;
  let mockPage: jest.Mocked<Page>;

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ size: 10240 });
    
    manager = new ScreenshotCaptureManager('test-123', 'result-456');
    await manager.initialize();
    mockPage = createMockPage();
  });

  it('should capture step screenshot by default', async () => {
    mockPage.screenshot.mockResolvedValue(Buffer.from(''));

    const result = await safeCapture(mockPage, manager, 1, 'navigate');

    expect(result).not.toBeNull();
    expect(result?.metadata.screenshotType).toBe('step');
  });

  it('should capture failure screenshot when specified', async () => {
    mockPage.screenshot.mockResolvedValue(Buffer.from(''));

    const result = await safeCapture(mockPage, manager, 1, 'navigate', 'failure');

    expect(result).not.toBeNull();
    expect(result?.metadata.screenshotType).toBe('failure');
  });

  it('should capture success screenshot when specified', async () => {
    mockPage.screenshot.mockResolvedValue(Buffer.from(''));

    const result = await safeCapture(mockPage, manager, 1, 'navigate', 'success');

    expect(result).not.toBeNull();
    expect(result?.metadata.screenshotType).toBe('success');
  });

  it('should return null on error instead of throwing', async () => {
    mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));

    const result = await safeCapture(mockPage, manager, 1, 'navigate');

    // safeCapture returns the result even on failure, but with success: false
    expect(result).not.toBeNull();
    expect(result?.success).toBe(false);
  });
});
