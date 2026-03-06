/**
 * End-to-End Test: Authentication Flow
 * Tests the complete authentication workflow from registration to login
 */

import { handler as authHandler } from '../../src/lambdas/auth/index';
import { handler as authorizerHandler } from '../../src/lambdas/authorizer/index';
import { APIGatewayProxyEvent, APIGatewayAuthorizerEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

describe('E2E: Authentication Flow', () => {
  const testEmail = `test-${uuidv4()}@example.com`;
  const testPassword = 'SecurePassword123!';
  const testTenantId = uuidv4();
  let authToken: string;

  it('should complete full authentication workflow', async () => {
    // Step 1: Register a new user
    const registerEvent: APIGatewayProxyEvent = {
      httpMethod: 'POST',
      path: '/auth/register',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        tenantId: testTenantId,
      }),
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };

    const registerResponse = await authHandler(registerEvent);
    expect(registerResponse.statusCode).toBe(201);
    
    const registerBody = JSON.parse(registerResponse.body);
    expect(registerBody.userId).toBeDefined();
    expect(registerBody.email).toBe(testEmail);
    expect(registerBody.tenantId).toBe(testTenantId);

    // Step 2: Login with the registered user
    const loginEvent: APIGatewayProxyEvent = {
      httpMethod: 'POST',
      path: '/auth/login',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };

    const loginResponse = await authHandler(loginEvent);
    expect(loginResponse.statusCode).toBe(200);
    
    const loginBody = JSON.parse(loginResponse.body);
    expect(loginBody.token).toBeDefined();
    expect(loginBody.userId).toBe(registerBody.userId);
    expect(loginBody.tenantId).toBe(testTenantId);
    
    authToken = loginBody.token;

    // Step 3: Validate the token using the authorizer
    const authorizerEvent: APIGatewayAuthorizerEvent = {
      type: 'TOKEN',
      methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/tests',
      authorizationToken: `Bearer ${authToken}`,
    };

    const authorizerResponse = await authorizerHandler(authorizerEvent);
    expect(authorizerResponse.principalId).toBe(registerBody.userId);
    expect(authorizerResponse.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(authorizerResponse.context?.tenantId).toBe(testTenantId);
    expect(authorizerResponse.context?.userId).toBe(registerBody.userId);
    expect(authorizerResponse.context?.email).toBe(testEmail);
  });

  it('should reject login with invalid credentials', async () => {
    const loginEvent: APIGatewayProxyEvent = {
      httpMethod: 'POST',
      path: '/auth/login',
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword123!',
      }),
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };

    const loginResponse = await authHandler(loginEvent);
    expect(loginResponse.statusCode).toBe(401);
    
    const loginBody = JSON.parse(loginResponse.body);
    expect(loginBody.error).toBeDefined();
  });

  it('should reject invalid token in authorizer', async () => {
    const authorizerEvent: APIGatewayAuthorizerEvent = {
      type: 'TOKEN',
      methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/tests',
      authorizationToken: 'Bearer invalid.token.here',
    };

    await expect(authorizerHandler(authorizerEvent)).rejects.toThrow('Unauthorized');
  });
});
