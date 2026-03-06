/**
 * Unit tests for Playwright configuration module
 */

// Mock playwright-aws-lambda before importing
const mockLaunchChromium = jest.fn();
jest.mock('playwright-aws-lambda', () => ({
  __esModule: true,
  default: {
    launchChromium: (...args: any[]) => mockLaunchChromium(...args),
  },
}));

import {
  PlaywrightBrowserManager,
  createBrowserManager,
  withBrowser,
  DEFAULT_LAUNCH_OPTIONS,
  type PlaywrightLaunchOptions,
} from '../../src/shared/utils/playwrightConfig';
import type { Browser, BrowserContext, Page } from 'playwright-core';

describe('PlaywrightBrowserManager', () => {
  let manager: PlaywrightBrowserManager;
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    manager = new PlaywrightBrowserManager();

    // Create mock objects
    mockPage = {
      close: jest.fn().mockResolvedValue(undefined),
      setDefaultTimeout: jest.fn(),
    } as unknown as jest.Mocked<Page>;

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BrowserContext>;

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Browser>;

    // Mock launchChromium
    mockLaunchChromium.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('launchBrowser', () => {
    it('should launch browser with default options', async () => {
      const browser = await manager.launchBrowser();

      expect(mockLaunchChromium).toHaveBeenCalledWith({
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--single-process',
          '--no-zygote',
        ],
      });
      expect(browser).toBe(mockBrowser);
    });

    it('should launch browser with custom headless option', async () => {
      const options: PlaywrightLaunchOptions = { headless: false };
      await manager.launchBrowser(options);

      expect(mockLaunchChromium).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: false,
        })
      );
    });

    it('should throw error if browser launch fails', async () => {
      const error = new Error('Launch failed');
      mockLaunchChromium.mockRejectedValue(error);

      await expect(manager.launchBrowser()).rejects.toThrow(
        'Browser launch failed: Launch failed'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockLaunchChromium.mockRejectedValue('String error');

      await expect(manager.launchBrowser()).rejects.toThrow(
        'Browser launch failed: Unknown error'
      );
    });

    it('should store browser instance', async () => {
      await manager.launchBrowser();
      expect(manager.getBrowser()).toBe(mockBrowser);
      expect(manager.isBrowserRunning()).toBe(true);
    });
  });

  describe('createContext', () => {
    beforeEach(async () => {
      await manager.launchBrowser();
    });

    it('should create context with default viewport', async () => {
      const context = await manager.createContext();

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: DEFAULT_LAUNCH_OPTIONS.viewport,
        userAgent: undefined,
      });
      expect(context).toBe(mockContext);
    });

    it('should create context with custom viewport', async () => {
      const options: PlaywrightLaunchOptions = {
        viewport: { width: 1280, height: 720 },
      };
      await manager.createContext(options);

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1280, height: 720 },
        userAgent: undefined,
      });
    });

    it('should create context with custom user agent', async () => {
      const options: PlaywrightLaunchOptions = {
        userAgent: 'Custom User Agent',
      };
      await manager.createContext(options);

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: DEFAULT_LAUNCH_OPTIONS.viewport,
        userAgent: 'Custom User Agent',
      });
    });

    it('should throw error if browser not launched', async () => {
      const newManager = new PlaywrightBrowserManager();

      await expect(newManager.createContext()).rejects.toThrow(
        'Browser not launched. Call launchBrowser() first.'
      );
    });

    it('should throw error if context creation fails', async () => {
      const error = new Error('Context creation failed');
      mockBrowser.newContext.mockRejectedValue(error);

      await expect(manager.createContext()).rejects.toThrow(
        'Context creation failed: Context creation failed'
      );
    });

    it('should store context instance', async () => {
      await manager.createContext();
      expect(manager.getContext()).toBe(mockContext);
    });
  });

  describe('createPage', () => {
    beforeEach(async () => {
      await manager.launchBrowser();
      await manager.createContext();
    });

    it('should create page successfully', async () => {
      const page = await manager.createPage();

      expect(mockContext.newPage).toHaveBeenCalled();
      expect(page).toBe(mockPage);
    });

    it('should set default timeout if provided', async () => {
      await manager.createPage(60000);

      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(60000);
    });

    it('should not set timeout if not provided', async () => {
      await manager.createPage();

      expect(mockPage.setDefaultTimeout).not.toHaveBeenCalled();
    });

    it('should throw error if context not created', async () => {
      const newManager = new PlaywrightBrowserManager();
      await newManager.launchBrowser();

      await expect(newManager.createPage()).rejects.toThrow(
        'Browser context not created. Call createContext() first.'
      );
    });

    it('should throw error if page creation fails', async () => {
      const error = new Error('Page creation failed');
      mockContext.newPage.mockRejectedValue(error);

      await expect(manager.createPage()).rejects.toThrow(
        'Page creation failed: Page creation failed'
      );
    });

    it('should store page instance', async () => {
      await manager.createPage();
      expect(manager.getPage()).toBe(mockPage);
    });
  });

  describe('initialize', () => {
    it('should initialize browser, context, and page', async () => {
      const result = await manager.initialize();

      expect(result.browser).toBe(mockBrowser);
      expect(result.context).toBe(mockContext);
      expect(result.page).toBe(mockPage);
    });

    it('should initialize with custom options', async () => {
      const options: PlaywrightLaunchOptions = {
        headless: false,
        timeout: 45000,
        viewport: { width: 1280, height: 720 },
      };

      await manager.initialize(options);

      expect(mockLaunchChromium).toHaveBeenCalledWith(
        expect.objectContaining({ headless: false })
      );
      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { width: 1280, height: 720 },
        })
      );
      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(45000);
    });

    it('should cleanup on initialization failure', async () => {
      const error = new Error('Initialization failed');
      mockContext.newPage.mockRejectedValue(error);

      await expect(manager.initialize()).rejects.toThrow('Page creation failed: Initialization failed');

      // Verify cleanup was called
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('cleanup methods', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should close page', async () => {
      await manager.closePage();

      expect(mockPage.close).toHaveBeenCalled();
      expect(manager.getPage()).toBeNull();
    });

    it('should handle page close errors gracefully', async () => {
      mockPage.close.mockRejectedValue(new Error('Close failed'));

      await expect(manager.closePage()).resolves.not.toThrow();
      expect(manager.getPage()).toBeNull();
    });

    it('should close context', async () => {
      await manager.closeContext();

      expect(mockContext.close).toHaveBeenCalled();
      expect(manager.getContext()).toBeNull();
    });

    it('should handle context close errors gracefully', async () => {
      mockContext.close.mockRejectedValue(new Error('Close failed'));

      await expect(manager.closeContext()).resolves.not.toThrow();
      expect(manager.getContext()).toBeNull();
    });

    it('should close browser', async () => {
      await manager.closeBrowser();

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(manager.getBrowser()).toBeNull();
      expect(manager.isBrowserRunning()).toBe(false);
    });

    it('should handle browser close errors gracefully', async () => {
      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      await expect(manager.closeBrowser()).resolves.not.toThrow();
      expect(manager.getBrowser()).toBeNull();
    });

    it('should cleanup all resources', async () => {
      await manager.cleanup();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(manager.getPage()).toBeNull();
      expect(manager.getContext()).toBeNull();
      expect(manager.getBrowser()).toBeNull();
    });

    it('should handle cleanup when resources are null', async () => {
      const newManager = new PlaywrightBrowserManager();

      await expect(newManager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getter methods', () => {
    it('should return null for uninitialized resources', () => {
      expect(manager.getBrowser()).toBeNull();
      expect(manager.getContext()).toBeNull();
      expect(manager.getPage()).toBeNull();
      expect(manager.isBrowserRunning()).toBe(false);
    });

    it('should return initialized resources', async () => {
      await manager.initialize();

      expect(manager.getBrowser()).toBe(mockBrowser);
      expect(manager.getContext()).toBe(mockContext);
      expect(manager.getPage()).toBe(mockPage);
      expect(manager.isBrowserRunning()).toBe(true);
    });
  });
});

