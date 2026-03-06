# DynamoDB Tables Setup Guide

This guide provides instructions for creating and managing DynamoDB tables for the AI-Powered Automated Testing Platform.

## Overview

The platform uses four DynamoDB tables to store application data:

1. **Users Table** - User authentication and tenant association
2. **Tests Table** - Test scripts and metadata
3. **TestResults Table** - Test execution results and evidence
4. **Environments Table** - Environment-specific configurations

All tables are configured with:
- **Billing Mode**: On-demand (pay-per-request)
- **Encryption**: AWS-managed encryption at rest
- **Point-in-Time Recovery**: Enabled for data protection
- **Global Secondary Indexes (GSIs)**: For efficient query patterns

## Table Schemas

### 1. Users Table

**Table Name**: `ai-testing-users-{environment}`

**Primary Key**:
- Partition Key: `userId` (String)

**Attributes**:
- `userId` - String (UUID)
- `email` - String
- `passwordHash` - String
- `tenantId` - String
- `createdAt` - Number (timestamp)
- `updatedAt` - Number (timestamp)
- `status` - String (ACTIVE, INACTIVE)

**Global Secondary Index**:
- **Index Name**: `tenantId-email-index`
- **Partition Key**: `tenantId` (String)
- **Sort Key**: `email` (String)
- **Purpose**: Query users by tenant and email

### 2. Tests Table

**Table Name**: `ai-testing-tests-{environment}`

**Primary Key**:
- Partition Key: `tenantId` (String)
- Sort Key: `testId` (String)

**Attributes**:
- `testId` - String (UUID)
- `tenantId` - String
- `userId` - String
- `testPrompt` - String
- `testScript` - Map (structured test steps)
- `environment` - String (DEV, STAGING, PROD)
- `createdAt` - Number (timestamp)
- `status` - String (DRAFT, READY, EXECUTING, COMPLETED)

**Global Secondary Index**:
- **Index Name**: `userId-createdAt-index`
- **Partition Key**: `userId` (String)
- **Sort Key**: `createdAt` (Number)
- **Purpose**: Query tests by user and creation time

### 3. TestResults Table

**Table Name**: `ai-testing-results-{environment}`

**Primary Key**:
- Partition Key: `tenantId` (String)
- Sort Key: `resultId` (String)

**Attributes**:
- `resultId` - String (UUID)
- `testId` - String
- `tenantId` - String
- `userId` - String
- `status` - String (PASS, FAIL)
- `startTime` - Number (timestamp)
- `endTime` - Number (timestamp)
- `duration` - Number (milliseconds)
- `screenshotsS3Keys` - List<String>
- `logsS3Key` - String
- `errorMessage` - String (if FAIL)
- `executionLog` - Map

**Global Secondary Index**:
- **Index Name**: `testId-startTime-index`
- **Partition Key**: `testId` (String)
- **Sort Key**: `startTime` (Number)
- **Purpose**: Query results by test and execution time

### 4. Environments Table

**Table Name**: `ai-testing-environments-{environment}`

**Primary Key**:
- Partition Key: `tenantId` (String)
- Sort Key: `environment` (String)

**Attributes**:
- `tenantId` - String
- `environment` - String (DEV, STAGING, PROD)
- `baseUrl` - String
- `credentials` - Map (encrypted)
- `configuration` - Map
- `createdAt` - Number (timestamp)
- `updatedAt` - Number (timestamp)

## Deployment Options

### Option 1: AWS CDK (Recommended)

The tables are defined in the CDK infrastructure code at `infrastructure/lib/stacks/dynamodb-stack.ts`.

To deploy using CDK:

```bash
cd infrastructure
npm install
cdk deploy --all
```

This will create all tables with the correct configuration for your environment.

### Option 2: AWS CLI Script

For manual creation or environments without CDK, use the provided script:

```bash
cd infrastructure/scripts
chmod +x create-dynamodb-tables.sh
./create-dynamodb-tables.sh <environment>
```

Replace `<environment>` with: `dev`, `staging`, or `prod`

Example:
```bash
./create-dynamodb-tables.sh dev
```

### Option 3: AWS Console

You can also create tables manually through the AWS Console. Follow the schemas above and ensure:
- Billing mode is set to "On-demand"
- Encryption is enabled (AWS managed key)
- Point-in-time recovery is enabled
- GSIs are created with the correct keys

## Table Configuration Details

### Billing Mode

All tables use **On-demand** billing mode, which:
- Automatically scales to handle workload
- Charges per request (no capacity planning needed)
- Ideal for unpredictable or variable workloads

### Encryption

All tables use **AWS-managed encryption** (SSE-DynamoDB):
- Data encrypted at rest
- No additional cost
- Automatic key rotation
- Transparent to applications

### Point-in-Time Recovery (PITR)

PITR is enabled on all tables:
- Continuous backups for the last 35 days
- Restore to any point in time within the backup window
- Protection against accidental deletes or updates

