/**
 * Unit tests for Report Lambda
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambdas/report';
import * as testResultOperations from '../../src/shared/database/testResultOperations';
import * as testOperations from '../../src/shared/database/testOperations';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock dependencies
jest.mock('../../src/shared/database/testResultOperations');
jest.mock('../../src/shared/database/testOperations');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('Report Lambda', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';
  const mockResultId = 'result-789';
  const mockTestId = 'test-abc';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EVIDENCE_BUCKET = 'test-bucket';
  });

  describe('GET /reports/{resultId}', () => {
    const createMockEvent = (resultId: string): APIGatewayProxyEvent => ({
      httpMethod: 'GET',
      path: `/reports/${resultId}`,
      pathParameters: { resultId },
      headers: {},
      body: null,
      isBase64Encoded: false,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-id',
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: `/reports/${resultId}`,
        stage: 'test',
        requestId: 'request-id',
        requestTimeEpoch: Date.now(),
        resourceId: 'resource-id',
        resourcePath: '/reports/{resultId}',
        identity: {
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        } as any,
        authorizer: {
          tenantId: mockTenantId,
          userId: mockUserId,
        },
      } as any,
      resource: '/reports/{resultId}',
      multiValueHeaders: {},
    });

    it('should generate a report successfully', async () => {
      const mockTestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [
          `${mockTenantId}/screenshots/${mockResultId}/step-1.png`,
          `${mockTenantId}/screenshots/${mockResultId}/step-2.png`,
        ],
        logsS3Key: `${mockTenantId}/logs/${mockResultId}/execution-log.json`,
        executionLog: { steps: [] },
      };

      const mockTest = {
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        testPrompt: 'Test login functionality',
        testScript: {
          steps: [
            { action: 'navigate', url: 'https://example.com' },
            { action: 'click', selector: '#login' },
          ],
        },
        environment: 'DEV' as const,
        createdAt: 1707753500000,
        status: 'COMPLETED' as const,
      };

      (testResultOperations.getTestResult as jest.Mock).mockResolvedValue(mockTestResult);
      (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
      (getSignedUrl as jest.Mock).mockResolvedValue('https://presigned-url.example.com');

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.reportId).toBe(`report-${mockResultId}`);
      expect(body.testId).toBe(mockTestId);
      expect(body.resultId).toBe(mockResultId);
      expect(body.status).toBe('PASS');
      expect(body.executionDetails.duration).toBe(45000);
      expect(body.executionDetails.environment).toBe('DEV');
      expect(body.evidence.screenshots).toHaveLength(2);
      expect(body.evidence.logs).toBe('https://presigned-url.example.com');
      expect(body.testScript).toEqual(mockTest.testScript);
      expect(body.metadata.testPrompt).toBe('Test login functionality');

      expect(testResultOperations.getTestResult).toHaveBeenCalledWith(mockTenantId, mockResultId);
      expect(testOperations.getTest).toHaveBeenCalledWith(mockTenantId, mockTestId);
      expect(getSignedUrl).toHaveBeenCalledTimes(3); // 2 screenshots + 1 log
    });

    it('should return 404 if test result not found', async () => {
      (testResultOperations.getTestResult as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Test result not found');
    });

    it('should return 404 if test not found', async () => {
      const mockTestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: '',
        executionLog: {},
      };

      (testResultOperations.getTestResult as jest.Mock).mockResolvedValue(mockTestResult);
      (testOperations.getTest as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Test not found');
    });

    it('should return 403 if tenant mismatch', async () => {
      const mockTestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: 'different-tenant',
        userId: mockUserId,
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: '',
        executionLog: {},
      };

      (testResultOperations.getTestResult as jest.Mock).mockResolvedValue(mockTestResult);

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden: Access denied');
    });

    it('should handle presigned URL generation errors gracefully', async () => {
      const mockTestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'PASS' as const,
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [`${mockTenantId}/screenshots/${mockResultId}/step-1.png`],
        logsS3Key: `${mockTenantId}/logs/${mockResultId}/execution-log.json`,
        executionLog: {},
      };

      const mockTest = {
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        testPrompt: 'Test',
        testScript: { steps: [] },
        environment: 'DEV' as const,
        createdAt: 1707753500000,
        status: 'COMPLETED' as const,
      };

      (testResultOperations.getTestResult as jest.Mock).mockResolvedValue(mockTestResult);
      (testOperations.getTest as jest.Mock).mockResolvedValue(mockTest);
      (getSignedUrl as jest.Mock).mockRejectedValue(new Error('S3 error'));

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should still return report even if presigned URLs fail
      expect(body.reportId).toBe(`report-${mockResultId}`);
      expect(body.evidence.screenshots).toHaveLength(0); // Failed to generate URLs
      expect(body.evidence.logs).toBeUndefined();
    });

    it('should return 400 if resultId is missing', async () => {
      const event = createMockEvent('');
      event.path = '/reports';

      const response = await handler(event);

      expect(response.statusCode).toBe(404); // Route not found since it doesn't match the pattern
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Route not found');
    });

    it('should return 401 if tenant context is missing', async () => {
      const event = createMockEvent(mockResultId);
      event.requestContext.authorizer = {};

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unauthorized');
    });

    it('should handle database errors', async () => {
      (testResultOperations.getTestResult as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to generate report');
    });
  });

  describe('Route handling', () => {
    it('should return 404 for unknown routes', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/unknown',
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'api-id',
          protocol: 'HTTP/1.1',
          httpMethod: 'GET',
          path: '/unknown',
          stage: 'test',
          requestId: 'request-id',
          requestTimeEpoch: Date.now(),
          resourceId: 'resource-id',
          resourcePath: '/unknown',
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
          } as any,
          authorizer: {
            tenantId: mockTenantId,
            userId: mockUserId,
          },
        } as any,
        resource: '/unknown',
        multiValueHeaders: {},
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Route not found');
    });
  });
});
