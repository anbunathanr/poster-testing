/**
 * Storage Lambda - Manages DynamoDB operations, S3 uploads, and presigned URL generation
 * 
 * This Lambda handles:
 * - S3 uploads for screenshots and logs
 * - DynamoDB operations for test results
 * - Presigned URL generation for secure evidence access
 * - Tenant isolation enforcement
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  createTestResult,
  getTestResult,
  listTestResultsByTest,
  queryTestResults,
  updateTestResult,
  CreateTestResultInput,
  UpdateTestResultInput,
  QueryTestResultsInput,
} from '../../shared/database/testResultOperations';
import {
  createOrUpdateEnvironmentConfig,
  getEnvironmentConfig,
  updateEnvironmentConfig,
  deleteEnvironmentConfig,
  listEnvironmentConfigs,
  CreateEnvironmentConfigInput,
} from '../../shared/database/environmentOperations';
import {
  uploadScreenshotsToS3,
  uploadLogToS3,
  uploadContentToS3,
} from '../../shared/utils/s3Upload';

// Initialize S3 client lazily
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({});
  }
  return s3Client;
}

const EVIDENCE_BUCKET = process.env.EVIDENCE_BUCKET || 'ai-testing-platform-evidence';
const PRESIGNED_URL_EXPIRATION = 3600; // 1 hour in seconds

/**
 * Main handler for Storage Lambda
 * Routes requests to appropriate handlers based on HTTP method and path
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Extract tenant context from authorizer
    const tenantId = event.requestContext.authorizer?.tenantId;
    const userId = event.requestContext.authorizer?.userId;

    if (!tenantId || !userId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Unauthorized: Missing tenant or user context' }),
      };
    }

    // Route to appropriate handler
    if (path === '/storage/results' && method === 'POST') {
      return await handleCreateTestResult(event, tenantId, userId);
    }

    if (path.match(/^\/storage\/results\/[^/]+$/) && method === 'GET') {
      const resultId = path.split('/').pop()!;
      return await handleGetTestResult(event, tenantId, resultId);
    }

    if (path.match(/^\/storage\/results\/[^/]+$/) && method === 'PUT') {
      const resultId = path.split('/').pop()!;
      return await handleUpdateTestResult(event, tenantId, resultId);
    }

    if (path === '/storage/upload/screenshots' && method === 'POST') {
      return await handleUploadScreenshots(event, tenantId);
    }

    if (path === '/storage/upload/log' && method === 'POST') {
      return await handleUploadLog(event, tenantId);
    }

    if (path === '/storage/presigned-url' && method === 'POST') {
      return await handleGeneratePresignedUrl(event, tenantId);
    }

    if (path.match(/^\/storage\/tests\/[^/]+\/results$/) && method === 'GET') {
      const testId = path.split('/')[3];
      return await handleListTestResults(event, testId);
    }

    if (path === '/tests/results' && method === 'GET') {
      return await handleQueryTestResults(event, tenantId);
    }

    // Environment management routes
    if (path === '/environments' && method === 'POST') {
      return await handleCreateEnvironment(event, tenantId);
    }

    if (path === '/environments' && method === 'GET') {
      return await handleListEnvironments(event, tenantId);
    }

    if (path.match(/^\/environments\/[^/]+$/) && method === 'GET') {
      const environment = path.split('/').pop()!;
      return await handleGetEnvironment(event, tenantId, environment);
    }

    if (path.match(/^\/environments\/[^/]+$/) && method === 'PUT') {
      const environment = path.split('/').pop()!;
      return await handleUpdateEnvironment(event, tenantId, environment);
    }

    if (path.match(/^\/environments\/[^/]+$/) && method === 'DELETE') {
      const environment = path.split('/').pop()!;
      return await handleDeleteEnvironment(event, tenantId, environment);
    }

    // Default response for unimplemented routes
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Route not found' }),
    };
  } catch (error) {
    console.error('Unhandled error in Storage Lambda:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Handles creating a new test result
 * POST /storage/results
 */
async function handleCreateTestResult(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: CreateTestResultInput;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    // Enforce tenant isolation - override tenantId and userId from JWT
    requestBody.tenantId = tenantId;
    requestBody.userId = userId;

    // Validate required fields
    if (!requestBody.testId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'testId is required' }),
      };
    }

    if (!requestBody.status || !['PASS', 'FAIL'].includes(requestBody.status)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'status must be PASS or FAIL' }),
      };
    }

    // Create test result in DynamoDB
    const testResult = await createTestResult(requestBody);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testResult),
    };
  } catch (error) {
    console.error('Error in handleCreateTestResult:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('must be')
      ) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: error.message }),
        };
      }
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to create test result' }),
    };
  }
}

/**
 * Handles retrieving a test result
 * GET /storage/results/{resultId}
 */
