/**
 * Unit tests for Storage Lambda
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambdas/storage';
import * as testResultOperations from '../../src/shared/database/testResultOperations';
import * as s3Upload from '../../src/shared/utils/s3Upload';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Mock AWS SDK clients
const s3Mock = mockClient(S3Client);

// Mock dependencies
jest.mock('../../src/shared/database/testResultOperations');
jest.mock('../../src/shared/utils/s3Upload');
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned-url.example.com'),
}));

describe('Storage Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    s3Mock.reset();
  });

  const createMockEvent = (
    path: string,
    method: string,
    body?: any,
    queryStringParameters?: Record<string, string>
  ): APIGatewayProxyEvent => ({
    path,
    httpMethod: method,
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: queryStringParameters || null,
    requestContext: {
      authorizer: {
        tenantId: 'tenant-123',
        userId: 'user-456',
      },
    } as any,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
  } as APIGatewayProxyEvent);

  describe('POST /storage/results', () => {
    it('should create a test result successfully', async () => {
      const mockTestResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: ['tenant-123/screenshots/result-123/step-1.png'],
        logsS3Key: 'tenant-123/logs/result-123/execution-log.json',
        executionLog: { steps: [] },
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const event = createMockEvent('/storage/results', 'POST', {
        testId: 'test-123',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: ['tenant-123/screenshots/result-123/step-1.png'],
        logsS3Key: 'tenant-123/logs/result-123/execution-log.json',
        executionLog: { steps: [] },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual(mockTestResult);
      expect(testResultOperations.createTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          testId: 'test-123',
          tenantId: 'tenant-123',
          userId: 'user-456',
          status: 'PASS',
        })
      );
    });

    it('should return 400 if request body is missing', async () => {
      const event = createMockEvent('/storage/results', 'POST');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Request body is required' });
    });

    it('should return 400 if testId is missing', async () => {
      const event = createMockEvent('/storage/results', 'POST', {
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'testId is required' });
    });

    it('should return 400 if status is invalid', async () => {
      const event = createMockEvent('/storage/results', 'POST', {
        testId: 'test-123',
        status: 'INVALID',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'status must be PASS or FAIL' });
    });

    it('should enforce tenant isolation by overriding tenantId from JWT', async () => {
      const mockTestResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      };

      (testResultOperations.createTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const event = createMockEvent('/storage/results', 'POST', {
        testId: 'test-123',
        tenantId: 'malicious-tenant',
        userId: 'malicious-user',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      expect(testResultOperations.createTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          userId: 'user-456',
        })
      );
    });
  });

  describe('GET /storage/results/{resultId}', () => {
    it('should retrieve a test result with presigned URLs', async () => {
      const mockTestResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: ['tenant-123/screenshots/result-123/step-1.png'],
        logsS3Key: 'tenant-123/logs/result-123/execution-log.json',
        executionLog: { steps: [] },
      };

      (testResultOperations.getTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const event = createMockEvent('/storage/results/result-123', 'GET');

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.resultId).toBe('result-123');
      expect(body.screenshotUrls).toHaveLength(1);
      expect(body.logUrl).toBe('https://presigned-url.example.com');
      expect(testResultOperations.getTestResult).toHaveBeenCalledWith('tenant-123', 'result-123');
    });

    it('should return 404 if test result not found', async () => {
      (testResultOperations.getTestResult as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent('/storage/results/result-123', 'GET');

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({ error: 'Test result not found' });
    });
  });

  describe('PUT /storage/results/{resultId}', () => {
    it('should update test result status successfully', async () => {
      const mockUpdatedResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: ['screenshot1.png'],
        logsS3Key: 'log.json',
        executionLog: { steps: [] },
      };

      (testResultOperations.updateTestResult as jest.Mock).mockResolvedValue(mockUpdatedResult);

      const event = createMockEvent('/storage/results/result-123', 'PUT', {
        status: 'PASS',
        endTime: 1707753645000,
        duration: 45000,
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(mockUpdatedResult);
      expect(testResultOperations.updateTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          resultId: 'result-123',
          status: 'PASS',
          endTime: 1707753645000,
          duration: 45000,
        })
      );
    });

    it('should update multiple fields at once', async () => {
      const mockUpdatedResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'FAIL' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: ['screenshot1.png', 'screenshot2.png'],
        logsS3Key: 'log.json',
        errorMessage: 'Test failed',
        executionLog: { steps: [] },
      };

      (testResultOperations.updateTestResult as jest.Mock).mockResolvedValue(mockUpdatedResult);

      const event = createMockEvent('/storage/results/result-123', 'PUT', {
        status: 'FAIL',
        endTime: 1707753645000,
        duration: 45000,
        errorMessage: 'Test failed',
        screenshotsS3Keys: ['screenshot1.png', 'screenshot2.png'],
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toBe('Test failed');
      expect(body.screenshotsS3Keys).toHaveLength(2);
    });

    it('should return 400 if request body is missing', async () => {
      const event = createMockEvent('/storage/results/result-123', 'PUT');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Request body is required' });
    });

    it('should return 400 if status is invalid', async () => {
      const event = createMockEvent('/storage/results/result-123', 'PUT', {
        status: 'INVALID',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'status must be PASS, FAIL, or EXECUTING',
      });
    });

    it('should return 404 if test result not found', async () => {
      (testResultOperations.updateTestResult as jest.Mock).mockRejectedValue(
        new Error('Test result not found')
      );

      const event = createMockEvent('/storage/results/result-123', 'PUT', {
        status: 'PASS',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({ error: 'Test result not found' });
    });

    it('should enforce tenant isolation', async () => {
      const mockUpdatedResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      };

      (testResultOperations.updateTestResult as jest.Mock).mockResolvedValue(mockUpdatedResult);

      const event = createMockEvent('/storage/results/result-123', 'PUT', {
        tenantId: 'malicious-tenant', // Try to override tenantId
        status: 'PASS',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // Verify that tenantId from JWT was used, not from request body
      expect(testResultOperations.updateTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123', // Should use JWT tenantId
          resultId: 'result-123',
        })
      );
    });

    it('should return 400 for invalid JSON', async () => {
      const event = {
        ...createMockEvent('/storage/results/result-123', 'PUT'),
        body: 'invalid json',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Invalid JSON in request body' });
    });

    it('should handle DynamoDB errors gracefully', async () => {
      (testResultOperations.updateTestResult as jest.Mock).mockRejectedValue(
        new Error('DynamoDB error')
      );

      const event = createMockEvent('/storage/results/result-123', 'PUT', {
        status: 'PASS',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toEqual({ error: 'Failed to update test result' });
    });
  });

  describe('POST /storage/upload/screenshots', () => {
    it('should upload screenshots successfully', async () => {
      const mockS3Keys = [
        'tenant-123/screenshots/result-123/step-1.png',
        'tenant-123/screenshots/result-123/step-2.png',
      ];

      (s3Upload.uploadScreenshotsToS3 as jest.Mock).mockResolvedValue(mockS3Keys);

      const event = createMockEvent('/storage/upload/screenshots', 'POST', {
        screenshotPaths: ['/tmp/step-1.png', '/tmp/step-2.png'],
        resultId: 'result-123',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.s3Keys).toEqual(mockS3Keys);
      expect(body.message).toBe('Successfully uploaded 2 screenshots');
      expect(s3Upload.uploadScreenshotsToS3).toHaveBeenCalledWith(
        ['/tmp/step-1.png', '/tmp/step-2.png'],
        'tenant-123',
        'result-123'
      );
    });

    it('should return 400 if screenshotPaths is not an array', async () => {
      const event = createMockEvent('/storage/upload/screenshots', 'POST', {
        screenshotPaths: 'not-an-array',
        resultId: 'result-123',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'screenshotPaths must be a non-empty array',
      });
    });

    it('should return 400 if resultId is missing', async () => {
      const event = createMockEvent('/storage/upload/screenshots', 'POST', {
        screenshotPaths: ['/tmp/step-1.png'],
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'resultId is required' });
    });
  });

  describe('POST /storage/upload/log', () => {
    it('should upload log from file path', async () => {
      const mockS3Key = 'tenant-123/logs/result-123/execution-log.json';

      (s3Upload.uploadLogToS3 as jest.Mock).mockResolvedValue(mockS3Key);

      const event = createMockEvent('/storage/upload/log', 'POST', {
        logFilePath: '/tmp/execution-log.json',
        resultId: 'result-123',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.s3Key).toBe(mockS3Key);
      expect(body.message).toBe('Successfully uploaded execution log');
      expect(s3Upload.uploadLogToS3).toHaveBeenCalledWith(
        '/tmp/execution-log.json',
        'tenant-123',
        'result-123'
      );
    });

    it('should upload log from content', async () => {
      (s3Upload.uploadContentToS3 as jest.Mock).mockResolvedValue(
        'tenant-123/logs/result-123/execution-log.json'
      );

      const event = createMockEvent('/storage/upload/log', 'POST', {
        logContent: JSON.stringify({ steps: [] }),
        resultId: 'result-123',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.s3Key).toBe('tenant-123/logs/result-123/execution-log.json');
      expect(s3Upload.uploadContentToS3).toHaveBeenCalledWith(
        JSON.stringify({ steps: [] }),
        'tenant-123/logs/result-123/execution-log.json',
        'application/json'
      );
    });

    it('should return 400 if neither logFilePath nor logContent is provided', async () => {
      const event = createMockEvent('/storage/upload/log', 'POST', {
        resultId: 'result-123',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Either logFilePath or logContent is required',
      });
    });
  });

  describe('POST /storage/presigned-url', () => {
    it('should generate presigned URL for valid tenant-owned S3 key', async () => {
      const event = createMockEvent('/storage/presigned-url', 'POST', {
        s3Key: 'tenant-123/screenshots/result-123/step-1.png',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.presignedUrl).toBe('https://presigned-url.example.com');
      expect(body.expiresIn).toBe(3600);
    });

    it('should return 403 if S3 key does not belong to tenant', async () => {
      const event = createMockEvent('/storage/presigned-url', 'POST', {
        s3Key: 'other-tenant/screenshots/result-123/step-1.png',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Tenant validation failed: S3 key does not belong to requesting tenant',
      });
    });

    it('should return 400 if s3Key is missing', async () => {
      const event = createMockEvent('/storage/presigned-url', 'POST', {});

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 's3Key is required' });
    });
  });

  describe('GET /storage/tests/{testId}/results', () => {
    it('should list test results with pagination', async () => {
      const mockResults = [
        {
          resultId: 'result-1',
          testId: 'test-123',
          tenantId: 'tenant-123',
          userId: 'user-456',
          status: 'PASS' as const,
          startTime: 1707753600000,
          endTime: 1707753645000,
          duration: 45000,
          screenshotsS3Keys: [],
          logsS3Key: 'log.json',
          executionLog: {},
        },
      ];

      (testResultOperations.listTestResultsByTest as jest.Mock).mockResolvedValue({
        results: mockResults,
        lastEvaluatedKey: { testId: 'test-123', startTime: 1707753600000 },
      });

      const event = createMockEvent('/storage/tests/test-123/results', 'GET', null, {
        limit: '10',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results).toEqual(mockResults);
      expect(body.nextToken).toBeDefined();
      expect(testResultOperations.listTestResultsByTest).toHaveBeenCalledWith(
        'test-123',
        10,
        undefined
      );
    });

    it('should use default limit if not provided', async () => {
      (testResultOperations.listTestResultsByTest as jest.Mock).mockResolvedValue({
        results: [],
        lastEvaluatedKey: undefined,
      });

      const event = createMockEvent('/storage/tests/test-123/results', 'GET');

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(testResultOperations.listTestResultsByTest).toHaveBeenCalledWith(
        'test-123',
        20,
        undefined
      );
    });
  });

  describe('Authorization', () => {
    it('should return 401 if tenantId is missing from authorizer', async () => {
      const event = {
        ...createMockEvent('/storage/results', 'POST', {}),
        requestContext: {
          authorizer: {
            userId: 'user-456',
          },
        } as any,
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Unauthorized: Missing tenant or user context',
      });
    });

    it('should return 401 if userId is missing from authorizer', async () => {
      const event = {
        ...createMockEvent('/storage/results', 'POST', {}),
        requestContext: {
          authorizer: {
            tenantId: 'tenant-123',
          },
        } as any,
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Unauthorized: Missing tenant or user context',
      });
    });
  });

  describe('Route handling', () => {
    it('should return 404 for unknown routes', async () => {
      const event = createMockEvent('/storage/unknown', 'GET');

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({ error: 'Route not found' });
    });
  });
});
