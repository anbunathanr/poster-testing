# AI Testing Automation Platform - API Documentation

## Overview

The AI Testing Automation Platform provides a RESTful API for automated test generation and execution using AI-powered test creation with Playwright.

**Base URL**: `https://api.your-domain.com/v1`

**Authentication**: Bearer token (JWT) required for all endpoints except `/auth/*`

---

## Authentication Endpoints

### Register User

Creates a new user account.

**Endpoint**: `POST /auth/register`

**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "tenantId": "tenant-uuid"
}
```

**Response** (201 Created):
```json
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "tenantId": "tenant-uuid",
  "createdAt": 1234567890000
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input (missing fields, invalid email format)
- `409 Conflict`: User already exists
- `500 Internal Server Error`: Server error

---

### Login

Authenticates a user and returns a JWT token.

**Endpoint**: `POST /auth/login`

**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "email": "user@example.com"
}
```

**Error Responses**:
- `400 Bad Request`: Missing email or password
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

---

## Test Management Endpoints

### Generate Test

Generates a new test using AI based on a natural language prompt.

**Endpoint**: `POST /tests/generate`

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "testPrompt": "Test login functionality with valid credentials",
  "environment": "DEV",
  "testName": "Login Test (Optional)"
}
```

**Response** (201 Created):
```json
{
  "testId": "test-uuid",
  "testPrompt": "Test login functionality with valid credentials",
  "testScript": {
    "steps": [
      {
        "action": "navigate",
        "url": "https://example.com/login"
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
        "action": "assert",
        "selector": ".dashboard",
        "condition": "visible"
      }
    ]
  },
  "environment": "DEV",
  "status": "READY",
  "createdAt": 1234567890000
}
```

**Error Responses**:
- `400 Bad Request`: Invalid environment or missing test prompt
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Test generation failed

---

### Execute Test

Executes a generated test using Playwright.

**Endpoint**: `POST /tests/{testId}/execute`

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `testId`: UUID of the test to execute