async function handleGetTestResult(
  _event: APIGatewayProxyEvent,
  tenantId: string,
  resultId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Retrieve test result with tenant isolation
    const testResult = await getTestResult(tenantId, resultId);

    if (!testResult) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Test result not found' }),
      };
    }

    // Generate presigned URLs for screenshots and logs
    const screenshotUrls = await Promise.all(
      testResult.screenshotsS3Keys.map((key) => generatePresignedUrl(key, tenantId))
    );

    const logUrl = await generatePresignedUrl(testResult.logsS3Key, tenantId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testResult,
        screenshotUrls,
        logUrl,
      }),
    };
  } catch (error) {
    console.error('Error in handleGetTestResult:', error);

    if (error instanceof Error && error.message.includes('required')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to retrieve test result' }),
    };
  }
}

/**
 * Handles updating a test result
 * PUT /storage/results/{resultId}
 */
async function handleUpdateTestResult(
  event: APIGatewayProxyEvent,
  tenantId: string,
  resultId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: Partial<UpdateTestResultInput>;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    // Enforce tenant isolation - use tenantId from JWT, override any tenantId in request body
    const updateInput: UpdateTestResultInput = {
      ...requestBody,
      tenantId,
      resultId,
    };

    // Validate status if provided
    if (updateInput.status && !['PASS', 'FAIL', 'EXECUTING'].includes(updateInput.status)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'status must be PASS, FAIL, or EXECUTING' }),
      };
    }

    // Update test result in DynamoDB
    const updatedResult = await updateTestResult(updateInput);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedResult),
    };
  } catch (error) {
    console.error('Error in handleUpdateTestResult:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: error.message }),
        };
      }

      if (
        error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('must be')
      ) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: error.message }),
        };
      }
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to update test result' }),
    };
  }
}

/**
 * Handles uploading screenshots to S3
 * POST /storage/upload/screenshots
 */
async function handleUploadScreenshots(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: {
      screenshotPaths: string[];
      resultId: string;
    };
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    const { screenshotPaths, resultId } = requestBody;

    if (!screenshotPaths || !Array.isArray(screenshotPaths) || screenshotPaths.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'screenshotPaths must be a non-empty array' }),
      };
    }

    if (!resultId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'resultId is required' }),
      };
    }

    // Upload screenshots to S3 with tenant-specific prefix
    const s3Keys = await uploadScreenshotsToS3(screenshotPaths, tenantId, resultId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        s3Keys,
        message: `Successfully uploaded ${s3Keys.length} screenshots`,
      }),
    };
  } catch (error) {
    console.error('Error in handleUploadScreenshots:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to upload screenshots' }),
    };
  }
}

/**
 * Handles uploading execution log to S3
 * POST /storage/upload/log
 */
async function handleUploadLog(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: {
      logFilePath?: string;
      logContent?: string;
      resultId: string;
    };
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    const { logFilePath, logContent, resultId } = requestBody;

    if (!resultId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'resultId is required' }),
      };
    }

    let s3Key: string;

    // Support both file path and direct content upload
    if (logFilePath) {
      s3Key = await uploadLogToS3(logFilePath, tenantId, resultId);
    } else if (logContent) {
      s3Key = `${tenantId}/logs/${resultId}/execution-log.json`;
      await uploadContentToS3(logContent, s3Key, 'application/json');
    } else {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Either logFilePath or logContent is required' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        s3Key,
        message: 'Successfully uploaded execution log',
      }),
    };
  } catch (error) {
    console.error('Error in handleUploadLog:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to upload log' }),
    };
  }
}

/**
 * Handles generating presigned URLs for S3 objects
 * POST /storage/presigned-url
 */
async function handleGeneratePresignedUrl(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: {
      s3Key: string;
    };
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    const { s3Key } = requestBody;

    if (!s3Key) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 's3Key is required' }),
      };
    }

    // Generate presigned URL with tenant validation
    const presignedUrl = await generatePresignedUrl(s3Key, tenantId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        presignedUrl,
        expiresIn: PRESIGNED_URL_EXPIRATION,
      }),
    };
  } catch (error) {
    console.error('Error in handleGeneratePresignedUrl:', error);

    if (error instanceof Error && error.message.includes('Tenant validation failed')) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to generate presigned URL' }),
    };
  }
}

/**
 * Handles listing test results for a specific test
 * GET /storage/tests/{testId}/results
 */
async function handleListTestResults(
  event: APIGatewayProxyEvent,
  testId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Extract pagination parameters
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 20;

    const lastEvaluatedKey = event.queryStringParameters?.nextToken
      ? JSON.parse(decodeURIComponent(event.queryStringParameters.nextToken))
      : undefined;

    // List test results
    const { results, lastEvaluatedKey: nextKey } = await listTestResultsByTest(
      testId,
      limit,
      lastEvaluatedKey
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        results,
        nextToken: nextKey ? encodeURIComponent(JSON.stringify(nextKey)) : undefined,
      }),
    };
  } catch (error) {
    console.error('Error in handleListTestResults:', error);

    if (error instanceof Error && error.message.includes('required')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to list test results' }),
    };
  }
}

