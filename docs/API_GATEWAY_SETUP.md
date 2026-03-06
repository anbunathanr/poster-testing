# API Gateway Setup Guide

## Overview

This document describes the API Gateway configuration for the AI-Powered Automated Testing Platform. The API Gateway serves as the entry point for all client requests, providing JWT authentication, rate limiting, request routing, and CORS configuration.

## Architecture

The API Gateway is implemented using AWS API Gateway REST API and integrates with five Lambda functions:
- **Auth Lambda**: User authentication and registration
- **Test Generation Lambda**: AI-powered test script generation
- **Test Execution Lambda**: Playwright test execution
- **Storage Lambda**: Data management and environment configuration
- **Report Lambda**: Test report generation

## REST API Configuration

### API Details
- **API Name**: `ai-testing-api-{environment}`
- **Stage**: Environment-specific (dev, staging, prod)
- **Protocol**: HTTPS only
- **Endpoint Type**: Regional

### Deployment Configuration
```typescript
deployOptions: {
  stageName: environment,
  throttlingRateLimit: 1000,      // Requests per second
  throttlingBurstLimit: 2000,     // Burst capacity
  loggingLevel: MethodLoggingLevel.INFO,
  dataTraceEnabled: true,
  accessLogFormat: AccessLogFormat.jsonWithStandardFields()
}
```

## API Endpoints

### 1. Authentication Endpoints (Public)

#### POST /auth/register
Creates a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "tenantId": "tenant-uuid"
}
```

**Response** (201 Created):
```json
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "tenantId": "tenant-uuid"
}
```

**Integration**: Auth Lambda

---

#### POST /auth/login
Authenticates a user and returns a JWT token.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "userId": "user-uuid",
  "tenantId": "tenant-uuid"
}
```

**Integration**: Auth Lambda

---

### 2. Test Management Endpoints (Protected)

#### POST /tests/generate
Generates a test script using AI based on a natural language prompt.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Request Body**:
```json
{
  "testPrompt": "Test login functionality with valid credentials and verify dashboard loads",
  "environment": "DEV"
}
```

**Response** (200 OK):
```json
{
  "testId": "test-uuid",
  "status": "READY",
  "testScript": {
    "steps": [
      {
        "action": "navigate",
        "url": "https://app.example.com/login"
      },
      {
        "action": "fill",
        "selector": "#email",
        "value": "test@example.com"
      },
      {
        "action": "click",
        "selector": "button[type='submit']"
      },
      {
        "action": "assert",
        "selector": ".dashboard",
        "condition": "visible"
      }
    ]
  }
}
```

**Integration**: Test Generation Lambda

---

#### POST /tests/{testId}/execute
Executes a previously generated test script.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Path Parameters**:
- `testId`: UUID of the test to execute

**Request Body**:
```json
{
  "testId": "test-uuid"
}
```

**Response** (202 Accepted):
```json
{
  "resultId": "result-uuid",
  "status": "EXECUTING",
  "message": "Test execution started"
}
```

**Integration**: Test Execution Lambda

---

#### GET /tests/{testId}/results/{resultId}
Retrieves the results of a specific test execution.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Path Parameters**:
- `testId`: UUID of the test
- `resultId`: UUID of the execution result

**Response** (200 OK):
```json
{
  "resultId": "result-uuid",
  "testId": "test-uuid",
  "status": "PASS",
  "duration": 45000,
  "startTime": 1707753600000,
  "endTime": 1707753645000,
  "screenshots": [
    "https://s3.presigned.url/screenshot-1.png",
    "https://s3.presigned.url/screenshot-2.png"
  ],
  "logs": "https://s3.presigned.url/execution-log.json"
}
```

**Integration**: Storage Lambda

---

#### GET /tests/results
Lists all test results for the authenticated user's tenant.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Query Parameters**:
- `startDate` (optional): Filter results after this timestamp
- `endDate` (optional): Filter results before this timestamp
- `status` (optional): Filter by status (PASS, FAIL)
- `limit` (optional): Number of results to return (default: 20)

