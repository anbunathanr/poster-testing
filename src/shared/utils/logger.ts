// Structured logging utility for CloudWatch

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private context: Record<string, any> = {};

  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...data },
    };

    if (error) {
      entry.error = error;
    }

    console.log(JSON.stringify(entry));
  }

  debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, data, error);
  }
}

export const logger = new Logger();
