/**
 * Report Lambda - Test report generation
 * Generates comprehensive test reports with evidence links
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getTestResult } from '../../shared/database/testResultOperations';
import { getTest } from '../../shared/database/testOperations';

// Environment variables
const EVIDENCE_BUCKET = process.env.EVIDENCE_BUCKET || 'ai-testing-platform-evidence';
const PRESIGNED_URL_EXPIRATION = 3600; // 1 hour

// Initialize S3 client lazily
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({});
  }
  return s3Client;
}

/**
 * Main Lambda handler
 * Routes requests to appropriate handlers based on HTTP method and path
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Report Lambda invoked', {
    path: event.path,
    method: event.httpMethod,
    requestId: event.requestContext.requestId,
  });

  try {
    const path = event.path;
    const method = event.httpMethod;

    // Extract tenant context from authorizer
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;

    if (!tenantId || !userId) {
      console.error('Missing tenant or user context from authorizer');
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized: Missing tenant context' }),
      };
    }

    // Route: GET /reports/{resultId}
    if (method === 'GET' && path.match(/^\/reports\/[^/]+$/)) {
      return await handleGetReport(event, tenantId, userId);
    }

    // Route not found
    console.warn('Route not found', { path, method });
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Route not found' }),
    };
  } catch (error) {
    console.error('Unhandled error in Report Lambda:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Handles GET /reports/{resultId}
 * Generates a comprehensive report for a test execution
 */
async function handleGetReport(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Extract resultId from path
    const pathParts = event.path.split('/');
    const resultId = pathParts[pathParts.length - 1];

    if (!resultId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Result ID is required' }),
      };
    }

    console.log('Generating report', { resultId, tenantId, userId });

    // Retrieve test result from DynamoDB
    const testResult = await getTestResult(tenantId, resultId);

    if (!testResult) {
      console.warn('Test result not found', { resultId, tenantId });
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Test result not found' }),
      };
    }

    // Verify the test result belongs to the requesting tenant
    if (testResult.tenantId !== tenantId) {
      console.error('Tenant mismatch', {
        resultTenant: testResult.tenantId,
        requestTenant: tenantId,
      });
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden: Access denied' }),
      };
    }

    // Retrieve test script from DynamoDB
    const test = await getTest(tenantId, testResult.testId);

    if (!test) {
      console.warn('Test not found', { testId: testResult.testId, tenantId });
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Test not found' }),
      };
    }

    // Generate presigned URLs for screenshots
    const screenshotUrls: string[] = [];
    for (const s3Key of testResult.screenshotsS3Keys) {
      try {
        const url = await generatePresignedUrl(s3Key, tenantId);
        screenshotUrls.push(url);
      } catch (error) {
        console.error('Failed to generate presigned URL for screenshot', {
          key: s3Key,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other screenshots even if one fails
      }
    }

    // Generate presigned URL for logs
    let logsUrl: string | undefined;
    if (testResult.logsS3Key) {
      try {
        logsUrl = await generatePresignedUrl(testResult.logsS3Key, tenantId);
      } catch (error) {
        console.error('Failed to generate presigned URL for logs', {
          key: testResult.logsS3Key,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Format the report
    const report = {
      reportId: `report-${resultId}`,
      testId: testResult.testId,
      resultId: testResult.resultId,
      status: testResult.status,
      executionDetails: {
        duration: testResult.duration,
        startTime: testResult.startTime,
        endTime: testResult.endTime,
        environment: test.environment,
      },
      evidence: {
        screenshots: screenshotUrls,
        logs: logsUrl,
      },
      testScript: test.testScript,
      errorMessage: testResult.errorMessage,
      executionLog: testResult.executionLog,
      metadata: {
        userId: testResult.userId,
        testPrompt: test.testPrompt,
        createdAt: test.createdAt,
      },
    };

    console.log('Report generated successfully', {
      resultId,
      screenshotCount: screenshotUrls.length,
      hasLogs: !!logsUrl,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    };
  } catch (error) {
    console.error('Error generating report:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

/**
 * Generates a presigned URL for an S3 object
 * Validates tenant ownership before generating URL
 */
async function generatePresignedUrl(s3Key: string, tenantId: string): Promise<string> {
  // Validate that the S3 key belongs to the requesting tenant
  if (!s3Key.startsWith(`${tenantId}/`)) {
    throw new Error('Tenant validation failed: S3 key does not belong to requesting tenant');
  }

  const command = new GetObjectCommand({
    Bucket: EVIDENCE_BUCKET,
    Key: s3Key,
  });

  const presignedUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGNED_URL_EXPIRATION,
  });

  return presignedUrl;
}
