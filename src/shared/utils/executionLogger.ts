import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Log levels for execution logging
 */
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

/**
 * Log entry structure for execution events
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  stepNumber?: number;
  stepAction?: string;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Execution log metadata
 */
export interface ExecutionLogMetadata {
  testId: string;
  resultId: string;
  startTime: string;
  endTime?: string;
  totalDuration?: number;
  status?: 'RUNNING' | 'PASS' | 'FAIL';
  totalSteps?: number;
  completedSteps?: number;
}

/**
 * Complete execution log structure
 */
export interface ExecutionLog {
  metadata: ExecutionLogMetadata;
  entries: LogEntry[];
}

/**
 * Options for execution logger
 */
export interface ExecutionLoggerOptions {
  tmpDir?: string;
  maxLogSize?: number; // Maximum log size in bytes (default: 5MB)
  flushInterval?: number; // Auto-flush interval in ms (0 = disabled)
}

/**
 * Execution Logger for test execution in AWS Lambda
 *
 * Provides structured logging for test execution events with:
 * - JSON format for easy parsing
 * - Timestamps for all events
 * - Step-level tracking
 * - Error details with stack traces
 * - Storage in Lambda's /tmp directory
 * - Graceful error handling
 * - Memory-efficient buffering
 */
export class ExecutionLogger {
  private testId: string;
  private resultId: string;
  private tmpDir: string;
  private logFilePath: string;
  private entries: LogEntry[] = [];
  private metadata: ExecutionLogMetadata;
  private maxLogSize: number;
  private flushInterval: number;
  private flushTimer?: NodeJS.Timeout;
  private startTime: Date;
  private isClosed: boolean = false;

  constructor(testId: string, resultId: string, options: ExecutionLoggerOptions = {}) {
    this.testId = testId;
    this.resultId = resultId;
    this.tmpDir = options.tmpDir || '/tmp';
    this.maxLogSize = options.maxLogSize || 5 * 1024 * 1024; // 5MB default
    this.flushInterval = options.flushInterval || 0;
    this.startTime = new Date();

    // Generate log file path
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-');
    const fileName = `execution-${resultId}-${timestamp}.json`;
    this.logFilePath = join(this.tmpDir, 'logs', fileName);

    // Initialize metadata
    this.metadata = {
      testId,
      resultId,
      startTime: this.startTime.toISOString(),
      status: 'RUNNING',
      totalSteps: 0,
      completedSteps: 0,
    };
  }

  /**
   * Initialize the logger (create log directory)
   */
  async initialize(): Promise<void> {
    try {
      const logDir = join(this.tmpDir, 'logs');
      await fs.mkdir(logDir, { recursive: true });

      // Log initialization
      this.log(LogLevel.INFO, 'Execution logger initialized', {
        testId: this.testId,
        resultId: this.resultId,
        logPath: this.logFilePath,
      });

      // Start auto-flush if configured
      if (this.flushInterval > 0) {
        this.flushTimer = setInterval(() => {
          this.flush().catch((error) => {
            console.error('Auto-flush failed:', error);
          });
        }, this.flushInterval);
      }
    } catch (error) {
      // Graceful degradation - log to console if file system fails
      console.error('Failed to initialize execution logger:', error);
      this.log(LogLevel.WARN, 'Logger initialization failed, using memory-only mode');
    }
  }

  /**
   * Log a message with specified level
   */
  log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (this.isClosed) {
      console.warn('Attempted to log to closed logger');
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
    };

