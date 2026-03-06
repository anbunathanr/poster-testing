/**
 * Unit tests for S3 Upload Utilities with Retry Logic
 */

import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import {
  uploadFileToS3,
  uploadScreenshotsToS3,
  uploadLogToS3,
  uploadContentToS3,
} from '../../src/shared/utils/s3Upload';

// Mock AWS SDK clients
const s3Mock = mockClient(S3Client);

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

describe('S3 Upload Utilities with Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    s3Mock.reset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('uploadFileToS3', () => {
    it('should upload file successfully on first attempt', async () => {
      const mockFileContent = Buffer.from('test content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await uploadFileToS3('/tmp/test.png', 'tenant-123/screenshots/test.png', 'image/png');

      expect(result).toBe('tenant-123/screenshots/test.png');
      expect(s3Mock.calls()).toHaveLength(1);
    });

    it('should retry on transient error and succeed', async () => {
      const mockFileContent = Buffer.from('test content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      
      // First call fails with transient error, second succeeds
      const error = new Error('Request timeout') as any;
      error.code = 'RequestTimeout';
      
      s3Mock
        .on(PutObjectCommand)
        .rejectsOnce(error)
        .resolvesOnce({});

      const uploadPromise = uploadFileToS3('/tmp/test.png', 'tenant-123/screenshots/test.png', 'image/png');
      
      // Fast-forward through the retry delay
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await uploadPromise;

      expect(result).toBe('tenant-123/screenshots/test.png');
      expect(s3Mock.calls()).toHaveLength(2);
    });

    it('should retry with exponential backoff', async () => {
      const mockFileContent = Buffer.from('test content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      
      // Fail twice, then succeed
      const error1 = new Error('Service unavailable') as any;
      error1.code = 'ServiceUnavailable';
      const error2 = new Error('Throttling') as any;
      error2.code = 'ThrottlingException';
      
      s3Mock
        .on(PutObjectCommand)
        .rejectsOnce(error1)
        .rejectsOnce(error2)
        .resolvesOnce({});

      const uploadPromise = uploadFileToS3('/tmp/test.png', 'tenant-123/screenshots/test.png', 'image/png');
      
      // First retry after 1 second
      await jest.advanceTimersByTimeAsync(1000);
      // Second retry after 2 seconds
      await jest.advanceTimersByTimeAsync(2000);
      
      const result = await uploadPromise;

      expect(result).toBe('tenant-123/screenshots/test.png');
      expect(s3Mock.calls()).toHaveLength(3);
    });

    it('should fail after max retry attempts', async () => {
      const mockFileContent = Buffer.from('test content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      
      // Fail all attempts
      const error = new Error('Request timeout') as any;
      error.code = 'RequestTimeout';
      s3Mock.on(PutObjectCommand).rejects(error);

      // Use real timers for this test to avoid complexity
      jest.useRealTimers();
      
      await expect(uploadFileToS3('/tmp/test.png', 'tenant-123/screenshots/test.png', 'image/png'))
        .rejects.toThrow('S3 upload failed');
      
      expect(s3Mock.calls()).toHaveLength(3);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });

    it('should not retry on non-transient errors', async () => {
      const mockFileContent = Buffer.from('test content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      
      // Fail with non-transient error
      const error = new Error('Access denied') as any;
      error.code = 'AccessDenied';
      s3Mock.on(PutObjectCommand).rejects(error);

      await expect(uploadFileToS3('/tmp/test.png', 'tenant-123/screenshots/test.png', 'image/png'))
        .rejects.toThrow('S3 upload failed');
      
      // Should only attempt once
      expect(s3Mock.calls()).toHaveLength(1);
    });

    it('should handle file read errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(uploadFileToS3('/tmp/test.png', 'tenant-123/screenshots/test.png', 'image/png'))
        .rejects.toThrow('S3 upload failed');
      
      expect(s3Mock.calls()).toHaveLength(0);
    });
  });

  describe('uploadContentToS3', () => {
    it('should upload content successfully on first attempt', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await uploadContentToS3(
        'test content',
        'tenant-123/logs/result-123/log.json',
        'application/json'
      );

      expect(result).toBe('tenant-123/logs/result-123/log.json');
      expect(s3Mock.calls()).toHaveLength(1);
    });

    it('should retry on transient error and succeed', async () => {
      const error = new Error('Slow down') as any;
      error.code = 'SlowDown';
      
      s3Mock
        .on(PutObjectCommand)
        .rejectsOnce(error)
        .resolvesOnce({});

      const uploadPromise = uploadContentToS3(
        Buffer.from('test content'),
        'tenant-123/logs/result-123/log.json',
        'application/json'
      );
      
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await uploadPromise;

      expect(result).toBe('tenant-123/logs/result-123/log.json');
      expect(s3Mock.calls()).toHaveLength(2);
    });

    it('should handle network errors with retry', async () => {
      const error = new Error('Connection reset') as any;
      error.code = 'ECONNRESET';
      
      s3Mock
        .on(PutObjectCommand)
        .rejectsOnce(error)
        .resolvesOnce({});

      const uploadPromise = uploadContentToS3(
        'test content',
        'tenant-123/logs/result-123/log.json',
        'application/json'
      );
      
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await uploadPromise;

      expect(result).toBe('tenant-123/logs/result-123/log.json');
      expect(s3Mock.calls()).toHaveLength(2);
    });
  });

  describe('uploadScreenshotsToS3', () => {
    it('should upload multiple screenshots successfully', async () => {
      const mockFileContent = Buffer.from('screenshot content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await uploadScreenshotsToS3(
        ['/tmp/step-1.png', '/tmp/step-2.png'],
        'tenant-123',
        'result-123'
      );

      expect(result).toEqual([
        'tenant-123/screenshots/result-123/step-1.png',
        'tenant-123/screenshots/result-123/step-2.png',
      ]);
      expect(s3Mock.calls()).toHaveLength(2);
    });

    it('should retry failed screenshot uploads', async () => {
      const mockFileContent = Buffer.from('screenshot content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      
      // First screenshot succeeds, second fails then succeeds
      const error = new Error('Timeout') as any;
      error.code = 'RequestTimeout';
      
      s3Mock
        .on(PutObjectCommand)
        .resolvesOnce({})
        .rejectsOnce(error)
        .resolvesOnce({});

      const uploadPromise = uploadScreenshotsToS3(
        ['/tmp/step-1.png', '/tmp/step-2.png'],
        'tenant-123',
        'result-123'
      );
      
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await uploadPromise;

      expect(result).toHaveLength(2);
      expect(s3Mock.calls()).toHaveLength(3);
    });
  });

  describe('uploadLogToS3', () => {
    it('should upload log file successfully', async () => {
      const mockFileContent = Buffer.from('log content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await uploadLogToS3(
        '/tmp/execution-log.json',
        'tenant-123',
        'result-123'
      );

      expect(result).toBe('tenant-123/logs/result-123/execution-log.json');
      expect(s3Mock.calls()).toHaveLength(1);
    });

    it('should retry failed log uploads', async () => {
      const mockFileContent = Buffer.from('log content');
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      
      const error = new Error('Service unavailable') as any;
      error.code = 'ServiceUnavailable';
      
      s3Mock
        .on(PutObjectCommand)
        .rejectsOnce(error)
        .resolvesOnce({});

      const uploadPromise = uploadLogToS3(
        '/tmp/execution-log.json',
        'tenant-123',
        'result-123'
      );
      
      await jest.advanceTimersByTimeAsync(1000);
      
      const result = await uploadPromise;

      expect(result).toBe('tenant-123/logs/result-123/execution-log.json');
      expect(s3Mock.calls()).toHaveLength(2);
    });
  });

  describe('Transient error detection', () => {
    it('should identify common transient errors', async () => {
      const transientErrorCodes = [
        'RequestTimeout',
        'ServiceUnavailable',
        'ThrottlingException',
        'TooManyRequestsException',
        'SlowDown',
        'ECONNRESET',
        'ETIMEDOUT',
      ];

      for (const code of transientErrorCodes) {
        s3Mock.reset();
        
        const error = new Error(`Test error: ${code}`) as any;
        error.code = code;
        
        s3Mock
          .on(PutObjectCommand)
          .rejectsOnce(error)
          .resolvesOnce({});

        const uploadPromise = uploadContentToS3(
          'test',
          'tenant-123/test.txt',
          'text/plain'
        );
        
        await jest.advanceTimersByTimeAsync(1000);
        
        await expect(uploadPromise).resolves.toBeDefined();
        expect(s3Mock.calls()).toHaveLength(2);
      }
    });
  });
});
