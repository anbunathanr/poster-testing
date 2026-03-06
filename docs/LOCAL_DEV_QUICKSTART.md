# Local Development Quick Start Guide

This guide will get you up and running with local development in under 5 minutes.

## Prerequisites

Ensure you have installed:
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (running)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- [AWS CLI](https://aws.amazon.com/cli/)
- Node.js 18.x or later

## Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Start Local Services

This command starts DynamoDB Local, LocalStack (S3), and creates all necessary tables and buckets:

```bash
npm run local:setup
```

Wait for the setup to complete. You should see:
- ✓ Users table created
- ✓ Tests table created
- ✓ TestResults table created
- ✓ Environments table created
- ✓ S3 bucket created

### Step 3: Start SAM Local API

```bash
npm run local:dev
```

This builds your TypeScript code and starts the local API Gateway at `http://127.0.0.1:3000`.

## Testing Your Setup

### Test 1: Register a User

```bash
curl -X POST http://127.0.0.1:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "DevPass123!",
    "tenantId": "dev-tenant"
  }'
```

Expected response:
```json
{
  "userId": "...",
  "email": "dev@example.com",
  "tenantId": "dev-tenant"
}
```

### Test 2: Login

```bash
curl -X POST http://127.0.0.1:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "DevPass123!"
  }'
```

Expected response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "userId": "...",
  "tenantId": "dev-tenant"
}
```

Save the token for authenticated requests!

### Test 3: Generate a Test (Requires AWS Bedrock Access)

```bash
# Replace YOUR_TOKEN with the token from login
curl -X POST http://127.0.0.1:3000/tests/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "testPrompt": "Test login with valid credentials",
    "environment": "DEV"
  }'
```

## Available Endpoints

Once SAM is running, these endpoints are available:

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `POST /tests/generate` - Generate test from prompt (requires auth)
- `POST /tests/{testId}/execute` - Execute test (requires auth)
- `GET /tests/{testId}/results/{resultId}` - Get test result (requires auth)
- `GET /tests/results` - List test results (requires auth)
- `GET /reports/{resultId}` - Get test report (requires auth)

## Useful Commands

### View Local DynamoDB Tables

```bash
# List all tables
aws dynamodb list-tables --endpoint-url http://localhost:8000

# Scan Users table
aws dynamodb scan --table-name ai-testing-users-local --endpoint-url http://localhost:8000
```

### View Local S3 Buckets

```bash
# List buckets
aws s3 ls --endpoint-url http://localhost:4566

# List objects in evidence bucket
aws s3 ls s3://ai-testing-evidence-local --endpoint-url http://localhost:4566
```

### View DynamoDB Admin UI

Open your browser to: http://localhost:8001

This provides a web interface to view and manage your local DynamoDB tables.

### View Docker Logs

```bash
# View all logs
npm run docker:logs

# View specific service
docker logs ai-testing-dynamodb-local
docker logs ai-testing-localstack
```

### Invoke Lambda Functions Directly

```bash
# Test auth login
npm run sam:invoke:auth

# Test test generation
npm run sam:invoke:testgen

# Test test execution
npm run sam:invoke:testexec
```

## Debugging

### Enable Debug Mode

Start SAM with debug port:

```bash
npm run sam:start:debug
```

Then attach your debugger to port 5858.

### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to SAM Local",
      "type": "node",
      "request": "attach",
      "address": "localhost",
      "port": 5858,
      "localRoot": "${workspaceFolder}/dist",
      "remoteRoot": "/var/task",
      "protocol": "inspector",
      "stopOnEntry": false,
      "sourceMaps": true
    }
  ]
}
```

## Stopping Services

### Stop SAM API

Press `Ctrl+C` in the terminal running SAM.

### Stop Docker Services

```bash
npm run docker:down
```

### Clean Everything (Remove Data)

```bash
npm run local:clean
```

This removes all Docker containers and volumes, deleting all local data.

## Troubleshooting

### "Cannot connect to Docker daemon"

**Solution:** Ensure Docker Desktop is running.

```bash
docker ps
```

### "Port already in use"

**Solution:** Stop the conflicting service or change the port.

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
sam local start-api --port 3001 --env-vars env.json
```

### "Module not found" errors

**Solution:** Rebuild the project.

```bash
npm run build
```

### DynamoDB tables not found

**Solution:** Recreate the tables.

```bash
chmod +x scripts/create-local-tables.sh
./scripts/create-local-tables.sh
```

### S3 bucket not found

**Solution:** Recreate the bucket.

```bash
chmod +x scripts/create-local-s3.sh
./scripts/create-local-s3.sh
```

### Lambda timeout errors

**Solution:** Increase timeout in `template.yaml` or use `--timeout` flag.

```bash
sam local invoke AuthFunction -e events/auth-login.json --timeout 60
```

## Development Workflow

1. **Make code changes** in `src/`
2. **Rebuild**: `npm run build`
3. **Test locally**: Use curl or Postman to test endpoints
4. **Debug**: Use `npm run sam:start:debug` and attach debugger
5. **Iterate**: Repeat steps 1-4

## Next Steps

- Read the full [SAM Local Development Guide](./SAM_LOCAL_DEVELOPMENT.md)
- Explore the [API documentation](../README.md#api-endpoints)
- Set up [CI/CD integration](./SAM_LOCAL_DEVELOPMENT.md#integration-with-cicd)
- Configure [debugging in your IDE](./SAM_LOCAL_DEVELOPMENT.md#debugging-lambda-functions)

## Common Development Tasks

### Add a New Lambda Function

1. Create handler in `src/lambdas/your-function/index.ts`
2. Add function definition to `template.yaml`
3. Add environment variables to `env.json`
4. Rebuild: `npm run build`
5. Test: `sam local invoke YourFunction -e events/your-event.json`

### Test with Real AWS Services

To test with real AWS DynamoDB/S3 instead of local:

1. Remove `DYNAMODB_ENDPOINT` and `S3_ENDPOINT` from `env.json`
2. Ensure AWS credentials are configured: `aws configure`
3. Start SAM: `npm run sam:start:env`

### Create Custom Test Events

1. Create JSON file in `events/` directory
2. Use SAM to generate template: `sam local generate-event apigateway aws-proxy > events/my-event.json`
3. Customize the event data
4. Invoke: `sam local invoke FunctionName -e events/my-event.json`

## Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [DynamoDB Local Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [Project README](../README.md)
