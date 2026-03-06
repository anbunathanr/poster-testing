# Design Document: AI-Powered Automated Testing SaaS Platform

## Overview

This design document describes the architecture and implementation approach for an AI-powered automated testing SaaS platform targeting Social Media Poster applications. The system leverages AWS serverless technologies to provide a scalable, multi-tenant testing solution that combines AI-driven test generation (Amazon Bedrock with Claude 3.5 Sonnet) with automated UI testing (Playwright on AWS Lambda).

The platform follows a microservices architecture where each Lambda function handles a specific responsibility: authentication, test generation orchestration, test execution, storage management, and notifications. This design ensures scalability, maintainability, and clear separation of concerns.

## System Architecture

### High-Level Architecture

```
┌─────────────┐
│   Client    │
│ Application │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                          │
│  - JWT Validation                                       │
│  - Rate Limiting                                        │
│  - Request Routing                                      │
└──────┬──────────────────────────────────────────────────┘
       │
       ├──────────────┬──────────────┬──────────────┬──────────────┐
       ▼              ▼              ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Auth    │   │  Test    │   │  Test    │   │ Storage  │   │  Report  │
│ Lambda   │   │  Gen     │   │  Exec    │   │ Lambda   │   │ Lambda   │
│          │   │ Lambda   │   │ Lambda   │   │          │   │          │
└────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │              │              │
     │              ▼              │              │              │
     │       ┌──────────┐          │              │              │
     │       │ Bedrock  │          │              │              │
     │       │ Claude   │          │              │              │
     │       │   3.5    │          │              │              │
     │       └──────────┘          │              │              │
     │                             │              │              │
     ├─────────────────────────────┴──────────────┴──────────────┤
     ▼                                                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DynamoDB                                │
│  - Users Table                                                  │
│  - Tests Table                                                  │
│  - TestResults Table                                            │
│  - Environments Table                                           │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │      S3      │
                          │ - Screenshots│
                          │ - Logs       │
                          │ - Reports    │
                          └──────────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │  SNS/n8n     │
                          │ Notifications│
                          └──────────────┘
```

### Component Responsibilities

#### 1. API Gateway
- Entry point for all client requests
- JWT token validation using Lambda authorizer
- Rate limiting and throttling
- Request/response transformation
- CORS configuration

#### 2. Auth Lambda
- User authentication (email/password)
- JWT token generation and validation
- Password hashing and verification
- User registration and management
- Tenant association

#### 3. Test Generation Lambda (Orchestrator)
- Receives test prompts from users
- Constructs structured prompts for Bedrock
- Invokes Amazon Bedrock (Claude 3.5 Sonnet)
- Parses AI-generated test scripts
- Validates test script structure
- Stores test scripts in DynamoDB
- Triggers Test Execution Lambda

#### 4. Test Execution Lambda
- Initializes Playwright browser
- Executes test steps sequentially
- Captures screenshots at each step
- Handles errors and timeouts
- Generates execution logs
- Stores results and evidence
- Triggers notifications

#### 5. Storage Lambda
- Manages DynamoDB operations
- Handles S3 uploads for screenshots/logs
- Generates presigned URLs
- Enforces tenant isolation
- Implements data retention policies

#### 6. Report Lambda
- Generates test reports in JSON format
- Aggregates test results
- Creates presigned URLs for evidence
- Supports individual and batch reports

#### 7. Notification Service (SNS/n8n)
- Sends email notifications
- Formats PASS/FAIL messages
- Includes test metadata
- Handles retry logic

## Data Models

### DynamoDB Tables

#### Users Table
```
Partition Key: userId (String)
Sort Key: -

Attributes:
- userId: String (UUID)
- email: String
- passwordHash: String
- tenantId: String
- createdAt: Number (timestamp)
- updatedAt: Number (timestamp)
- status: String (ACTIVE, INACTIVE)

GSI: tenantId-index
- Partition Key: tenantId
- Sort Key: email
```

#### Tests Table
```
Partition Key: tenantId (String)
Sort Key: testId (String)

Attributes:
- testId: String (UUID)
- tenantId: String
- userId: String
- testPrompt: String
- testScript: Map (structured test steps)
- environment: String (DEV, STAGING, PROD)
- createdAt: Number (timestamp)
- status: String (DRAFT, READY, EXECUTING, COMPLETED)

GSI: userId-createdAt-index
- Partition Key: userId
- Sort Key: createdAt
```