**Response** (200 OK):
```json
{
  "results": [
    {
      "resultId": "result-uuid",
      "testId": "test-uuid",
      "status": "PASS",
      "duration": 45000,
      "startTime": 1707753600000
    }
  ],
  "nextToken": "pagination-token"
}
```

**Integration**: Storage Lambda

---

### 3. Report Endpoints (Protected)

#### GET /reports/{resultId}
Generates a comprehensive report for a test execution.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Path Parameters**:
- `resultId`: UUID of the execution result

**Response** (200 OK):
```json
{
  "reportId": "report-uuid",
  "testId": "test-uuid",
  "resultId": "result-uuid",
  "status": "PASS",
  "executionDetails": {
    "duration": 45000,
    "startTime": 1707753600000,
    "endTime": 1707753645000,
    "environment": "DEV"
  },
  "evidence": {
    "screenshots": ["url1", "url2"],
    "logs": "log-url"
  },
  "testScript": {
    "steps": []
  }
}
```

**Integration**: Report Lambda

---

### 4. Environment Configuration Endpoints (Protected)

#### POST /environments
Creates a new environment configuration.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Request Body**:
```json
{
  "environment": "DEV",
  "baseUrl": "https://dev.example.com",
  "credentials": {
    "username": "test-user",
    "password": "encrypted-password"
  },
  "configuration": {
    "timeout": 30000,
    "retries": 3
  }
}
```

**Response** (201 Created):
```json
{
  "tenantId": "tenant-uuid",
  "environment": "DEV",
  "baseUrl": "https://dev.example.com",
  "createdAt": 1707753600000
}
```

**Integration**: Storage Lambda

---

#### GET /environments
Lists all environment configurations for the tenant.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Response** (200 OK):
```json
{
  "environments": [
    {
      "environment": "DEV",
      "baseUrl": "https://dev.example.com",
      "createdAt": 1707753600000
    },
    {
      "environment": "STAGING",
      "baseUrl": "https://staging.example.com",
      "createdAt": 1707753600000
    }
  ]
}
```

**Integration**: Storage Lambda

---

#### GET /environments/{environment}
Retrieves a specific environment configuration.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Path Parameters**:
- `environment`: Environment name (DEV, STAGING, PROD)

**Response** (200 OK):
```json
{
  "tenantId": "tenant-uuid",
  "environment": "DEV",
  "baseUrl": "https://dev.example.com",
  "configuration": {
    "timeout": 30000,
    "retries": 3
  },
  "createdAt": 1707753600000,
  "updatedAt": 1707753600000
}
```

**Integration**: Storage Lambda

---

#### PUT /environments/{environment}
Updates an existing environment configuration.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Path Parameters**:
- `environment`: Environment name (DEV, STAGING, PROD)

**Request Body**:
```json
{
  "baseUrl": "https://dev-new.example.com",
  "configuration": {
    "timeout": 60000,
    "retries": 5
  }
}
```

**Response** (200 OK):
```json
{
  "tenantId": "tenant-uuid",
  "environment": "DEV",
  "baseUrl": "https://dev-new.example.com",
  "updatedAt": 1707753700000
}
```

**Integration**: Storage Lambda

---

#### DELETE /environments/{environment}
Deletes an environment configuration.

**Headers**:
- `Authorization: Bearer {jwt-token}`

**Path Parameters**:
- `environment`: Environment name (DEV, STAGING, PROD)

**Response** (204 No Content)

**Integration**: Storage Lambda

---

## Lambda Authorizer

### JWT Token Validation

The API Gateway uses a Lambda Authorizer to validate JWT tokens for protected endpoints.

**Configuration**:
```typescript
const authorizer = new TokenAuthorizer(this, 'JwtAuthorizer', {
  handler: authorizerLambda,
  identitySource: 'method.request.header.Authorization',
  resultsCacheTtl: Duration.minutes(5)
});
```