**Response** (200 OK):
```json
{
  "resultId": "result-uuid",
  "testId": "test-uuid",
  "status": "PASS",
  "startTime": 1234567890000,
  "endTime": 1234567935000,
  "duration": 45000,
  "screenshotsS3Keys": [
    "tenant-uuid/screenshots/result-uuid/step-1.png",
    "tenant-uuid/screenshots/result-uuid/step-2.png"
  ],
  "logsS3Key": "tenant-uuid/logs/result-uuid/execution.log",
  "executionLog": {
    "totalSteps": 5,
    "completedSteps": 5,
    "summary": "All steps completed successfully"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid testId
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Test not found
- `500 Internal Server Error`: Execution failed

---

### List Test Results

Retrieves a paginated list of test results with optional filtering.

**Endpoint**: `GET /tests/results`

**Authentication**: Required (Bearer token)

**Query Parameters**:
- `status` (optional): Filter by status (`PASS`, `FAIL`)
- `startDate` (optional): Filter results after this timestamp (milliseconds)
- `endDate` (optional): Filter results before this timestamp (milliseconds)
- `limit` (optional): Number of results per page (default: 20, max: 100)
- `lastEvaluatedKey` (optional): Pagination token from previous response

**Response** (200 OK):
```json
{
  "results": [
    {
      "resultId": "result-uuid",
      "testId": "test-uuid",
      "status": "PASS",
      "startTime": 1234567890000,
      "endTime": 1234567935000,
      "duration": 45000,
      "environment": "DEV"
    }
  ],
  "lastEvaluatedKey": "pagination-token",
  "count": 1
}
```

**Error Responses**:
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

---

## Report Endpoints

### Get Test Report

Retrieves a detailed report for a specific test execution.

**Endpoint**: `GET /reports/{resultId}`

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `resultId`: UUID of the test result

**Response** (200 OK):
```json
{
  "resultId": "result-uuid",
  "testId": "test-uuid",
  "status": "PASS",
  "executionDetails": {
    "startTime": 1234567890000,
    "endTime": 1234567935000,
    "duration": 45000,
    "environment": "DEV"
  },
  "testScript": {
    "steps": [
      {
        "action": "navigate",
        "url": "https://example.com/login"
      }
    ]
  },
  "evidence": {
    "screenshots": [
      {
        "key": "tenant-uuid/screenshots/result-uuid/step-1.png",
        "url": "https://s3.amazonaws.com/bucket/...?presigned-params",
        "expiresAt": 1234571490000
      }
    ],
    "logs": {
      "key": "tenant-uuid/logs/result-uuid/execution.log",
      "url": "https://s3.amazonaws.com/bucket/...?presigned-params",
      "expiresAt": 1234571490000
    }
  },
  "executionLog": {
    "totalSteps": 5,
    "completedSteps": 5,
    "summary": "All steps completed successfully"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Result not found or access denied
- `500 Internal Server Error`: Server error

---

## Environment Management Endpoints

### Create Environment Configuration

Creates a new environment configuration for a tenant.

**Endpoint**: `POST /environments`

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "environment": "DEV",
  "baseUrl": "https://dev.example.com",
  "credentials": {
    "username": "test-user",
    "password": "test-password"
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
  "credentials": {
    "username": "test-user",
    "password": "***"
  },
  "configuration": {
    "timeout": 30000,
    "retries": 3
  },
  "createdAt": 1234567890000,
  "updatedAt": 1234567890000
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Invalid or missing token
- `409 Conflict`: Environment already exists
- `500 Internal Server Error`: Server error

---

### Get Environment Configuration

Retrieves an environment configuration.

**Endpoint**: `GET /environments/{environment}`

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `environment`: Environment name (`DEV`, `STAGING`, `PROD`)

**Response** (200 OK):
```json
{
  "tenantId": "tenant-uuid",
  "environment": "DEV",
  "baseUrl": "https://dev.example.com",
  "credentials": {
    "username": "test-user",
    "password": "***"
  },
  "configuration": {
    "timeout": 30000,
    "retries": 3
  },
  "createdAt": 1234567890000,
  "updatedAt": 1234567890000
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Environment not found
- `500 Internal Server Error`: Server error

---

### Update Environment Configuration

Updates an existing environment configuration.

**Endpoint**: `PUT /environments/{environment}`

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `environment`: Environment name (`DEV`, `STAGING`, `PROD`)

**Request Body**:
```json
{
  "baseUrl": "https://dev-updated.example.com",
  "credentials": {
    "username": "new-user",
    "password": "new-password"
  },
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
  "baseUrl": "https://dev-updated.example.com",
  "credentials": {
    "username": "new-user",
    "password": "***"
  },
  "configuration": {
    "timeout": 60000,
    "retries": 5
  },
  "createdAt": 1234567890000,
  "updatedAt": 1234567900000
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Environment not found
- `500 Internal Server Error`: Server error

---

### Delete Environment Configuration

Deletes an environment configuration.

**Endpoint**: `DELETE /environments/{environment}`

**Authentication**: Required (Bearer token)

**Path Parameters**:
- `environment`: Environment name (`DEV`, `STAGING`, `PROD`)

**Response** (204 No Content)

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Environment not found
- `500 Internal Server Error`: Server error

---

### List Environments

Lists all environment configurations for the authenticated tenant.

**Endpoint**: `GET /environments`

**Authentication**: Required (Bearer token)

**Response** (200 OK):
```json
{
  "environments": [
    {
      "environment": "DEV",
      "baseUrl": "https://dev.example.com",
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000
    },
    {
      "environment": "STAGING",
      "baseUrl": "https://staging.example.com",
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000
    }
  ],
  "count": 2
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "timestamp": 1234567890000
}
```

---

## Rate Limiting

- **Rate Limit**: 100 requests per minute per tenant
- **Burst Limit**: 200 requests
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests per minute
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Timestamp when the rate limit resets

When rate limit is exceeded, the API returns `429 Too Many Requests`.

---

## Pagination

List endpoints support pagination using the following pattern:

1. Initial request returns results and a `lastEvaluatedKey`
2. Subsequent requests include `lastEvaluatedKey` as a query parameter
3. When `lastEvaluatedKey` is not present in the response, there are no more results

---

## Tenant Isolation

All data is isolated by tenant. Users can only access data belonging to their tenant. Attempting to access data from another tenant will result in a `404 Not Found` response.

---

## Supported Test Actions

The following actions are supported in generated test scripts:

### navigate
Navigates to a URL.
```json
{
  "action": "navigate",
  "url": "https://example.com"
}
```

### fill
Fills an input field with a value.
```json
{
  "action": "fill",
  "selector": "#email",
  "value": "test@example.com"
}
```

### click
Clicks an element.
```json
{
  "action": "click",
  "selector": "button[type='submit']"
}
```

### assert
Asserts that an element meets a condition.
```json
{
  "action": "assert",
  "selector": ".success-message",
  "condition": "visible"
}
```

Supported conditions:
- `visible`: Element is visible
- `hidden`: Element is hidden
- `exists`: Element exists in DOM

### waitForNavigation
Waits for page navigation to complete.
```json
{
  "action": "waitForNavigation"
}
```

---

## Webhooks and Notifications

The platform sends notifications via SNS when test executions complete. You can subscribe to these notifications via:

1. **Email**: Subscribe your email to the SNS topic
2. **Webhook (n8n)**: Configure a webhook URL to receive JSON payloads

### Notification Payload

```json
{
  "subject": "✅ Test Passed: Login Test",
  "message": "Test execution completed successfully...",
  "metadata": {
    "testId": "test-uuid",
    "resultId": "result-uuid",
    "status": "PASS",
    "duration": 45000,
    "tenantId": "tenant-uuid",
    "userId": "user-uuid",
    "environment": "DEV"
  }
}
```

---

## Best Practices

1. **Token Management**: Store JWT tokens securely and refresh before expiration
2. **Error Handling**: Implement retry logic with exponential backoff for 5xx errors
3. **Rate Limiting**: Implement client-side rate limiting to avoid 429 errors
4. **Pagination**: Always handle pagination for list endpoints
5. **Timeouts**: Set appropriate timeouts for test execution (max 5 minutes)
6. **Environment Configuration**: Store credentials securely and rotate regularly

---

## Support

For API support, contact: support@your-domain.com

For bug reports and feature requests, visit: https://github.com/your-org/ai-testing-platform/issues
