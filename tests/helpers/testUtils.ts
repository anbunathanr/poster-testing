/**
 * Test Utilities
 * Common helper functions for tests
 */

/**
 * Creates a mock AWS Lambda context
 */
export const createMockContext = () => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2024/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
});

/**
 * Creates a mock API Gateway event
 */
export const createMockAPIGatewayEvent = (overrides: any = {}) => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api-id',
    authorizer: {},
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
    },
    path: '/',
    stage: 'test',
    requestId: 'test-request-id',
    requestTime: '01/Jan/2024:00:00:00 +0000',
    requestTimeEpoch: 1704067200000,
    resourceId: 'test-resource-id',
    resourcePath: '/',
  },
  resource: '/',
  ...overrides,
});

/**
 * Creates a mock DynamoDB item
 */
export const createMockDynamoDBItem = (attributes: Record<string, any>) => {
  return Object.entries(attributes).reduce((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = { S: value };
    } else if (typeof value === 'number') {
      acc[key] = { N: value.toString() };
    } else if (typeof value === 'boolean') {
      acc[key] = { BOOL: value };
    } else if (Array.isArray(value)) {
      acc[key] = { L: value.map(v => ({ S: v })) };
    } else if (typeof value === 'object') {
      acc[key] = { M: createMockDynamoDBItem(value) };
    }
    return acc;
  }, {} as Record<string, any>);
};

/**
 * Waits for a condition to be true
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
};

/**
 * Creates a delay promise
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generates a mock JWT token payload
 */
export const createMockJWTPayload = (overrides: any = {}) => ({
  userId: 'user-123',
  tenantId: 'tenant-123',
  email: 'test@example.com',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
});

/**
 * Creates a mock test script
 */
export const createMockTestScript = () => ({
  testId: 'test-123',
  tenantId: 'tenant-123',
  userId: 'user-123',
  testPrompt: 'Test login functionality',
  environment: 'DEV',
  testScript: {
    steps: [
      { action: 'navigate', url: 'https://example.com/login' },
      { action: 'fill', selector: '#email', value: 'test@example.com' },
      { action: 'fill', selector: '#password', value: 'password123' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'waitForNavigation' },
      { action: 'assert', selector: '.dashboard', condition: 'visible' },
    ],
  },
  createdAt: Date.now(),
  status: 'READY',
});

/**
 * Creates a mock test result
 */
export const createMockTestResult = (status: 'PASS' | 'FAIL' = 'PASS') => ({
  resultId: 'result-123',
  testId: 'test-123',
  tenantId: 'tenant-123',
  userId: 'user-123',
  status,
  startTime: Date.now() - 5000,
  endTime: Date.now(),
  duration: 5000,
  screenshotsS3Keys: ['screenshot-1.png', 'screenshot-2.png'],
  logsS3Key: 'execution-log.json',
  errorMessage: status === 'FAIL' ? 'Element not found' : undefined,
});