**Authorization Flow**:
1. Client includes JWT token in `Authorization` header: `Bearer {token}`
2. API Gateway extracts token and invokes Lambda Authorizer
3. Authorizer validates token signature and expiration
4. Authorizer extracts `userId` and `tenantId` from token payload
5. Authorizer returns IAM policy allowing or denying access
6. API Gateway caches authorization decision for 5 minutes

**Token Payload**:
```json
{
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "email": "user@example.com",
  "iat": 1707753600,
  "exp": 1707757200
}
```

**Authorization Context**:
The authorizer passes user context to Lambda functions:
```json
{
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "email": "user@example.com"
}
```

---

## CORS Configuration

### Default CORS Settings

```typescript
defaultCorsPreflightOptions: {
  allowOrigins: Cors.ALL_ORIGINS,  // Should be restricted in production
  allowMethods: Cors.ALL_METHODS,
  allowHeaders: [
    'Content-Type',
    'X-Amz-Date',
    'Authorization',
    'X-Api-Key',
    'X-Amz-Security-Token'
  ]
}
```

### Production CORS Configuration

For production environments, restrict allowed origins:

```typescript
allowOrigins: [
  'https://app.example.com',
  'https://admin.example.com'
]
```

### CORS Headers in Responses

All API responses include:
- `Access-Control-Allow-Origin`: Allowed origin
- `Access-Control-Allow-Methods`: Allowed HTTP methods
- `Access-Control-Allow-Headers`: Allowed request headers
- `Access-Control-Max-Age`: Preflight cache duration

---

## Rate Limiting and Throttling

### Throttling Configuration

**Rate Limit**: 1000 requests per second per account
**Burst Limit**: 2000 requests (burst capacity)

```typescript
throttlingRateLimit: 1000,
throttlingBurstLimit: 2000
```

### Throttling Behavior

When limits are exceeded:
- API Gateway returns `429 Too Many Requests`
- Response includes `Retry-After` header
- Client should implement exponential backoff

### Per-Method Throttling

Individual methods can have custom throttling:

```typescript
method.addMethodResponse({
  statusCode: '429',
  responseParameters: {
    'method.response.header.Retry-After': true
  }
});
```

---

## Request/Response Transformations

### Request Validation

API Gateway validates requests before invoking Lambda functions:

```typescript
const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
  restApi: api,
  validateRequestBody: true,
  validateRequestParameters: true
});
```

### Request Models

Define JSON schemas for request validation:

```typescript
const testGenerateModel = api.addModel('TestGenerateModel', {
  contentType: 'application/json',
  schema: {
    type: apigateway.JsonSchemaType.OBJECT,
    required: ['testPrompt', 'environment'],
    properties: {
      testPrompt: { type: apigateway.JsonSchemaType.STRING },
      environment: { 
        type: apigateway.JsonSchemaType.STRING,
        enum: ['DEV', 'STAGING', 'PROD']
      }
    }
  }
});
```

### Response Transformations

Standard response format for all endpoints:

**Success Response**:
```json
{
  "statusCode": 200,
  "body": {
    // Response data
  }
}
```

**Error Response**:
```json
{
  "statusCode": 400,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

---

## Logging Configuration

### CloudWatch Logs

**Log Group**: `/aws/apigateway/ai-testing-{environment}`
**Retention**: 30 days
**Log Level**: INFO

```typescript
const logGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
  logGroupName: `/aws/apigateway/ai-testing-${environment}`,
  retention: logs.RetentionDays.ONE_MONTH,
  removalPolicy: cdk.RemovalPolicy.DESTROY
});
```

### Access Logs

Access logs are written in JSON format with standard fields:

```json
{
  "requestId": "request-uuid",
  "ip": "client-ip",
  "requestTime": "timestamp",
  "httpMethod": "POST",
  "routeKey": "/tests/generate",
  "status": 200,
  "protocol": "HTTP/1.1",
  "responseLength": 1234
}
```

### Execution Logs

Execution logs include:
- Request/response payloads (when `dataTraceEnabled: true`)
- Integration latency
- Lambda execution duration
- Authorization decisions

### Log Analysis

Use CloudWatch Insights to query logs:

```sql
fields @timestamp, httpMethod, routeKey, status, responseLength
| filter status >= 400
| sort @timestamp desc
| limit 100
```

---

## Security Best Practices

### HTTPS Only
- API Gateway enforces HTTPS for all requests
- HTTP requests are automatically redirected to HTTPS

### API Keys (Optional)
For additional security, enable API keys:

```typescript
const apiKey = api.addApiKey('ApiKey', {
  apiKeyName: `ai-testing-api-key-${environment}`
});