/**
 * Handles querying test results with filters
 * GET /tests/results
 */
async function handleQueryTestResults(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Extract query parameters
    const queryParams = event.queryStringParameters || {};
    
    const startDate = queryParams.startDate ? parseInt(queryParams.startDate, 10) : undefined;
    const endDate = queryParams.endDate ? parseInt(queryParams.endDate, 10) : undefined;
    const status = queryParams.status as 'PASS' | 'FAIL' | undefined;
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 20;
    const lastEvaluatedKey = queryParams.nextToken
      ? JSON.parse(decodeURIComponent(queryParams.nextToken))
      : undefined;

    // Validate status if provided
    if (status && status !== 'PASS' && status !== 'FAIL') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid status. Must be PASS or FAIL' }),
      };
    }

    // Query test results with filters
    const input: QueryTestResultsInput = {
      tenantId,
      startDate,
      endDate,
      status,
      limit,
      lastEvaluatedKey,
    };

    const { results, lastEvaluatedKey: nextKey } = await queryTestResults(input);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        results,
        nextToken: nextKey ? encodeURIComponent(JSON.stringify(nextKey)) : undefined,
      }),
    };
  } catch (error) {
    console.error('Error in handleQueryTestResults:', error);

    if (error instanceof Error && error.message.includes('required')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to query test results' }),
    };
  }
}

/**
 * Generates a presigned URL for an S3 object with tenant validation
 * 
 * @param s3Key - S3 object key
 * @param tenantId - Tenant identifier for validation
 * @returns Presigned URL
 * @throws Error if tenant validation fails
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


/**
 * Handles creating a new environment configuration
 * POST /environments
 */
async function handleCreateEnvironment(
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: CreateEnvironmentConfigInput;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    // Enforce tenant isolation
    requestBody.tenantId = tenantId;

    // Validate required fields
    if (!requestBody.environment) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'environment is required' }),
      };
    }

    if (!requestBody.baseUrl) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'baseUrl is required' }),
      };
    }

    // Create environment configuration
    const config = await createOrUpdateEnvironmentConfig(requestBody);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    };
  } catch (error) {
    console.error('Error in handleCreateEnvironment:', error);

    if (error instanceof Error && error.message.includes('required')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to create environment configuration' }),
    };
  }
}

/**
 * Handles listing all environment configurations for a tenant
 * GET /environments
 */
async function handleListEnvironments(
  _event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  try {
    const configs = await listEnvironmentConfigs(tenantId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ environments: configs }),
    };
  } catch (error) {
    console.error('Error in handleListEnvironments:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to list environment configurations' }),
    };
  }
}

/**
 * Handles retrieving a specific environment configuration
 * GET /environments/{environment}
 */
async function handleGetEnvironment(
  _event: APIGatewayProxyEvent,
  tenantId: string,
  environment: string
): Promise<APIGatewayProxyResult> {
  try {
    const config = await getEnvironmentConfig(tenantId, environment as any);

    if (!config) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Environment configuration not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    };
  } catch (error) {
    console.error('Error in handleGetEnvironment:', error);

    if (error instanceof Error && error.message.includes('required')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to retrieve environment configuration' }),
    };
  }
}

/**
 * Handles updating an environment configuration
 * PUT /environments/{environment}
 */
async function handleUpdateEnvironment(
  event: APIGatewayProxyEvent,
  tenantId: string,
  environment: string
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: Partial<CreateEnvironmentConfigInput>;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    // Enforce tenant isolation and environment from path
    const updateInput: CreateEnvironmentConfigInput = {
      ...requestBody,
      tenantId,
      environment: environment as any,
      baseUrl: requestBody.baseUrl || '',
    };

    if (!updateInput.baseUrl) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'baseUrl is required' }),
      };
    }

    // Update environment configuration
    const config = await updateEnvironmentConfig(updateInput);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    };
  } catch (error) {
    console.error('Error in handleUpdateEnvironment:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    if (error instanceof Error && error.message.includes('required')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to update environment configuration' }),
    };
  }
}

/**
 * Handles deleting an environment configuration
 * DELETE /environments/{environment}
 */
async function handleDeleteEnvironment(
  _event: APIGatewayProxyEvent,
  tenantId: string,
  environment: string
): Promise<APIGatewayProxyResult> {
  try {
    await deleteEnvironmentConfig(tenantId, environment as any);

    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'application/json',
      },
      body: '',
    };
  } catch (error) {
    console.error('Error in handleDeleteEnvironment:', error);

    if (error instanceof Error && error.message.includes('required')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to delete environment configuration' }),
    };
  }
}
