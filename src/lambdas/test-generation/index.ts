/**
 * Test Generation Lambda
 * Handles test generation requests and orchestrates AI-powered test script creation
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getTestGenerationService, TestGenerationError } from '../../shared/services/testGenerationService';
import { createTest } from '../../shared/database/testOperations';
import { getEnvironmentConfig } from '../../shared/database/environmentOperations';
import { Environment, JWTPayload } from '../../shared/types';
import { emitTestGenerationDuration, emitAPILatency } from '../../shared/utils/cloudwatchMetrics';

/**
 * Main handler for Test Generation Lambda
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Route to appropriate handler
    if (path === '/tests/generate' && method === 'POST') {
      return await handleGenerateTest(event);
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
    console.error('Unhandled error in Test Generation Lambda:', error);
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
 * Request body interface for test generation
 */
interface GenerateTestRequest {
  testPrompt: string;
  environment: Environment;
  environmentId?: string;
  testName?: string;
}

/**
 * Handles test generation requests
 * POST /tests/generate
 */
async function handleGenerateTest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    // Extract JWT context from authorizer
    const jwtContext = extractJWTContext(event);
    if (!jwtContext) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Unauthorized: Missing authentication context' }),
      };
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: GenerateTestRequest;
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

    // Validate required fields
    const { testPrompt, environment, environmentId, testName } = requestBody;

    if (!testPrompt || typeof testPrompt !== 'string' || testPrompt.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'testPrompt is required and must be a non-empty string' }),
      };
    }

    if (!environment || typeof environment !== 'string') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'environment is required' }),
      };
    }

    // Validate environment value
    const validEnvironments: Environment[] = ['DEV', 'STAGING', 'PROD'];
    if (!validEnvironments.includes(environment)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: `Invalid environment. Must be one of: ${validEnvironments.join(', ')}` 
        }),
      };
    }

    // Retrieve environment configuration if environmentId provided
    let environmentConfig;
    if (environmentId) {
      try {
        environmentConfig = await getEnvironmentConfig(jwtContext.tenantId, environment);
        if (!environmentConfig) {
          return {
            statusCode: 404,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              error: `Environment configuration not found for ${environment}` 
            }),
          };
        }
      } catch (error) {
        console.error('Error retrieving environment configuration:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Failed to retrieve environment configuration' }),
        };
      }
    }

    // Generate test script using TestGenerationService
    console.log('Generating test script for prompt:', testPrompt);
    const testGenerationService = getTestGenerationService();
    
    let generationResult;
    try {
      generationResult = await testGenerationService.generateTest({
        testPrompt: testPrompt.trim(),
        environment,
        environmentConfig,
      });
    } catch (error) {
      console.error('Test generation failed:', error);
      
      if (error instanceof TestGenerationError) {
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            error: error.message || 'Test generation failed',
            code: error.code,
            attempts: error.attempts,
          }),
        };
      }
      
      throw error;
    }

    console.log('Test script generated successfully after', generationResult.attempts, 'attempts');

    // Store generated test in DynamoDB
    const test = await createTest({
      tenantId: jwtContext.tenantId,
      userId: jwtContext.userId,
      testPrompt: testPrompt.trim(),
      testScript: generationResult.testScript,
      environment,
      testName: testName?.trim(),
    });

    console.log('Test stored in DynamoDB with testId:', test.testId);

    // Emit CloudWatch metrics
    const duration = Date.now() - startTime;
    await emitTestGenerationDuration(duration);
    await emitAPILatency(duration, '/tests/generate');

    // Return success response
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testId: test.testId,
        status: test.status,
        testScript: test.testScript,
        environment: test.environment,
        createdAt: test.createdAt,
      }),
    };
  } catch (error) {
    console.error('Error in handleGenerateTest:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      // Validation errors
      if (
        error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('cannot be empty')
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

    // Generic error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to generate test' }),
    };
  }
}

/**
 * Extracts JWT context from API Gateway authorizer context
 */
function extractJWTContext(event: APIGatewayProxyEvent): JWTPayload | null {
  try {
    // API Gateway Lambda Authorizer adds context to requestContext.authorizer
    const authorizer = event.requestContext?.authorizer;
    
    if (!authorizer || typeof authorizer !== 'object') {
      return null;
    }

    // Extract claims from authorizer context
    const userId = authorizer.userId || authorizer.claims?.userId;
    const tenantId = authorizer.tenantId || authorizer.claims?.tenantId;
    const email = authorizer.email || authorizer.claims?.email;

    if (!userId || !tenantId || !email) {
      return null;
    }

    return {
      userId: String(userId),
      tenantId: String(tenantId),
      email: String(email),
      iat: 0, // Not needed for this context
      exp: 0, // Not needed for this context
    };
  } catch (error) {
    console.error('Error extracting JWT context:', error);
    return null;
  }
}