const usagePlan = api.addUsagePlan('UsagePlan', {
  throttle: {
    rateLimit: 1000,
    burstLimit: 2000
  },
  quota: {
    limit: 100000,
    period: apigateway.Period.MONTH
  }
});

usagePlan.addApiKey(apiKey);
```

### WAF Integration
Integrate AWS WAF for additional protection:
- SQL injection protection
- XSS protection
- Rate-based rules
- IP blacklisting

### Resource Policies
Restrict API access by IP or VPC:

```typescript
const policy = new iam.PolicyDocument({
  statements: [
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: ['execute-api:Invoke'],
      resources: ['execute-api:/*'],
      conditions: {
        IpAddress: {
          'aws:SourceIp': ['10.0.0.0/16']
        }
      }
    })
  ]
});

api.addToResourcePolicy(policy);
```

---

## Monitoring and Alarms

### CloudWatch Metrics

Key metrics to monitor:
- `Count`: Total number of API requests
- `4XXError`: Client errors
- `5XXError`: Server errors
- `Latency`: Request latency
- `IntegrationLatency`: Lambda execution time

### CloudWatch Alarms

```typescript
const errorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
  metric: api.metricServerError(),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'API Gateway 5xx errors exceeded threshold'
});

const latencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
  metric: api.metricLatency(),
  threshold: 5000,
  evaluationPeriods: 2,
  alarmDescription: 'API Gateway latency exceeded 5 seconds'
});
```

---

## Deployment

### CDK Deployment

Deploy the API Gateway stack:

```bash
cd infrastructure
npm install
cdk deploy AiTestingPlatformStack --profile your-aws-profile
```

### API Gateway URL

After deployment, the API Gateway URL is available:

```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
```

### Custom Domain (Optional)

Configure a custom domain:

```typescript
const certificate = acm.Certificate.fromCertificateArn(
  this,
  'Certificate',
  'arn:aws:acm:region:account:certificate/cert-id'
);

const domainName = api.addDomainName('CustomDomain', {
  domainName: 'api.example.com',
  certificate: certificate
});
```

---

## Testing

### Manual Testing with curl

**Login**:
```bash
curl -X POST https://api-url/dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

**Generate Test** (with JWT):
```bash
curl -X POST https://api-url/dev/tests/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {jwt-token}" \
  -d '{"testPrompt":"Test login","environment":"DEV"}'
```

### Integration Testing

Use the provided test suite:

```bash
npm run test:integration
```

---

## Troubleshooting

### Common Issues

**401 Unauthorized**:
- Verify JWT token is valid and not expired
- Check Authorization header format: `Bearer {token}`
- Verify Lambda Authorizer is configured correctly

**429 Too Many Requests**:
- Implement exponential backoff in client
- Request throttling limit increase if needed

**500 Internal Server Error**:
- Check Lambda function logs in CloudWatch
- Verify Lambda has correct IAM permissions
- Check Lambda function timeout settings

**CORS Errors**:
- Verify allowed origins in CORS configuration
- Check preflight OPTIONS requests are handled
- Ensure response headers include CORS headers

---

## References

- [AWS API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [Lambda Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)
- [API Gateway Throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
- [Design Document](../design.md)
- [Infrastructure Deployment Guide](./INFRASTRUCTURE_DEPLOYMENT.md)
