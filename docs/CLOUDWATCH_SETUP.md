# CloudWatch Setup Guide

This guide provides instructions for setting up CloudWatch log groups, metric namespaces, dashboards, and alarms for the AI Testing Automation Platform.

## Overview

The platform uses CloudWatch for comprehensive monitoring and observability:
- **Log Groups**: Centralized logging for all Lambda functions
- **Custom Metrics**: Application-specific metrics in the `AiTestingPlatform` namespace
- **Dashboards**: Real-time visualization of system health and performance
- **Alarms**: Automated alerting for critical issues

## Prerequisites

- AWS CLI configured with appropriate credentials
- Permissions to create CloudWatch resources
- SNS topic for alarm notifications (optional)

## Quick Setup

Run the automated setup script:

```bash
cd infrastructure/scripts
chmod +x setup-cloudwatch.sh
./setup-cloudwatch.sh <environment> [alarm-email]
```

Example:
```bash
./setup-cloudwatch.sh dev admin@example.com
```

## Manual Setup

### 1. Log Groups

Create log groups for each Lambda function with 30-day retention:

```bash
# Auth Lambda
aws logs create-log-group --log-group-name /aws/lambda/ai-testing-auth-dev
aws logs put-retention-policy --log-group-name /aws/lambda/ai-testing-auth-dev --retention-in-days 30

# Test Generation Lambda
aws logs create-log-group --log-group-name /aws/lambda/ai-testing-test-generation-dev
aws logs put-retention-policy --log-group-name /aws/lambda/ai-testing-test-generation-dev --retention-in-days 30

# Test Execution Lambda
aws logs create-log-group --log-group-name /aws/lambda/ai-testing-test-execution-dev
aws logs put-retention-policy --log-group-name /aws/lambda/ai-testing-test-execution-dev --retention-in-days 30

# Storage Lambda
aws logs create-log-group --log-group-name /aws/lambda/ai-testing-storage-dev
aws logs put-retention-policy --log-group-name /aws/lambda/ai-testing-storage-dev --retention-in-days 30

# Report Lambda
aws logs create-log-group --log-group-name /aws/lambda/ai-testing-report-dev
aws logs put-retention-policy --log-group-name /aws/lambda/ai-testing-report-dev --retention-in-days 30
```

### 2. Custom Metric Namespace

The platform uses the `AiTestingPlatform` namespace for custom metrics. No pre-creation is required; metrics are created when first published by Lambda functions.

#### Custom Metrics

| Metric Name | Description | Unit | Dimensions |
|-------------|-------------|------|------------|
| `TestSuccessRate` | Percentage of successful test executions | Percent | Environment, TenantId |
| `TestExecutionDuration` | Time taken to execute tests | Milliseconds | Environment, TenantId |
| `TestGenerationDuration` | Time taken to generate tests with AI | Milliseconds | Environment, TenantId |
| `TestFailureRate` | Percentage of failed test executions | Percent | Environment, TenantId |
| `APILatency` | API Gateway response time | Milliseconds | Endpoint, Method |

### 3. SNS Topic for Alarms

Create an SNS topic for alarm notifications:

```bash
aws sns create-topic --name ai-testing-alarms-dev

# Subscribe email to topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev \
  --protocol email \
  --notification-endpoint admin@example.com
```

### 4. CloudWatch Alarms

#### Lambda Error Rate Alarms

```bash
# Auth Lambda Error Rate
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-auth-dev-error-rate \
  --alarm-description "Alert when auth lambda error rate exceeds threshold" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=ai-testing-auth-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev

# Test Generation Lambda Error Rate
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-test-generation-dev-error-rate \
  --alarm-description "Alert when test generation lambda error rate exceeds threshold" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=ai-testing-test-generation-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev

# Test Execution Lambda Error Rate
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-test-execution-dev-error-rate \
  --alarm-description "Alert when test execution lambda error rate exceeds threshold" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=ai-testing-test-execution-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev

# Storage Lambda Error Rate
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-storage-dev-error-rate \
  --alarm-description "Alert when storage lambda error rate exceeds threshold" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=ai-testing-storage-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev

# Report Lambda Error Rate
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-report-dev-error-rate \
  --alarm-description "Alert when report lambda error rate exceeds threshold" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=ai-testing-report-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev
```

#### API Gateway Alarms

```bash
# API Gateway 5xx Errors
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-api-dev-5xx-errors \
  --alarm-description "Alert when API Gateway 5xx errors exceed threshold" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ApiName,Value=ai-testing-platform-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev
```

#### Custom Metric Alarms