#### TestResults Table
```
Partition Key: tenantId (String)
Sort Key: resultId (String)

Attributes:
- resultId: String (UUID)
- testId: String
- tenantId: String
- userId: String
- status: String (PASS, FAIL)
- startTime: Number (timestamp)
- endTime: Number (timestamp)
- duration: Number (milliseconds)
- screenshotsS3Keys: List<String>
- logsS3Key: String
- errorMessage: String (if FAIL)
- executionLog: Map

GSI: testId-startTime-index
- Partition Key: testId
- Sort Key: startTime
```

#### Environments Table
```
Partition Key: tenantId (String)
Sort Key: environment (String)

Attributes:
- tenantId: String
- environment: String (DEV, STAGING, PROD)
- baseUrl: String
- credentials: Map (encrypted)
- configuration: Map
- createdAt: Number (timestamp)
- updatedAt: Number (timestamp)
```

### S3 Bucket Structure

```
s3://ai-testing-platform-evidence/
├── {tenantId}/
│   ├── screenshots/
│   │   ├── {resultId}/
│   │   │   ├── step-1-{timestamp}.png
│   │   │   ├── step-2-{timestamp}.png
│   │   │   └── failure-{timestamp}.png
│   ├── logs/
│   │   ├── {resultId}/
│   │   │   └── execution-log.json
│   └── reports/
│       ├── {reportId}.json
```

## API Design

### Authentication Endpoints

#### POST /auth/register
Request:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "tenantId": "tenant-uuid"
}
```

Response:
```json
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "tenantId": "tenant-uuid"
}
```

#### POST /auth/login
Request:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "userId": "user-uuid",
  "tenantId": "tenant-uuid"
}
```

### Test Management Endpoints

#### POST /tests/generate
Request:
```json
{
  "testPrompt": "Test login functionality with valid credentials and verify dashboard loads",
  "environment": "DEV"
}
```

