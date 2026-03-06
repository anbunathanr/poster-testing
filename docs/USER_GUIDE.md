# AI Testing Automation Platform - User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Creating Your First Test](#creating-your-first-test)
4. [Executing Tests](#executing-tests)
5. [Viewing Test Results](#viewing-test-results)
6. [Managing Environments](#managing-environments)
7. [Understanding Test Reports](#understanding-test-reports)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [FAQs](#faqs)

---

## Introduction

The AI Testing Automation Platform enables you to create and execute automated browser tests using natural language descriptions. The platform uses AI to generate Playwright test scripts from your descriptions, executes them in a headless browser, and provides detailed reports with screenshots and logs.

### Key Features

- **AI-Powered Test Generation**: Describe your test in plain English, and AI generates the test script
- **Automated Execution**: Tests run in a headless Chromium browser with Playwright
- **Detailed Reports**: Get screenshots, logs, and execution details for every test
- **Multi-Environment Support**: Configure and test against DEV, STAGING, and PROD environments
- **Real-Time Notifications**: Receive email or webhook notifications when tests complete
- **Tenant Isolation**: Your data is completely isolated from other tenants

---

## Getting Started

### Step 1: Register an Account

1. Navigate to the registration page
2. Provide your email address, password, and tenant ID
3. Click "Register"
4. You'll receive a confirmation with your user ID

**Example Registration Request**:
```bash
curl -X POST https://api.your-domain.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "SecurePassword123!",
    "tenantId": "your-tenant-id"
  }'
```

### Step 2: Login

1. Navigate to the login page
2. Enter your email and password
3. Click "Login"
4. Save the JWT token returned - you'll need it for all API requests

**Example Login Request**:
```bash
curl -X POST https://api.your-domain.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "SecurePassword123!"
  }'
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user-uuid",
  "tenantId": "tenant-uuid",
  "email": "your-email@example.com"
}
```

### Step 3: Configure Your Environment

Before creating tests, configure at least one environment (DEV, STAGING, or PROD):

```bash
curl -X POST https://api.your-domain.com/v1/environments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "environment": "DEV",
    "baseUrl": "https://dev.your-app.com",
    "credentials": {
      "username": "test-user",
      "password": "test-password"
    },
    "configuration": {
      "timeout": 30000
    }
  }'
```

---

## Creating Your First Test

### Step 1: Write a Test Description

Think about what you want to test and describe it in plain English. Be specific about:
- What page to visit
- What actions to perform
- What to verify

**Good Examples**:
- "Test login functionality with valid credentials"
- "Verify that the shopping cart updates when adding items"
- "Test password reset flow with email verification"

**Poor Examples**:
- "Test the website" (too vague)
- "Click button" (missing context)

### Step 2: Generate the Test

Use the `/tests/generate` endpoint to create your test:

```bash
curl -X POST https://api.your-domain.com/v1/tests/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "testPrompt": "Test login functionality with valid credentials",
    "environment": "DEV",
    "testName": "Login Test"
  }'
```

**Response**:
```json
{
  "testId": "test-uuid",
  "testPrompt": "Test login functionality with valid credentials",
  "testScript": {
    "steps": [
      {
        "action": "navigate",
        "url": "https://dev.your-app.com/login"
      },
      {
        "action": "fill",
        "selector": "#email",
        "value": "test-user"
      },
      {
        "action": "fill",
        "selector": "#password",
        "value": "test-password"
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

### Step 3: Review the Generated Test

The AI generates a test script with specific steps. Review the steps to ensure they match your expectations:

- **navigate**: Goes to a URL
- **fill**: Fills an input field
- **click**: Clicks an element
- **assert**: Verifies an element's state
- **waitForNavigation**: Waits for page navigation

If the test doesn't look right, try regenerating with a more detailed description.

---

## Executing Tests

### Run a Test

Once you have a generated test, execute it using the `/tests/{testId}/execute` endpoint:

```bash
curl -X POST https://api.your-domain.com/v1/tests/test-uuid/execute \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
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
  "logsS3Key": "tenant-uuid/logs/result-uuid/execution.log"
}
```

### Execution Time

- Tests have a maximum execution time of 5 minutes
- If a test exceeds this limit, it will be terminated and marked as FAIL
- Optimize your tests to complete within this timeframe

### What Happens During Execution

1. **Browser Launch**: A headless Chromium browser is launched
2. **Step Execution**: Each step in your test script is executed sequentially
3. **Screenshot Capture**: Screenshots are captured after each step
4. **Error Handling**: If a step fails, a failure screenshot is captured
5. **Result Storage**: Results, screenshots, and logs are stored in S3
6. **Notification**: You receive a notification when the test completes

---

## Viewing Test Results

### List All Test Results

Get a list of all your test results with optional filtering:

```bash
curl -X GET "https://api.your-domain.com/v1/tests/results?status=PASS&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters**:
- `status`: Filter by PASS or FAIL
- `startDate`: Filter results after this timestamp
- `endDate`: Filter results before this timestamp
- `limit`: Number of results per page (default: 20, max: 100)

**Response**:
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

### Get Detailed Test Report

Retrieve a detailed report for a specific test execution:

```bash
curl -X GET https://api.your-domain.com/v1/reports/result-uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
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
    "steps": [...]
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
  }
}
```

### Accessing Screenshots and Logs

The report includes presigned URLs for screenshots and logs. These URLs:
- Are valid for 1 hour
- Provide direct access to the files in S3
- Expire after the specified time

Click the URLs to view or download the files.

---

## Managing Environments

### Create an Environment

Configure a new environment for testing:

```bash
curl -X POST https://api.your-domain.com/v1/environments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "environment": "STAGING",
    "baseUrl": "https://staging.your-app.com",
    "credentials": {
      "username": "staging-user",
      "password": "staging-password"
    },
    "configuration": {
      "timeout": 60000,
      "retries": 3
    }
  }'
```

### Update an Environment

Modify an existing environment configuration:

```bash
curl -X PUT https://api.your-domain.com/v1/environments/STAGING \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "baseUrl": "https://new-staging.your-app.com",
    "credentials": {
      "username": "new-user",
      "password": "new-password"
    }
  }'
```

### List All Environments

View all configured environments:

```bash
curl -X GET https://api.your-domain.com/v1/environments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Delete an Environment

Remove an environment configuration:

```bash
curl -X DELETE https://api.your-domain.com/v1/environments/STAGING \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Understanding Test Reports

### Test Status

- **PASS**: All test steps completed successfully
- **FAIL**: One or more test steps failed

### Execution Details

- **Start Time**: When the test execution began
- **End Time**: When the test execution completed
- **Duration**: Total execution time in milliseconds
- **Environment**: Which environment the test ran against

### Evidence

- **Screenshots**: Visual proof of each step execution
- **Logs**: Detailed execution logs with timestamps and actions

### Failure Analysis

When a test fails, the report includes:
- **Error Message**: Description of what went wrong
- **Failed Step**: Which step in the test script failed
- **Failure Screenshot**: Screenshot captured at the moment of failure
- **Stack Trace**: Technical details for debugging

---

## Best Practices

### Writing Test Descriptions

1. **Be Specific**: Include exact actions and expected outcomes
2. **Use Real Scenarios**: Describe realistic user workflows
3. **One Goal Per Test**: Focus each test on a single functionality
4. **Include Verification**: Always specify what should be verified

### Test Execution

1. **Test in Order**: Test DEV → STAGING → PROD
2. **Monitor Results**: Check test results regularly
3. **Fix Failures Quickly**: Address failing tests promptly
4. **Rotate Credentials**: Update environment credentials regularly

### Performance

1. **Optimize Test Steps**: Remove unnecessary waits and actions
2. **Use Specific Selectors**: Use IDs or unique selectors for reliability
3. **Limit Test Scope**: Keep tests focused and concise
4. **Batch Executions**: Run multiple tests together when possible

### Security

1. **Secure Tokens**: Never share or expose your JWT tokens
2. **Rotate Passwords**: Change environment passwords regularly
3. **Use Strong Passwords**: Ensure all passwords meet security requirements
4. **Monitor Access**: Review test execution logs for unusual activity

---

## Troubleshooting

### Test Generation Issues

**Problem**: AI generates incorrect test steps

**Solution**:
- Provide more detailed description
- Include specific element selectors if known
- Break complex tests into smaller tests

**Problem**: Test generation fails with 500 error

**Solution**:
- Check that your environment is configured
- Verify your token is valid
- Try again with a simpler description

### Test Execution Issues

**Problem**: Test fails with "Element not found"

**Solution**:
- Verify the selector exists on the page
- Check if the page loaded completely
- Add wait steps if needed

**Problem**: Test times out after 5 minutes

**Solution**:
- Optimize test steps to reduce execution time
- Remove unnecessary waits
- Break into smaller tests

**Problem**: Screenshots are not captured

**Solution**:
- Check S3 bucket permissions
- Verify test execution completed
- Contact support if issue persists

### Authentication Issues

**Problem**: 401 Unauthorized error

**Solution**:
- Verify your token is valid and not expired
- Re-login to get a new token
- Check that token is included in Authorization header

**Problem**: Cannot access test results

**Solution**:
- Verify you're using the correct tenant
- Check that the test belongs to your tenant
- Ensure you have proper permissions

---

## FAQs

### How long are JWT tokens valid?

JWT tokens are valid for 24 hours. After expiration, you'll need to login again to get a new token.

### Can I edit generated test scripts?

Currently, test scripts cannot be edited after generation. If you need changes, generate a new test with an updated description.

### How long are test results stored?

Test results are stored indefinitely. Screenshots and logs are retained for 90 days by default.

### Can I run tests in parallel?

Yes, you can execute multiple tests simultaneously. Each test runs in its own isolated browser instance.

### What browsers are supported?

Currently, only Chromium (headless) is supported. Support for Firefox and Safari is planned for future releases.

### How do I get notified when tests complete?

Configure email or webhook notifications through SNS. Contact your administrator for setup instructions.

### Can I schedule recurring tests?

Scheduled test execution is planned for a future release. Currently, tests must be triggered manually via API.

### What happens if my test fails?

When a test fails:
1. A failure screenshot is captured
2. Error details are logged
3. You receive a notification
4. The test result is marked as FAIL

### How do I debug failing tests?

1. Review the failure screenshot
2. Check the execution logs
3. Verify the test script steps
4. Test manually in the target environment
5. Regenerate the test with more specific instructions

### Can I test mobile applications?

Mobile app testing is not currently supported. The platform focuses on web application testing.

---

## Support

For additional help:

- **Email**: support@your-domain.com
- **Documentation**: https://docs.your-domain.com
- **API Reference**: https://api.your-domain.com/docs
- **GitHub Issues**: https://github.com/your-org/ai-testing-platform/issues

---

## Next Steps

Now that you understand the basics:

1. Create your first test
2. Execute it and review the results
3. Configure additional environments
4. Set up notifications
5. Integrate with your CI/CD pipeline

Happy testing! 🚀