### Removal Policy

- **Production**: Tables are retained when stack is deleted (RETAIN)
- **Dev/Staging**: Tables are deleted when stack is deleted (DESTROY)

## Multi-Tenant Isolation

The table design enforces tenant isolation:

1. **Users Table**: GSI allows querying by `tenantId`
2. **Tests Table**: `tenantId` is the partition key
3. **TestResults Table**: `tenantId` is the partition key
4. **Environments Table**: `tenantId` is the partition key

All queries must include the `tenantId` from the authenticated user's JWT token.

## Query Patterns

### Users Table

```javascript
// Get user by userId
const user = await dynamodb.get({
  TableName: 'ai-testing-users-dev',
  Key: { userId: 'user-uuid' }
});

// Query users by tenant
const users = await dynamodb.query({
  TableName: 'ai-testing-users-dev',
  IndexName: 'tenantId-email-index',
  KeyConditionExpression: 'tenantId = :tenantId',
  ExpressionAttributeValues: { ':tenantId': 'tenant-uuid' }
});
```

### Tests Table

```javascript
// Get test by tenantId and testId
const test = await dynamodb.get({
  TableName: 'ai-testing-tests-dev',
  Key: { tenantId: 'tenant-uuid', testId: 'test-uuid' }
});

// Query tests by user
const tests = await dynamodb.query({
  TableName: 'ai-testing-tests-dev',
  IndexName: 'userId-createdAt-index',
  KeyConditionExpression: 'userId = :userId',
  ExpressionAttributeValues: { ':userId': 'user-uuid' }
});
```

### TestResults Table

```javascript
// Get result by tenantId and resultId
const result = await dynamodb.get({
  TableName: 'ai-testing-results-dev',
  Key: { tenantId: 'tenant-uuid', resultId: 'result-uuid' }
});

// Query results by test
const results = await dynamodb.query({
  TableName: 'ai-testing-results-dev',
  IndexName: 'testId-startTime-index',
  KeyConditionExpression: 'testId = :testId',
  ExpressionAttributeValues: { ':testId': 'test-uuid' }
});
```

### Environments Table

```javascript
// Get environment configuration
const env = await dynamodb.get({
  TableName: 'ai-testing-environments-dev',
  Key: { tenantId: 'tenant-uuid', environment: 'DEV' }
});

// Query all environments for tenant
const envs = await dynamodb.query({
  TableName: 'ai-testing-environments-dev',
  KeyConditionExpression: 'tenantId = :tenantId',
  ExpressionAttributeValues: { ':tenantId': 'tenant-uuid' }
});
```

## Monitoring and Maintenance

### CloudWatch Metrics

Monitor these key metrics:
- `ConsumedReadCapacityUnits` - Read throughput
- `ConsumedWriteCapacityUnits` - Write throughput
- `UserErrors` - Client-side errors (4xx)
- `SystemErrors` - Server-side errors (5xx)
- `ThrottledRequests` - Requests exceeding capacity

### Alarms

Set up CloudWatch alarms for:
- High error rates (> 5%)
- Throttled requests (> 0)
- Unusual traffic patterns

### Backup Strategy

1. **Point-in-Time Recovery**: Enabled by default (35-day retention)
2. **On-Demand Backups**: Create before major changes
3. **Cross-Region Replication**: Consider for disaster recovery

### Cost Optimization

1. **Monitor Usage**: Review CloudWatch metrics regularly
2. **Optimize Queries**: Use GSIs efficiently
3. **Data Lifecycle**: Implement TTL for temporary data
4. **Right-Size GSIs**: Only create necessary indexes

## Troubleshooting

### Table Creation Fails

**Error**: "Table already exists"
- **Solution**: Check if table exists with `aws dynamodb describe-table`
- Delete existing table or use a different environment name

**Error**: "Insufficient permissions"
- **Solution**: Ensure IAM user/role has `dynamodb:CreateTable` permission

### Query Performance Issues

**Problem**: Slow queries
- **Solution**: Ensure you're using the correct GSI
- Avoid scans; use queries with partition keys

**Problem**: Throttling errors
- **Solution**: On-demand mode should handle this automatically
- Check for hot partitions or inefficient access patterns

### Data Consistency Issues

**Problem**: Stale data in GSI
- **Solution**: GSIs are eventually consistent; wait a few seconds
- Use strongly consistent reads on base table if needed

## Security Best Practices

1. **IAM Policies**: Use least-privilege access
2. **Encryption**: Keep AWS-managed encryption enabled
3. **VPC Endpoints**: Use VPC endpoints for private access
4. **Audit Logging**: Enable CloudTrail for DynamoDB API calls
5. **Tenant Isolation**: Always filter by tenantId in queries

## Additional Resources

- [AWS DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [CDK DynamoDB Construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb-readme.html)
