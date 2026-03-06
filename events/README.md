# Test Events for SAM Local

This directory contains sample event payloads for testing Lambda functions locally with AWS SAM.

## Available Events

### Authentication Events

#### `auth-register.json`
Sample event for user registration.

**Usage:**
```bash
sam local invoke AuthFunction -e events/auth-register.json
```

**Payload:**
- email: test@example.com
- password: SecurePass123!
- tenantId: tenant-123

#### `auth-login.json`
Sample event for user login.

**Usage:**
```bash
sam local invoke AuthFunction -e events/auth-login.json
```

**Payload:**
- email: test@example.com
- password: SecurePass123!

### Test Management Events

#### `test-generate.json`
Sample event for generating a test from a natural language prompt.

**Usage:**
```bash
sam local invoke TestGenerationFunction -e events/test-generate.json --env-vars env.json
```

**Payload:**
- testPrompt: "Test login functionality with valid credentials and verify dashboard loads"
- environment: DEV
- Authorization header with JWT token

#### `test-execute.json`
Sample event for executing a test.

**Usage:**
```bash
sam local invoke TestExecutionFunction -e events/test-execute.json --env-vars env.json
```

**Payload:**
- testId: test-456 (path parameter)
- Authorization header with JWT token

## Creating Custom Events

### Method 1: Use SAM CLI Generator

Generate event templates for various AWS services:

```bash
# API Gateway event
sam local generate-event apigateway aws-proxy > events/my-api-event.json

# DynamoDB Stream event
sam local generate-event dynamodb update > events/dynamodb-event.json

# S3 event
sam local generate-event s3 put > events/s3-event.json

# SNS event
sam local generate-event sns notification > events/sns-event.json
```

### Method 2: Copy and Modify Existing Events

1. Copy an existing event file
2. Modify the `body`, `pathParameters`, or `headers` as needed
3. Save with a descriptive name

### Method 3: Capture Real Events

When testing with real AWS services, you can capture actual events from CloudWatch Logs and save them as test events.

## Event Structure

### API Gateway Proxy Event

```json
{
  "body": "{\"key\":\"value\"}",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer token"
  },
  "httpMethod": "POST",
  "path": "/resource",
  "pathParameters": {
    "id": "123"
  },
  "queryStringParameters": {
    "filter": "active"
  },
  "requestContext": {
    "requestId": "request-id",
    "authorizer": {
      "userId": "user-123",
      "tenantId": "tenant-123"
    },
    "identity": {
      "sourceIp": "127.0.0.1"
    }
  }
}
```

### Key Fields

- **body**: JSON string containing the request payload
- **headers**: HTTP headers including Content-Type and Authorization
- **httpMethod**: HTTP method (GET, POST, PUT, DELETE)
- **path**: API path
- **pathParameters**: URL path parameters (e.g., {id})
- **queryStringParameters**: URL query parameters
- **requestContext**: Request metadata including authorizer context

## Testing Authenticated Endpoints

For endpoints that require authentication:

1. **Get a JWT token** by invoking the login endpoint:
   ```bash
   sam local invoke AuthFunction -e events/auth-login.json
   ```

2. **Copy the token** from the response

3. **Update the event file** with the token:
   ```json
   {
     "headers": {
       "Authorization": "Bearer YOUR_TOKEN_HERE"
     }
   }
   ```

4. **Invoke the protected endpoint**:
   ```bash
   sam local invoke TestGenerationFunction -e events/test-generate.json
   ```

## Tips

### Use Environment Variables

Store sensitive data in `env.json` instead of hardcoding in events:

```bash
sam local invoke FunctionName -e events/event.json --env-vars env.json
```

### Test Multiple Scenarios

Create multiple event files for different test cases:
- `auth-login-valid.json` - Valid credentials
- `auth-login-invalid.json` - Invalid credentials
- `auth-login-missing-fields.json` - Missing required fields

### Validate Events

Before invoking, validate your event structure:

```bash
# Check JSON syntax
cat events/my-event.json | jq .

# Validate SAM template
sam validate
```

### Debug Events

Add `console.log` statements in your Lambda handlers to inspect the event structure:

```typescript
export const handler = async (event: any) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  // ... rest of handler
};
```

## Common Issues

### "Cannot parse request body"

**Problem:** Body is not properly JSON-encoded string.

**Solution:** Ensure body is a JSON string, not an object:
```json
{
  "body": "{\"key\":\"value\"}"  // Correct
}
```

Not:
```json
{
  "body": {"key": "value"}  // Incorrect
}
```

### "Missing required parameter"

**Problem:** Event is missing required fields.

**Solution:** Compare your event with the generated template:
```bash
sam local generate-event apigateway aws-proxy
```

### "Authorization failed"

**Problem:** JWT token is invalid or expired.

**Solution:** Generate a fresh token using the login endpoint.

## Resources

- [AWS Lambda Event Sources](https://docs.aws.amazon.com/lambda/latest/dg/lambda-services.html)
- [API Gateway Event Format](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
- [SAM CLI Event Generation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-local-generate-event.html)