describe('createBrowserManager', () => {
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    mockPage = {
      close: jest.fn().mockResolvedValue(undefined),
      setDefaultTimeout: jest.fn(),
    } as unknown as jest.Mocked<Page>;

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BrowserContext>;

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Browser>;

    mockLaunchChromium.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create and initialize browser manager', async () => {
    const manager = await createBrowserManager();

    expect(manager).toBeInstanceOf(PlaywrightBrowserManager);
    expect(manager.isBrowserRunning()).toBe(true);
    expect(manager.getBrowser()).toBe(mockBrowser);
    expect(manager.getContext()).toBe(mockContext);
    expect(manager.getPage()).toBe(mockPage);
  });

  it('should create browser manager with custom options', async () => {
    const options: PlaywrightLaunchOptions = {
      headless: false,
      timeout: 60000,
    };

    const manager = await createBrowserManager(options);

    expect(mockLaunchChromium).toHaveBeenCalledWith(
      expect.objectContaining({ headless: false })
    );
    expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(60000);
    expect(manager.isBrowserRunning()).toBe(true);
  });
});

describe('withBrowser', () => {
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    mockPage = {
      close: jest.fn().mockResolvedValue(undefined),
      setDefaultTimeout: jest.fn(),
      goto: jest.fn().mockResolvedValue(null),
      title: jest.fn().mockResolvedValue('Test Page'),
    } as unknown as jest.Mocked<Page>;

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BrowserContext>;

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Browser>;

    mockLaunchChromium.mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should execute callback with page', async () => {
    const callback = jest.fn(async (page: Page) => {
      await page.goto('https://example.com');
      return await page.title();
    });

    const result = await withBrowser(callback);

    expect(callback).toHaveBeenCalledWith(mockPage);
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com');
    expect(result).toBe('Test Page');
  });

  it('should cleanup browser after callback completes', async () => {
    const callback = jest.fn(async () => 'success');

    await withBrowser(callback);

    expect(mockPage.close).toHaveBeenCalled();
    expect(mockContext.close).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should cleanup browser even if callback throws', async () => {
    const error = new Error('Callback failed');
    const callback = jest.fn(async () => {
      throw error;
    });

    await expect(withBrowser(callback)).rejects.toThrow(error);

    expect(mockPage.close).toHaveBeenCalled();
    expect(mockContext.close).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should pass custom options to browser initialization', async () => {
    const options: PlaywrightLaunchOptions = {
      headless: false,
      viewport: { width: 800, height: 600 },
    };
    const callback = jest.fn(async () => 'success');

    await withBrowser(callback, options);

    expect(mockLaunchChromium).toHaveBeenCalledWith(
      expect.objectContaining({ headless: false })
    );
    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: { width: 800, height: 600 },
      })
    );
  });

  it('should return callback result', async () => {
    const callback = async () => ({ status: 'success', data: 123 });

    const result = await withBrowser(callback);

    expect(result).toEqual({ status: 'success', data: 123 });
  });
});

describe('DEFAULT_LAUNCH_OPTIONS', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_LAUNCH_OPTIONS).toEqual({
      headless: true,
      timeout: 30000,
      viewport: {
        width: 1920,
        height: 1080,
      },
    });
  });
});