```bash
# Test Failure Rate
aws cloudwatch put-metric-alarm \
  --alarm-name test-failure-rate-dev \
  --alarm-description "Alert when test success rate drops below 80%" \
  --metric-name TestSuccessRate \
  --namespace AiTestingPlatform \
  --statistic Average \
  --period 300 \
  --evaluation-periods 3 \
  --threshold 0.8 \
  --comparison-operator LessThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev
```

#### DynamoDB Alarms

```bash
# Users Table Throttling
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-users-table-dev-throttling \
  --alarm-description "Alert when Users table experiences throttling" \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=ai-testing-users-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev

# Tests Table Throttling
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-tests-table-dev-throttling \
  --alarm-description "Alert when Tests table experiences throttling" \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=ai-testing-tests-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev

# TestResults Table Throttling
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-test-results-table-dev-throttling \
  --alarm-description "Alert when TestResults table experiences throttling" \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=ai-testing-test-results-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev

# Environments Table Throttling
aws cloudwatch put-metric-alarm \
  --alarm-name ai-testing-environments-table-dev-throttling \
  --alarm-description "Alert when Environments table experiences throttling" \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=ai-testing-environments-dev \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-alarms-dev
```

### 5. CloudWatch Dashboard

Create a dashboard for monitoring (dashboard JSON is generated by the script):

```bash
aws cloudwatch put-dashboard \
  --dashboard-name ai-testing-platform-dev \
  --dashboard-body file://dashboard-config.json
```

## Publishing Custom Metrics from Lambda

Lambda functions should publish custom metrics using the CloudWatch SDK:

```typescript
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

// Publish test success rate
await cloudwatch.putMetricData({
  Namespace: 'AiTestingPlatform',
  MetricData: [
    {
      MetricName: 'TestSuccessRate',
      Value: successRate,
      Unit: 'Percent',
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT },
        { Name: 'TenantId', Value: tenantId }
      ]
    }
  ]
}).promise();

// Publish test execution duration
await cloudwatch.putMetricData({
  Namespace: 'AiTestingPlatform',
  MetricData: [
    {
      MetricName: 'TestExecutionDuration',
      Value: duration,
      Unit: 'Milliseconds',
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'Environment', Value: process.env.ENVIRONMENT },
        { Name: 'TenantId', Value: tenantId }
      ]
    }
  ]
}).promise();
```

## Viewing Logs

### CloudWatch Logs Insights

Query logs across all Lambda functions:

```sql
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

Query test execution logs:

```sql
fields @timestamp, testId, status, duration
| filter @message like /Test execution/
| stats count() by status
```

### Live Tail

Monitor logs in real-time:

```bash
aws logs tail /aws/lambda/ai-testing-test-execution-dev --follow
```

## Dashboard Widgets

The CloudWatch dashboard includes:

1. **Lambda Metrics** (per function):
   - Invocations (count)
   - Errors (count)
   - Duration (average)

2. **API Gateway Metrics**:
   - Request count
   - 4xx errors
   - 5xx errors
   - Latency

3. **DynamoDB Metrics** (per table):
   - Throttling events

4. **Custom Test Metrics**:
   - Test success rate
   - Test execution duration
   - Test generation duration

## Alarm Actions

When alarms trigger:
1. SNS notification sent to subscribed email addresses
2. Email contains alarm details and metric values
3. Investigate using CloudWatch Logs Insights
4. Check dashboard for related metrics
5. Review Lambda function logs for errors

## Cost Optimization

- Log retention set to 30 days to balance observability and cost
- Alarms use 5-minute periods to reduce evaluation costs
- Dashboard refreshes every 1 minute
- Consider using CloudWatch Logs Insights sparingly for complex queries

## Troubleshooting

### Log Group Not Found
Ensure Lambda functions have been invoked at least once. Log groups are created automatically on first invocation.

### Metrics Not Appearing
- Verify Lambda functions are publishing metrics correctly
- Check IAM permissions for CloudWatch PutMetricData
- Allow up to 15 minutes for metrics to appear

### Alarms Not Triggering
- Verify SNS topic subscription is confirmed
- Check alarm configuration and thresholds
- Ensure metrics are being published with correct dimensions

## CDK Deployment

The monitoring stack is automatically deployed via CDK:

```bash
cd infrastructure
npm run cdk deploy MonitoringStack -- --context environment=dev
```

This creates all log groups, alarms, and dashboards automatically.

## References

- [CloudWatch Logs Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [CloudWatch Metrics Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/)
- [CloudWatch Alarms Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- Design Document: `.kiro/specs/ai-testing-automation-platform/design.md`
- Monitoring Stack: `infrastructure/lib/stacks/monitoring-stack.ts`
