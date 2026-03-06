# Windows Local Development Setup Guide

This guide will help you set up and run the AI Testing Platform on Windows with Docker Desktop.

## Prerequisites

✅ Docker Desktop installed and running
✅ Node.js 18.x or later installed
✅ AWS CLI installed (optional, for manual testing)

## Quick Start (3 Steps)

### Step 1: Start Docker Desktop

1. Open Docker Desktop from your Start menu
2. Wait for it to show "Docker Desktop is running" in the system tray
3. Verify it's running by opening PowerShell and running: `docker ps`

### Step 2: Run the Setup Script

Open PowerShell in the project directory and run:

```powershell
.\scripts\setup-local-windows.ps1
```

This script will:
- ✓ Check if Docker is running
- ✓ Start DynamoDB Local, LocalStack (S3), and DynamoDB Admin UI
- ✓ Create all required DynamoDB tables
- ✓ Create the S3 bucket for test evidence
- ✓ Display a summary of running services

### Step 3: Build and Test

```powershell
# Build the TypeScript code
npm run build

# Run all tests (unit, integration, and E2E)
npm test
```

## What Gets Set Up

### Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| DynamoDB Local | 8000 | Local DynamoDB database |
| DynamoDB Admin UI | 8001 | Web interface to view tables |
| LocalStack | 4566 | Local S3 and SNS services |

### DynamoDB Tables

- `ai-testing-users-local` - User accounts
- `ai-testing-tests-local` - Test scripts
- `ai-testing-results-local` - Test execution results
- `ai-testing-environments-local` - Environment configurations

### S3 Buckets

- `ai-testing-evidence-local` - Screenshots and execution logs

## Running Tests

### Run All Tests
```powershell
npm test
```

### Run Specific Test Suites
```powershell
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# With coverage report
npm run test:coverage
```

## Starting the Local API (Optional)

To run the full API locally with SAM:

```powershell
# Build and start the API
npm run local:dev
```

The API will be available at `http://localhost:3000`

### Test the API

```powershell
# Register a user
curl -X POST http://localhost:3000/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"tenantId\":\"test-tenant\"}'

# Login
curl -X POST http://localhost:3000/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"password\":\"Test123!\"}'
```

## Viewing Local Data

### DynamoDB Admin UI

Open your browser to: http://localhost:8001

This provides a web interface to:
- View all tables
- Browse table data
- Run queries
- Add/edit/delete items

### AWS CLI Commands

```powershell
# List all tables
aws dynamodb list-tables --endpoint-url http://localhost:8000

# Scan Users table
aws dynamodb scan --table-name ai-testing-users-local --endpoint-url http://localhost:8000

# List S3 buckets
aws s3 ls --endpoint-url http://localhost:4566

# List objects in evidence bucket
aws s3 ls s3://ai-testing-evidence-local --endpoint-url http://localhost:4566
```

## Stopping Services

### Stop Docker Services (Keep Data)
```powershell
docker-compose down
```

### Stop and Remove All Data
```powershell
docker-compose down -v
```

## Troubleshooting

### "Docker is not running"

**Solution:** Start Docker Desktop and wait for it to fully start.

```powershell
# Check if Docker is running
docker ps
```

### "Port already in use"

**Solution:** Stop the conflicting service or change the port in `docker-compose.yml`.

```powershell
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### "Cannot connect to LocalStack"

**Solution:** Restart LocalStack container.

```powershell
docker-compose restart localstack
```

### "Table already exists" errors

This is normal if you've run the setup before. The tables are already created and ready to use.

### Tests are failing

1. Make sure Docker services are running:
   ```powershell
   docker ps
   ```

2. Rebuild the project:
   ```powershell
   npm run build
   ```

3. Check if tables exist:
   ```powershell
   aws dynamodb list-tables --endpoint-url http://localhost:8000
   ```

4. Recreate tables if needed:
   ```powershell
   .\scripts\create-local-tables.ps1
   ```

## Test Results

After running `npm test`, you should see:

- **Unit Tests**: ~600+ tests (should all pass)
- **Integration Tests**: ~50+ tests (require Docker services)
- **E2E Tests**: ~20+ tests (require Docker services)

Expected results with Docker running:
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ All E2E tests passing

## Development Workflow

1. **Make code changes** in `src/`
2. **Rebuild**: `npm run build`
3. **Run tests**: `npm test`
4. **View results**: Check test output and coverage report
5. **Iterate**: Repeat steps 1-4

## Useful Docker Commands

```powershell
# View logs from all services
docker-compose logs -f

# View logs from specific service
docker logs ai-testing-dynamodb-local
docker logs ai-testing-localstack

# Restart a specific service
docker-compose restart dynamodb-local

# Check service status
docker-compose ps

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

## Next Steps

- ✅ Run all tests to verify everything works
- ✅ Explore the DynamoDB Admin UI at http://localhost:8001
- ✅ Review test coverage report in `coverage/` directory
- ✅ Read the [API Documentation](docs/API_DOCUMENTATION.md)
- ✅ Check out the [User Guide](docs/USER_GUIDE.md)

## Need Help?

- Check the [Local Development Quickstart](docs/LOCAL_DEV_QUICKSTART.md)
- Review the [Testing Setup Guide](docs/TESTING_SETUP.md)
- See the [Project Structure](docs/PROJECT_STRUCTURE.md)

## Summary

You now have a complete local development environment running:
- ✅ DynamoDB Local for database operations
- ✅ LocalStack for S3 storage
- ✅ All tables and buckets created
- ✅ Ready to run all tests
- ✅ Ready for local API development

Happy testing! 🚀