    this.entries.push(entry);
    this.checkLogSize();
  }

  /**
   * Log step start event
   */
  logStepStart(stepNumber: number, action: string, details?: Record<string, any>): void {
    this.log(LogLevel.INFO, `Step ${stepNumber} started: ${action}`, {
      stepNumber,
      stepAction: action,
      event: 'step_start',
      ...details,
    });
  }

  /**
   * Log step completion event
   */
  logStepComplete(
    stepNumber: number,
    action: string,
    duration: number,
    details?: Record<string, any>
  ): void {
    this.log(LogLevel.INFO, `Step ${stepNumber} completed: ${action}`, {
      stepNumber,
      stepAction: action,
      duration,
      event: 'step_complete',
      ...details,
    });

    this.metadata.completedSteps = (this.metadata.completedSteps || 0) + 1;
  }

  /**
   * Log step failure event
   */
  logStepFailure(
    stepNumber: number,
    action: string,
    error: Error,
    details?: Record<string, any>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message: `Step ${stepNumber} failed: ${action}`,
      stepNumber,
      stepAction: action,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
      metadata: {
        event: 'step_failure',
        ...details,
      },
    };

    this.entries.push(entry);
    this.checkLogSize();
  }

  /**
   * Log test execution start
   */
  logExecutionStart(totalSteps: number, details?: Record<string, any>): void {
    this.metadata.totalSteps = totalSteps;
    this.log(LogLevel.INFO, 'Test execution started', {
      totalSteps,
      event: 'execution_start',
      ...details,
    });
  }

  /**
   * Log test execution completion
   */
  logExecutionComplete(status: 'PASS' | 'FAIL', details?: Record<string, any>): void {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    this.metadata.endTime = endTime.toISOString();
    this.metadata.totalDuration = duration;
    this.metadata.status = status;

    this.log(LogLevel.INFO, `Test execution completed: ${status}`, {
      status,
      duration,
      event: 'execution_complete',
      ...details,
    });
  }

  /**
   * Log an error event
   */
  logError(message: string, error: Error, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
      metadata,
    };

    this.entries.push(entry);
    this.checkLogSize();
  }

  /**
   * Log a warning event
   */
  logWarning(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log a debug event
   */
  logDebug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Check log size and flush if necessary
   */
  private checkLogSize(): void {
    const estimatedSize = JSON.stringify(this.getExecutionLog()).length;

    if (estimatedSize > this.maxLogSize * 0.9) {
      // Approaching max size, flush to disk
      this.flush().catch((error) => {
        console.error('Failed to flush logs:', error);
      });
    }
  }

  /**
   * Flush logs to disk
   */
  async flush(): Promise<void> {
    if (this.entries.length === 0) {
      return;
    }

    try {
      const log = this.getExecutionLog();
      const logJson = JSON.stringify(log, null, 2);

      await fs.writeFile(this.logFilePath, logJson, 'utf-8');
    } catch (error) {
      // Graceful degradation - log to console
      console.error('Failed to write log file:', error);
      console.log('Log entries:', this.entries.length);
    }
  }

  /**
   * Get the complete execution log
   */
  getExecutionLog(): ExecutionLog {
    return {
      metadata: { ...this.metadata },
      entries: [...this.entries],
    };
  }

  /**
   * Get log entries by level
   */
  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((entry) => entry.level === level);
  }

  /**
   * Get error entries
   */
  getErrors(): LogEntry[] {
    return this.getEntriesByLevel(LogLevel.ERROR);
  }

  /**
   * Get log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Get log statistics
   */
  getStatistics(): {
    totalEntries: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    debugCount: number;
    estimatedSize: number;
  } {
    return {
      totalEntries: this.entries.length,
      errorCount: this.getEntriesByLevel(LogLevel.ERROR).length,
      warningCount: this.getEntriesByLevel(LogLevel.WARN).length,
      infoCount: this.getEntriesByLevel(LogLevel.INFO).length,
      debugCount: this.getEntriesByLevel(LogLevel.DEBUG).length,
      estimatedSize: JSON.stringify(this.getExecutionLog()).length,
    };
  }

  /**
   * Close the logger and flush remaining logs
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    // Stop auto-flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final flush
    await this.flush();

    this.isClosed = true;
  }

  /**
   * Cleanup log files (call after uploading to S3)
   */
  async cleanup(): Promise<void> {
    try {
      await fs.unlink(this.logFilePath);
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Failed to cleanup log file:', error);
    }
  }
}

/**
 * Create and initialize an execution logger
 */
export async function createExecutionLogger(
  testId: string,
  resultId: string,
  options?: ExecutionLoggerOptions
): Promise<ExecutionLogger> {
  const logger = new ExecutionLogger(testId, resultId, options);
  await logger.initialize();
  return logger;
}