Response:
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
        "action": "fill",
        "selector": "#password",
        "value": "password123"
      },
      {
        "action": "click",
        "selector": "button[type='submit']"
      },
      {
        "action": "waitForNavigation"
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

#### POST /tests/{testId}/execute
Request:
```json
{
  "testId": "test-uuid"
}
```

Response:
```json
{
  "resultId": "result-uuid",
  "status": "EXECUTING",
  "message": "Test execution started"
}
```

#### GET /tests/{testId}/results/{resultId}
Response:
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

#### GET /tests/results
Query Parameters:
- startDate (optional)
- endDate (optional)
- status (optional): PASS, FAIL
- limit (optional): default 20

Response:
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

### Report Endpoints

#### GET /reports/{resultId}
Response:
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
  "testScript": { }
}
```

## Implementation Details

### Authentication Flow

1. User submits credentials to `/auth/login`
2. Auth Lambda retrieves user from DynamoDB Users table
3. Auth Lambda verifies password hash using bcrypt
4. Auth Lambda generates JWT token with payload:
   ```json
   {
     "userId": "user-uuid",
     "tenantId": "tenant-uuid",
     "email": "user@example.com",
     "iat": 1707753600,
     "exp": 1707757200
   }
   ```
5. JWT token returned to client
6. Client includes token in Authorization header for subsequent requests
7. API Gateway Lambda Authorizer validates token on each request

### Test Generation Flow

1. User submits test prompt to `/tests/generate`
2. API Gateway validates JWT and routes to Test Generation Lambda
3. Test Generation Lambda:
   - Retrieves environment configuration from DynamoDB
   - Constructs structured prompt for Bedrock:
     ```
     You are a QA automation expert. Generate Playwright test steps for the following scenario:
     
     Test Prompt: {user_prompt}
     Environment: {environment}
     Base URL: {base_url}
     
     Return a JSON object with the following structure:
     {
       "steps": [
         {"action": "navigate", "url": "..."},
         {"action": "fill", "selector": "...", "value": "..."},
         {"action": "click", "selector": "..."},
         {"action": "assert", "selector": "...", "condition": "..."}
       ]
     }
     ```
   - Invokes Bedrock API with Claude 3.5 Sonnet model
   - Parses JSON response from Bedrock
   - Validates test script structure
   - Stores test in DynamoDB Tests table
4. Returns test script to user

### Test Execution Flow

1. User triggers execution via `/tests/{testId}/execute`
2. Test Execution Lambda:
   - Retrieves test script from DynamoDB
   - Retrieves environment configuration
   - Initializes Playwright browser (Chromium headless)
   - Executes each test step sequentially:
     ```javascript
     for (const step of testScript.steps) {
       switch (step.action) {
         case 'navigate':
           await page.goto(step.url);
           await captureScreenshot('navigate');
           break;
         case 'fill':
           await page.fill(step.selector, step.value);
           await captureScreenshot('fill');
           break;
         case 'click':
           await page.click(step.selector);
           await captureScreenshot('click');
           break;
         case 'assert':
           const element = await page.locator(step.selector);
           await expect(element).toBeVisible();
           await captureScreenshot('assert');
           break;
       }
     }
     ```
   - Captures screenshots after each step
   - Handles errors and captures failure screenshots
   - Uploads screenshots to S3
   - Stores execution log in S3
   - Creates TestResult record in DynamoDB
   - Publishes notification to SNS topic
3. Returns result ID to user

### Storage and Evidence Management

1. Screenshots captured during execution are stored in memory
2. After test completion, Storage Lambda:
   - Uploads screenshots to S3 with tenant-specific prefix
   - Uploads execution log JSON to S3
   - Stores metadata in DynamoDB TestResults table
   - Applies S3 lifecycle policies (archive after 90 days)
3. When user requests evidence:
   - Storage Lambda generates presigned URLs (valid for 1 hour)
   - Returns URLs to client for direct S3 access

### Notification Flow

1. Test Execution Lambda publishes message to SNS topic
2. SNS message format:
   ```json
   {
     "resultId": "result-uuid",
     "testId": "test-uuid",
     "status": "PASS",
     "duration": 45000,
     "tenantId": "tenant-uuid",
     "userId": "user-uuid"
   }
   ```
3. SNS triggers n8n webhook or email subscription
4. n8n formats email notification:
   - Subject: "Test Execution {status}: {testId}"
   - Body includes: status, duration, link to results
5. Email sent to user

### Multi-Tenant Isolation

1. All DynamoDB tables use tenantId in partition key or GSI
2. All queries include tenantId filter from JWT token
3. S3 objects stored with tenant-specific prefix
4. Lambda functions validate tenantId matches JWT token
5. Presigned URLs generated only for tenant-owned resources

## Security Considerations

### Authentication & Authorization
- JWT tokens signed with HS256 algorithm
- Token expiration set to 1 hour
- Refresh token mechanism for extended sessions
- Password hashing using bcrypt (cost factor 10)
- API Gateway Lambda Authorizer validates all requests

### Data Encryption
- DynamoDB encryption at rest enabled
- S3 bucket encryption enabled (SSE-S3)
- Secrets stored in AWS Secrets Manager
- Environment credentials encrypted in DynamoDB

### Network Security
- API Gateway enforces HTTPS only
- Lambda functions in VPC (if accessing private resources)
- Security groups restrict Lambda egress
- S3 bucket policies restrict access to Lambda execution roles

### IAM Roles & Policies
- Principle of least privilege
- Separate IAM roles per Lambda function
- S3 bucket policies enforce tenant isolation
- DynamoDB fine-grained access control

## Scalability & Performance

### Lambda Configuration
- Auth Lambda: 256 MB memory, 10s timeout
- Test Generation Lambda: 512 MB memory, 30s timeout
- Test Execution Lambda: 2048 MB memory, 300s timeout
- Storage Lambda: 512 MB memory, 30s timeout
- Report Lambda: 512 MB memory, 30s timeout

### DynamoDB Configuration
- On-demand capacity mode for automatic scaling
- GSIs for efficient querying patterns
- TTL enabled for automatic data cleanup

### S3 Configuration
- Lifecycle policies: archive to Glacier after 90 days
- CloudFront distribution for faster evidence access
- Transfer acceleration for large uploads

### Concurrency Limits
- Reserved concurrency for Test Execution Lambda: 100
- Unreserved concurrency for other Lambdas
- SQS queue for test execution requests (if needed)

## Monitoring & Observability

### CloudWatch Logs
- All Lambda functions log to CloudWatch
- Log retention: 30 days
- Structured logging with JSON format

### CloudWatch Metrics
- Custom metrics:
  - TestGenerationDuration
  - TestExecutionDuration
  - TestSuccessRate
  - TestFailureRate
  - APILatency
- Standard Lambda metrics (invocations, errors, duration)

### CloudWatch Alarms
- Test execution failure rate > 20%
- Lambda error rate > 5%
- API Gateway 5xx errors > 10
- DynamoDB throttling events

### CloudWatch Dashboards
- Real-time test execution status
- Success/failure trends
- Performance metrics
- Cost tracking

## Deployment Strategy

### Infrastructure as Code
- AWS CDK or Terraform for infrastructure provisioning
- Separate stacks for different environments
- Automated deployment pipeline

### CI/CD Pipeline
1. Code commit to repository
2. Run unit tests
3. Build Lambda deployment packages
4. Deploy to Dev environment
5. Run integration tests
6. Deploy to Staging environment
7. Manual approval gate
8. Deploy to Production environment

### Environment Management
- Dev: For development and testing
- Staging: Pre-production validation
- Production: Live customer environment

## Cost Optimization

### Lambda Optimization
- Right-size memory allocation
- Minimize cold starts with provisioned concurrency (if needed)
- Use Lambda layers for shared dependencies

### DynamoDB Optimization
- On-demand pricing for variable workloads
- Efficient query patterns to minimize RCU/WCU
- TTL for automatic data cleanup

### S3 Optimization
- Lifecycle policies to reduce storage costs
- Intelligent-Tiering for automatic cost optimization
- CloudFront caching to reduce data transfer

## Testing Strategy

### Unit Tests
- Test individual Lambda functions
- Mock AWS SDK calls
- Test business logic in isolation

### Integration Tests
- Test API Gateway + Lambda integration
- Test DynamoDB operations
- Test S3 operations
- Test Bedrock integration

### End-to-End Tests
- Test complete workflows
- Test authentication flow
- Test test generation and execution
- Test notification delivery

### Property-Based Tests
- Test tenant isolation properties
- Test data consistency properties
- Test error handling properties

## Future Enhancements

1. Support for additional test frameworks (Selenium, Cypress)
2. Parallel test execution
3. Test scheduling and recurring tests
4. Advanced reporting with charts and trends
5. Integration with CI/CD pipelines
6. Support for mobile app testing
7. AI-powered test maintenance and healing
8. Test result analytics and insights

## Correctness Properties

### Property 1: Tenant Isolation
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

For any two distinct tenants T1 and T2, and any user U1 belonging to T1:
- U1 cannot access test scripts created by users in T2
- U1 cannot access test results created by users in T2
- U1 cannot access S3 evidence belonging to T2
- All DynamoDB queries for U1 return only T1 data

### Property 2: Authentication Token Validity
**Validates: Requirements 1.1, 1.3, 1.4**

For any authentication request:
- Valid credentials always produce a valid JWT token
- Invalid credentials never produce a JWT token
- Expired tokens are always rejected
- Valid tokens always grant access to authorized resources

### Property 3: Test Execution Completeness
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**

For any test execution:
- All test steps are executed in order
- Screenshots are captured for each step
- Execution logs contain all actions
- Final status is always PASS or FAIL
- Execution completes within timeout period

### Property 4: Data Persistence Consistency
**Validates: Requirements 4.1, 4.2, 4.3, 4.5**

For any test execution:
- Test metadata in DynamoDB matches execution results
- All screenshots referenced in metadata exist in S3
- All execution logs referenced in metadata exist in S3
- Data is encrypted at rest

### Property 5: Notification Delivery
**Validates: Requirements 5.1, 5.2, 5.3**

For any completed test execution:
- A notification is always sent
- Notification status matches test result status
- Notification contains correct test metadata

### Property 6: API Response Consistency
**Validates: Requirements 7.4, 7.5**

For any API request:
- Successful requests return 2xx status codes
- Failed requests return appropriate 4xx or 5xx status codes
- All responses contain valid JSON
- Error responses contain descriptive error messages

### Property 7: Workflow State Consistency
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

For any test workflow:
- Test generation completion triggers execution
- Test execution completion triggers storage
- Storage completion triggers notification
- Workflow state in DynamoDB reflects current status
- Failed steps are recorded with error details

### Property 8: Scalability Under Load
**Validates: Requirements 9.1, 9.2, 9.4**

For any load level:
- Lambda functions scale to handle concurrent requests
- Test execution time remains under 5 minutes
- System supports 100+ concurrent executions
- No requests are dropped due to capacity

### Property 9: Presigned URL Security
**Validates: Requirements 4.6, 6.5**

For any presigned URL:
- URLs expire after configured time period
- URLs only grant access to tenant-owned resources
- Expired URLs are rejected
- URLs cannot be used to access other tenants' data

### Property 10: Environment Configuration Isolation
**Validates: Requirements 12.1, 12.2, 12.3, 12.4**

For any test execution:
- Correct environment configuration is used
- Environment-specific URLs are used
- Environment-specific credentials are used
- Invalid environment configurations prevent execution