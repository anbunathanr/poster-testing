import { promises as fs } from 'fs';
import { join } from 'path';
import {
  ExecutionLogger,
  createExecutionLogger,
  LogLevel,
} from '../../src/shared/utils/executionLogger';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('ExecutionLogger', () => {
  const mockTestId = 'test-123';
  const mockResultId = 'result-456';
  const mockTmpDir = '/tmp';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create logger with default options', () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      
      expect(logger).toBeInstanceOf(ExecutionLogger);
      expect(logger.getLogFilePath()).toContain('logs');
      expect(logger.getLogFilePath()).toContain('execution-result-456');
    });

    it('should create logger with custom tmpDir', () => {
      const customTmpDir = '/custom/tmp';
      const logger = new ExecutionLogger(mockTestId, mockResultId, {
        tmpDir: customTmpDir,
      });
      
      expect(logger.getLogFilePath()).toContain('logs');
      expect(logger.getLogFilePath()).toContain('execution-result-456');
    });

    it('should create logger with custom maxLogSize', () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId, {
        maxLogSize: 1024 * 1024, // 1MB
      });
      
      expect(logger).toBeInstanceOf(ExecutionLogger);
    });
  });

  describe('initialize', () => {
    it('should create log directory', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      
      await logger.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        join(mockTmpDir, 'logs'),
        { recursive: true }
      );
    });

    it('should log initialization message', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      
      await logger.initialize();
      
      const log = logger.getExecutionLog();
      expect(log.entries).toHaveLength(1);
      expect(log.entries[0].message).toBe('Execution logger initialized');
      expect(log.entries[0].level).toBe(LogLevel.INFO);
    });

    it('should handle initialization errors gracefully', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
      
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await logger.initialize();
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const log = logger.getExecutionLog();
      expect(log.entries.some(e => e.message.includes('initialization failed'))).toBe(true);
      
      consoleErrorSpy.mockRestore();
    });

    it('should start auto-flush timer when flushInterval is set', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId, {
        flushInterval: 5000,
      });
      
      await logger.initialize();
      
      // Timer should be set
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });
  });

  describe('log', () => {
    it('should add log entry with correct structure', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.log(LogLevel.INFO, 'Test message', { key: 'value' });
      
      const log = logger.getExecutionLog();
      const lastEntry = log.entries[log.entries.length - 1];
      
      expect(lastEntry.level).toBe(LogLevel.INFO);
      expect(lastEntry.message).toBe('Test message');
      expect(lastEntry.timestamp).toBe('2024-01-15T10:00:00.000Z');
      expect(lastEntry.metadata).toEqual({ key: 'value' });
    });

    it('should not log to closed logger', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      await logger.close();
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      logger.log(LogLevel.INFO, 'Should not be logged');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('Attempted to log to closed logger');
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('logStepStart', () => {
    it('should log step start with correct metadata', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.logStepStart(1, 'navigate', { url: 'https://example.com' });
      
      const log = logger.getExecutionLog();
      const lastEntry = log.entries[log.entries.length - 1];
      
      expect(lastEntry.message).toBe('Step 1 started: navigate');
      expect(lastEntry.metadata).toMatchObject({
        stepNumber: 1,
        stepAction: 'navigate',
        event: 'step_start',
        url: 'https://example.com',
      });
    });
  });

  describe('logStepComplete', () => {
    it('should log step completion with duration', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.logStepComplete(1, 'navigate', 1500, { success: true });
      
      const log = logger.getExecutionLog();
      const lastEntry = log.entries[log.entries.length - 1];
      
      expect(lastEntry.message).toBe('Step 1 completed: navigate');
      expect(lastEntry.metadata).toMatchObject({
        stepNumber: 1,
        stepAction: 'navigate',
        duration: 1500,
        event: 'step_complete',
        success: true,
      });
    });

    it('should increment completedSteps counter', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.logStepComplete(1, 'navigate', 1000);
      logger.logStepComplete(2, 'click', 500);
      
      const log = logger.getExecutionLog();
      expect(log.metadata.completedSteps).toBe(2);
    });
  });

  describe('logStepFailure', () => {
    it('should log step failure with error details', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      const error = new Error('Element not found');
      error.stack = 'Error: Element not found\n  at test.ts:10:5';
      
      logger.logStepFailure(3, 'click', error, { selector: '#button' });
      
      const log = logger.getExecutionLog();
      const lastEntry = log.entries[log.entries.length - 1];
      
      expect(lastEntry.level).toBe(LogLevel.ERROR);
      expect(lastEntry.message).toBe('Step 3 failed: click');
      expect(lastEntry.stepNumber).toBe(3);
      expect(lastEntry.stepAction).toBe('click');
      expect(lastEntry.error).toMatchObject({
        message: 'Element not found',
        stack: 'Error: Element not found\n  at test.ts:10:5',
      });
      expect(lastEntry.metadata).toMatchObject({
        event: 'step_failure',
        selector: '#button',
      });
    });
  });

  describe('logExecutionStart', () => {
    it('should log execution start with total steps', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.logExecutionStart(5, { environment: 'DEV' });
      
      const log = logger.getExecutionLog();
      expect(log.metadata.totalSteps).toBe(5);
      
      const lastEntry = log.entries[log.entries.length - 1];
      expect(lastEntry.message).toBe('Test execution started');
      expect(lastEntry.metadata).toMatchObject({
        totalSteps: 5,
        event: 'execution_start',
        environment: 'DEV',
      });
    });
  });

  describe('logExecutionComplete', () => {
    it('should log execution completion with PASS status', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);
      
      logger.logExecutionComplete('PASS', { screenshotCount: 5 });
      
      const log = logger.getExecutionLog();
      expect(log.metadata.status).toBe('PASS');
      expect(log.metadata.endTime).toBe('2024-01-15T10:00:05.000Z');
      expect(log.metadata.totalDuration).toBe(5000);
      
      const lastEntry = log.entries[log.entries.length - 1];
      expect(lastEntry.message).toBe('Test execution completed: PASS');
      expect(lastEntry.metadata).toMatchObject({
        status: 'PASS',
        duration: 5000,
        event: 'execution_complete',
        screenshotCount: 5,
      });
    });

    it('should log execution completion with FAIL status', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      jest.advanceTimersByTime(3000);
      
      logger.logExecutionComplete('FAIL', { failureReason: 'Assertion failed' });
      
      const log = logger.getExecutionLog();
      expect(log.metadata.status).toBe('FAIL');
      expect(log.metadata.totalDuration).toBe(3000);
    });
  });

  describe('logError', () => {
    it('should log error with stack trace', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      const error = new Error('Unexpected error');
      error.stack = 'Error: Unexpected error\n  at handler.ts:50:10';
      
      logger.logError('Browser crashed', error, { browserType: 'chromium' });
      
      const log = logger.getExecutionLog();
      const lastEntry = log.entries[log.entries.length - 1];
      
      expect(lastEntry.level).toBe(LogLevel.ERROR);
      expect(lastEntry.message).toBe('Browser crashed');
      expect(lastEntry.error).toMatchObject({
        message: 'Unexpected error',
        stack: 'Error: Unexpected error\n  at handler.ts:50:10',
      });
      expect(lastEntry.metadata).toMatchObject({
        browserType: 'chromium',
      });
    });
  });

  describe('logWarning', () => {
    it('should log warning message', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.logWarning('Slow network detected', { latency: 5000 });
      
      const log = logger.getExecutionLog();
      const lastEntry = log.entries[log.entries.length - 1];
      
      expect(lastEntry.level).toBe(LogLevel.WARN);
      expect(lastEntry.message).toBe('Slow network detected');
      expect(lastEntry.metadata).toMatchObject({ latency: 5000 });
    });
  });

  describe('logDebug', () => {
    it('should log debug message', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.logDebug('Page loaded', { loadTime: 1200 });
      
      const log = logger.getExecutionLog();
      const lastEntry = log.entries[log.entries.length - 1];
      
      expect(lastEntry.level).toBe(LogLevel.DEBUG);
      expect(lastEntry.message).toBe('Page loaded');
    });
  });

  describe('flush', () => {
    it('should write log to file', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.log(LogLevel.INFO, 'Test message');
      await logger.flush();
      
      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = (fs.writeFile as jest.Mock).mock.calls.find(
        call => call[0].includes('execution-result-456')
      );
      expect(writeCall).toBeDefined();
      
      const writtenData = JSON.parse(writeCall[1]);
      expect(writtenData.metadata.testId).toBe(mockTestId);
      expect(writtenData.entries).toHaveLength(2); // init + test message
    });

    it('should handle write errors gracefully', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('Disk full'));
      
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      logger.log(LogLevel.INFO, 'Test message');
      await logger.flush();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to write log file:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should not write if no entries', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      // Don't initialize to avoid init log entry
      
      await logger.flush();
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('getExecutionLog', () => {
    it('should return complete execution log', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.logExecutionStart(3);
      logger.logStepStart(1, 'navigate');
      logger.logStepComplete(1, 'navigate', 1000);
      
      const log = logger.getExecutionLog();
      
      expect(log.metadata.testId).toBe(mockTestId);
      expect(log.metadata.resultId).toBe(mockResultId);
      expect(log.metadata.totalSteps).toBe(3);
      expect(log.metadata.completedSteps).toBe(1);
      expect(log.entries.length).toBeGreaterThan(0);
    });
  });

  describe('getEntriesByLevel', () => {
    it('should filter entries by log level', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.log(LogLevel.INFO, 'Info message');
      logger.log(LogLevel.ERROR, 'Error message');
      logger.log(LogLevel.WARN, 'Warning message');
      logger.log(LogLevel.INFO, 'Another info');
      
      const infoEntries = logger.getEntriesByLevel(LogLevel.INFO);
      const errorEntries = logger.getEntriesByLevel(LogLevel.ERROR);
      
      expect(infoEntries.length).toBe(3); // init + 2 info messages
      expect(errorEntries.length).toBe(1);
    });
  });

  describe('getErrors', () => {
    it('should return only error entries', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.log(LogLevel.INFO, 'Info message');
      logger.logError('Error 1', new Error('Test error 1'));
      logger.logError('Error 2', new Error('Test error 2'));
      
      const errors = logger.getErrors();
      
      expect(errors.length).toBe(2);
      expect(errors[0].message).toBe('Error 1');
      expect(errors[1].message).toBe('Error 2');
    });
  });

  describe('getStatistics', () => {
    it('should return log statistics', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.log(LogLevel.INFO, 'Info 1');
      logger.log(LogLevel.INFO, 'Info 2');
      logger.log(LogLevel.ERROR, 'Error 1');
      logger.log(LogLevel.WARN, 'Warning 1');
      logger.log(LogLevel.DEBUG, 'Debug 1');
      
      const stats = logger.getStatistics();
      
      expect(stats.totalEntries).toBe(6); // init + 5 messages
      expect(stats.infoCount).toBe(3); // init + 2 info
      expect(stats.errorCount).toBe(1);
      expect(stats.warningCount).toBe(1);
      expect(stats.debugCount).toBe(1);
      expect(stats.estimatedSize).toBeGreaterThan(0);
    });
  });

  describe('close', () => {
    it('should flush logs and stop auto-flush timer', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId, {
        flushInterval: 5000,
      });
      await logger.initialize();
      
      logger.log(LogLevel.INFO, 'Test message');
      
      await logger.close();
      
      expect(fs.writeFile).toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should not close twice', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      await logger.close();
      await logger.close();
      
      // Should only flush once
      const writeFileCalls = (fs.writeFile as jest.Mock).mock.calls.filter(
        call => call[0].includes('execution-result-456')
      );
      expect(writeFileCalls.length).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should delete log file', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      await logger.cleanup();
      
      expect(fs.unlink).toHaveBeenCalledWith(logger.getLogFilePath());
    });

    it('should handle cleanup errors gracefully', async () => {
      (fs.unlink as jest.Mock).mockRejectedValueOnce(new Error('File not found'));
      
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await logger.cleanup();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to cleanup log file:',
        expect.any(Error)
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('createExecutionLogger', () => {
    it('should create and initialize logger', async () => {
      const logger = await createExecutionLogger(mockTestId, mockResultId);
      
      expect(logger).toBeInstanceOf(ExecutionLogger);
      expect(fs.mkdir).toHaveBeenCalled();
      
      const log = logger.getExecutionLog();
      expect(log.entries[0].message).toBe('Execution logger initialized');
    });

    it('should create logger with custom options', async () => {
      const logger = await createExecutionLogger(mockTestId, mockResultId, {
        tmpDir: '/custom/tmp',
        maxLogSize: 1024 * 1024,
      });
      
      expect(logger.getLogFilePath()).toContain('logs');
      expect(logger.getLogFilePath()).toContain('execution-result-456');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete test execution flow', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      // Start execution
      logger.logExecutionStart(3, { environment: 'DEV' });
      
      // Step 1
      logger.logStepStart(1, 'navigate', { url: 'https://example.com' });
      jest.advanceTimersByTime(1000);
      logger.logStepComplete(1, 'navigate', 1000);
      
      // Step 2
      logger.logStepStart(2, 'click', { selector: '#button' });
      jest.advanceTimersByTime(500);
      logger.logStepComplete(2, 'click', 500);
      
      // Step 3 - failure
      logger.logStepStart(3, 'assert', { selector: '.result' });
      jest.advanceTimersByTime(200);
      const error = new Error('Element not visible');
      logger.logStepFailure(3, 'assert', error);
      
      // Complete execution
      jest.advanceTimersByTime(300);
      logger.logExecutionComplete('FAIL', { failedStep: 3 });
      
      await logger.close();
      
      const log = logger.getExecutionLog();
      
      // Verify metadata
      expect(log.metadata.status).toBe('FAIL');
      expect(log.metadata.totalSteps).toBe(3);
      expect(log.metadata.completedSteps).toBe(2);
      expect(log.metadata.totalDuration).toBe(2000);
      
      // Verify entries
      const errorEntries = logger.getErrors();
      expect(errorEntries.length).toBe(1);
      expect(errorEntries[0].stepNumber).toBe(3);
      
      // Verify statistics
      const stats = logger.getStatistics();
      expect(stats.errorCount).toBe(1);
      expect(stats.totalEntries).toBeGreaterThan(5);
    });

    it('should handle successful test execution', async () => {
      const logger = new ExecutionLogger(mockTestId, mockResultId);
      await logger.initialize();
      
      logger.logExecutionStart(2);
      
      logger.logStepStart(1, 'navigate');
      logger.logStepComplete(1, 'navigate', 1000);
      
      logger.logStepStart(2, 'assert');
      logger.logStepComplete(2, 'assert', 500);
      
      logger.logExecutionComplete('PASS');
      
      await logger.close();
      
      const log = logger.getExecutionLog();
      expect(log.metadata.status).toBe('PASS');
      expect(log.metadata.completedSteps).toBe(2);
      expect(logger.getErrors().length).toBe(0);
    });
  });
});
