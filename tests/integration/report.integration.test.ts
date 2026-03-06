/**
 * Integration tests for Report Lambda
 * Tests the complete report generation flow with mocked dependencies
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

const mockGetTestResult = testResultOperations.getTestResult as jest.MockedFunction<
  typeof testResultOperations.getTestResult
>;
const mockGetTest = testOperations.getTest as jest.MockedFunction<typeof testOperations.getTest>;
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('Report Lambda Integration', () => {
  const mockTenantId = 'tenant-integration';
  const mockUserId = 'user-integration';
  const mockResultId = 'result-integration';
  const mockTestId = 'test-integration';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EVIDENCE_BUCKET = 'test-evidence-bucket';
  });

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

  describe('End-to-End Report Generation Flow', () => {
    it('should complete full report generation with presigned URLs', async () => {
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
          `${mockTenantId}/screenshots/${mockResultId}/step-3.png`,
        ],
        logsS3Key: `${mockTenantId}/logs/${mockResultId}/execution-log.json`,
        executionLog: {
          steps: [
            { step: 1, action: 'navigate', status: 'success' },
            { step: 2, action: 'click', status: 'success' },
            { step: 3, action: 'assert', status: 'success' },
          ],
        },
      };

      const mockTest = {
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        testPrompt: 'Test login functionality with valid credentials',
        testScript: {
          steps: [
            { action: 'navigate' as const, url: 'https://example.com/login' },
            { action: 'fill' as const, selector: '#email', value: 'test@example.com' },
            { action: 'fill' as const, selector: '#password', value: 'password123' },
            { action: 'click' as const, selector: 'button[type="submit"]' },
            { action: 'waitForNavigation' as const },
            { action: 'assert' as const, selector: '.dashboard', condition: 'visible' },
          ],
        },
        environment: 'DEV' as const,
        createdAt: 1707753500000,
        status: 'COMPLETED' as const,
      };

      mockGetTestResult.mockResolvedValue(mockTestResult);
      mockGetTest.mockResolvedValue(mockTest);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com/file?expires=3600');

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify report structure
      expect(body.reportId).toBe(`report-${mockResultId}`);
      expect(body.testId).toBe(mockTestId);
      expect(body.resultId).toBe(mockResultId);
      expect(body.status).toBe('PASS');

      // Verify execution details
      expect(body.executionDetails).toEqual({
        duration: 45000,
        startTime: 1707753600000,
        endTime: 1707753645000,
        environment: 'DEV',
      });

      // Verify evidence URLs
      expect(body.evidence.screenshots).toHaveLength(3);
      expect(body.evidence.screenshots[0]).toContain('presigned-url.example.com');
      expect(body.evidence.logs).toContain('presigned-url.example.com');

      // Verify test script is included
      expect(body.testScript).toEqual(mockTest.testScript);

      // Verify metadata
      expect(body.metadata.userId).toBe(mockUserId);
      expect(body.metadata.testPrompt).toBe('Test login functionality with valid credentials');
      expect(body.metadata.createdAt).toBe(1707753500000);

      // Verify execution log
      expect(body.executionLog).toEqual(mockTestResult.executionLog);

      // Verify all dependencies were called correctly
      expect(mockGetTestResult).toHaveBeenCalledWith(mockTenantId, mockResultId);
      expect(mockGetTest).toHaveBeenCalledWith(mockTenantId, mockTestId);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(4); // 3 screenshots + 1 log
    });

    it('should handle FAIL status with error message', async () => {
      const mockTestResult = {
        resultId: mockResultId,
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        status: 'FAIL' as const,
        startTime: 1707753600000,
        endTime: 1707753630000,
        duration: 30000,
        screenshotsS3Keys: [
          `${mockTenantId}/screenshots/${mockResultId}/step-1.png`,
          `${mockTenantId}/screenshots/${mockResultId}/failure.png`,
        ],
        logsS3Key: `${mockTenantId}/logs/${mockResultId}/execution-log.json`,
        errorMessage: 'Element not found: .dashboard',
        executionLog: {
          steps: [
            { step: 1, action: 'navigate', status: 'success' },
            { step: 2, action: 'assert', status: 'failed', error: 'Element not found' },
          ],
        },
      };

      const mockTest = {
        testId: mockTestId,
        tenantId: mockTenantId,
        userId: mockUserId,
        testPrompt: 'Test dashboard visibility',
        testScript: { steps: [] },
        environment: 'STAGING' as const,
        createdAt: 1707753500000,
        status: 'COMPLETED' as const,
      };

      mockGetTestResult.mockResolvedValue(mockTestResult);
      mockGetTest.mockResolvedValue(mockTest);
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com/file');

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.status).toBe('FAIL');
      expect(body.errorMessage).toBe('Element not found: .dashboard');
      expect(body.executionDetails.duration).toBe(30000);
      expect(body.evidence.screenshots).toHaveLength(2);
    });

    it('should handle tenant isolation correctly', async () => {
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

      mockGetTestResult.mockResolvedValue(mockTestResult);

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden: Access denied');

      // Should not attempt to fetch test or generate URLs
      expect(mockGetTest).not.toHaveBeenCalled();
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('should handle missing test result gracefully', async () => {
      mockGetTestResult.mockResolvedValue(null);

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Test result not found');

      expect(mockGetTest).not.toHaveBeenCalled();
    });

    it('should handle missing test gracefully', async () => {
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

      mockGetTestResult.mockResolvedValue(mockTestResult);
      mockGetTest.mockResolvedValue(null);

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Test not found');
    });

    it('should continue report generation even if some presigned URLs fail', async () => {
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

      mockGetTestResult.mockResolvedValue(mockTestResult);
      mockGetTest.mockResolvedValue(mockTest);
      
      // First screenshot succeeds, second fails, log succeeds
      mockGetSignedUrl
        .mockResolvedValueOnce('https://presigned-url.example.com/screenshot-1')
        .mockRejectedValueOnce(new Error('S3 error'))
        .mockResolvedValueOnce('https://presigned-url.example.com/log');

      const event = createMockEvent(mockResultId);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Should have only 1 screenshot URL (the successful one)
      expect(body.evidence.screenshots).toHaveLength(1);
      expect(body.evidence.screenshots[0]).toBe('https://presigned-url.example.com/screenshot-1');
      expect(body.evidence.logs).toBe('https://presigned-url.example.com/log');
    });
  });
});
