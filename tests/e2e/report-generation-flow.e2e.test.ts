/**
 * End-to-End Test: Report Generation Flow
 * Tests the complete report generation workflow from test result to report retrieval
 */

import { handler as reportHandler } from '../../src/lambdas/report/index';
import { handler as storageHandler } from '../../src/lambdas/storage/index';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { createUser } from '../../src/shared/database/userOperations';
import { createTest } from '../../src/shared/database/testOperations';
import { createTestResult } from '../../src/shared/database/testResultOperations';
import { hashPassword } from '../../src/shared/utils/passwordHash';

describe('E2E: Report Generation Flow', () => {
  const testTenantId = uuidv4();
  const testUserId = uuidv4();
  const testEmail = `test-${uuidv4()}@example.com`;
  let testId: string;
  let resultId: string;

  beforeAll(async () => {
    // Create test user
    const passwordHash = await hashPassword('TestPassword123!');
    await createUser({
      email: testEmail,
      passwordHash,
      tenantId: testTenantId,
    });

    // Create test
    const test = await createTest({
      tenantId: testTenantId,
      userId: testUserId,
      testPrompt: 'Test login functionality',
      testScript: {
        steps: [
          { action: 'navigate', url: 'https://example.com/login' },
          { action: 'fill', selector: '#email', value: 'test@example.com' },
          { action: 'click', selector: '#login-button' },
        ],
      },
      environment: 'DEV',
    });
    testId = test.testId;

    // Create test result
    const result = await createTestResult({
      testId,
      tenantId: testTenantId,
      userId: testUserId,
      status: 'PASS',
      startTime: Date.now() - 45000,
      endTime: Date.now(),
      duration: 45000,
      screenshotsS3Keys: ['screenshot1.png', 'screenshot2.png'],
      logsS3Key: 'execution.log',
      executionLog: {
        steps: [],
        summary: 'Test passed',
      },
    });
    resultId = result.resultId;
  });

  it('should generate complete test report', async () => {
    // Step 1: Request report
    const reportEvent: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: `/reports/${resultId}`,
      body: null,
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: {
        resultId,
      },
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        authorizer: {
          userId: testUserId,
          tenantId: testTenantId,
          email: testEmail,
        },
      } as any,
      resource: '',
    };

    const reportResponse = await reportHandler(reportEvent);
    expect(reportResponse.statusCode).toBe(200);
    
    const reportBody = JSON.parse(reportResponse.body);
    
    // Verify report structure
    expect(reportBody.resultId).toBe(resultId);
    expect(reportBody.testId).toBe(testId);
    expect(reportBody.status).toBe('PASS');
    expect(reportBody.executionDetails).toBeDefined();
    expect(reportBody.executionDetails.duration).toBe(45000);
    expect(reportBody.evidence).toBeDefined();
    expect(reportBody.evidence.screenshots).toHaveLength(2);
    expect(reportBody.evidence.logs).toBeDefined();
    expect(reportBody.testScript).toBeDefined();
    expect(reportBody.testScript.steps).toHaveLength(3);
  });

  it('should list test results with filtering', async () => {
    // Step 1: Request test results list
    const listEvent: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: '/tests/results',
      body: null,
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: {
        status: 'PASS',
        limit: '10',
      },
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        authorizer: {
          userId: testUserId,
          tenantId: testTenantId,
          email: testEmail,
        },
      } as any,
      resource: '',
    };

    const listResponse = await storageHandler(listEvent);
    expect(listResponse.statusCode).toBe(200);
    
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.results).toBeDefined();
    expect(Array.isArray(listBody.results)).toBe(true);
    
    // Verify our test result is in the list
    const ourResult = listBody.results.find((r: any) => r.resultId === resultId);
    expect(ourResult).toBeDefined();
    expect(ourResult.status).toBe('PASS');
    expect(ourResult.testId).toBe(testId);
  });

  it('should reject report request for non-existent result', async () => {
    const reportEvent: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: '/reports/non-existent-result-id',
      body: null,
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: {
        resultId: 'non-existent-result-id',
      },
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        authorizer: {
          userId: testUserId,
          tenantId: testTenantId,
          email: testEmail,
        },
      } as any,
      resource: '',
    };

    const reportResponse = await reportHandler(reportEvent);
    expect(reportResponse.statusCode).toBe(404);
    
    const reportBody = JSON.parse(reportResponse.body);
    expect(reportBody.error).toBeDefined();
  });

  it('should enforce tenant isolation in report access', async () => {
    const otherTenantId = uuidv4();
    
    const reportEvent: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: `/reports/${resultId}`,
      body: null,
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: {
        resultId,
      },
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        authorizer: {
          userId: uuidv4(),
          tenantId: otherTenantId,
          email: 'other@example.com',
        },
      } as any,
      resource: '',
    };

    const reportResponse = await reportHandler(reportEvent);
    expect(reportResponse.statusCode).toBe(404);
  });
});
