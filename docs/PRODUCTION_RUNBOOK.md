# Production Runbook

## Overview

This runbook provides operational procedures for managing the AI Testing Automation Platform in production. It covers deployment, monitoring, troubleshooting, and incident response.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Deployment Procedures](#deployment-procedures)
3. [Monitoring and Alerts](#monitoring-and-alerts)
4. [Incident Response](#incident-response)
5. [Common Issues](#common-issues)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Disaster Recovery](#disaster-recovery)
8. [Contact Information](#contact-information)

---

## System Architecture

### Components

1. **API Gateway** - REST API endpoint
2. **Lambda Functions** (6 total):
   - Auth Lambda
   - Authorizer Lambda
   - Test Generation Lambda
   - Test Execution Lambda
   - Storage Lambda
   - Report Lambda
3. **DynamoDB Tables** (4 total):
   - Users
   - Tests
   - TestResults
   - Environments
4. **S3 Bucket** - Screenshots and logs storage
5. **SNS Topic** - Notifications
6. **CloudWatch** - Logging and monitoring
7. **Secrets Manager** - Sensitive credentials

### AWS Resources

- **Region**: us-east-1 (primary)
- **Account ID**: [YOUR_ACCOUNT_ID]
- **VPC**: [VPC_ID] (if applicable)

---

## Deployment Procedures

### Pre-Deployment Checklist

- [ ] All tests passing in CI/CD pipeline
- [ ] Staging environment validated
- [ ] Deployment window scheduled
- [ ] Team notified
- [ ] Backup created
- [ ] Rollback plan ready

### Standard Deployment

#### Step 1: Verify Staging

```bash
# Run smoke tests against staging
npm run test:smoke -- --env=staging

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=TestExecutionLambda \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

#### Step 2: Create Backup

```bash
# Backup DynamoDB tables
aws dynamodb create-backup \
  --table-name Users \
  --backup-name users-backup-$(date +%Y%m%d-%H%M%S)

aws dynamodb create-backup \
  --table-name Tests \
  --backup-name tests-backup-$(date +%Y%m%d-%H%M%S)

aws dynamodb create-backup \
  --table-name TestResults \
  --backup-name testresults-backup-$(date +%Y%m%d-%H%M%S)

aws dynamodb create-backup \
  --table-name Environments \
  --backup-name environments-backup-$(date +%Y%m%d-%H%M%S)

# Backup S3 bucket (optional - versioning enabled)
aws s3 sync s3://your-bucket s3://your-bucket-backup
```

#### Step 3: Deploy via GitHub Actions

1. Navigate to GitHub repository
2. Go to Actions tab
3. Find the workflow run for `main` branch
4. Click "Review deployments"
5. Select "production" environment
6. Click "Approve and deploy"
7. Monitor deployment progress

#### Step 4: Verify Deployment

```bash
# Check API health
curl https://api.your-domain.com/health

# Run smoke tests
npm run test:smoke -- --env=production

# Check Lambda function versions
aws lambda list-versions-by-function \
  --function-name TestExecutionLambda \
  --max-items 5
```

#### Step 5: Monitor Post-Deployment

- Watch CloudWatch dashboard for 30 minutes
- Check error rates and latency
- Monitor alarm status
- Review Lambda logs for errors

### Emergency Deployment

For critical hotfixes:

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-fix main

# 2. Make fix and commit
git add .
git commit -m "Fix critical issue"

# 3. Push and create PR
git push origin hotfix/critical-fix

# 4. Merge to main after review
# 5. Deploy immediately via GitHub Actions
```

---

## Monitoring and Alerts

### CloudWatch Dashboard

**URL**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=AITestingPlatform

**Key Metrics**:
- API Gateway request count
- Lambda invocation count
- Lambda error rate
- Lambda duration
- DynamoDB read/write capacity
- Test execution success rate

### Critical Alarms

#### 1. High Error Rate

**Alarm**: `HighLambdaErrorRate`
**Threshold**: > 5% error rate
**Action**: Investigate Lambda logs immediately

```bash
# Check recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/TestExecutionLambda \
  --start-time $(date -u -d '15 minutes ago' +%s)000 \
  --filter-pattern "ERROR"
```

#### 2. Test Execution Failures

**Alarm**: `HighTestFailureRate`
**Threshold**: > 20% failure rate
**Action**: Check test execution logs and Playwright issues

```bash
# Query failed test results
aws dynamodb query \
  --table-name TestResults \
  --index-name status-index \
  --key-condition-expression "status = :status" \
  --expression-attribute-values '{":status":{"S":"FAIL"}}' \
  --limit 10
```

#### 3. API Gateway 5xx Errors

**Alarm**: `HighAPIGateway5xxErrors`
**Threshold**: > 10 errors in 5 minutes
**Action**: Check Lambda function health and DynamoDB capacity

```bash
# Check API Gateway logs
aws logs tail /aws/apigateway/AITestingPlatform --follow
```

#### 4. DynamoDB Throttling

**Alarm**: `DynamoDBThrottling`
**Threshold**: > 0 throttled requests
**Action**: Increase table capacity or enable auto-scaling

```bash
# Check table capacity
aws dynamodb describe-table --table-name TestResults

# Update capacity if needed
aws dynamodb update-table \
  --table-name TestResults \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10
```

### Log Locations

- **API Gateway**: `/aws/apigateway/AITestingPlatform`
- **Auth Lambda**: `/aws/lambda/AuthLambda`
- **Test Generation**: `/aws/lambda/TestGenerationLambda`
- **Test Execution**: `/aws/lambda/TestExecutionLambda`
- **Storage**: `/aws/lambda/StorageLambda`
- **Report**: `/aws/lambda/ReportLambda`

---

## Incident Response

### Severity Levels

**P0 - Critical**: Complete service outage
**P1 - High**: Major functionality broken
**P2 - Medium**: Minor functionality impaired
**P3 - Low**: Cosmetic issues or minor bugs

### Incident Response Process

#### 1. Detect

- CloudWatch alarm triggers
- User reports issue
- Monitoring dashboard shows anomaly

#### 2. Assess

```bash
# Check overall system health
aws cloudwatch get-dashboard \
  --dashboard-name AITestingPlatform

# Check recent deployments
git log --oneline -10

# Check Lambda function status
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `AITesting`)].{Name:FunctionName,Status:State}'
```

#### 3. Communicate

- Post in #incidents Slack channel
- Update status page
- Notify stakeholders

#### 4. Mitigate

**For API Gateway issues**:
```bash
# Check API Gateway status
aws apigateway get-rest-apis

# Check stage deployment
aws apigateway get-stage \
  --rest-api-id YOUR_API_ID \
  --stage-name prod
```

**For Lambda issues**:
```bash
# Check Lambda errors
aws lambda get-function \
  --function-name TestExecutionLambda

# View recent invocations
aws lambda get-function-event-invoke-config \
  --function-name TestExecutionLambda
```

**For DynamoDB issues**:
```bash
# Check table status
aws dynamodb describe-table --table-name TestResults

# Check for throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=TestResults \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

#### 5. Resolve

- Apply fix or rollback
- Verify resolution
- Monitor for 30 minutes

#### 6. Document

- Create incident report
- Update runbook
- Schedule post-mortem

---

## Common Issues

### Issue 1: Lambda Function Timeout

**Symptoms**: 
- 504 Gateway Timeout errors
- Lambda duration approaching 5 minutes

**Diagnosis**:
```bash
# Check Lambda duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=TestExecutionLambda \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

**Resolution**:
1. Optimize test scripts to reduce execution time
2. Increase Lambda timeout (max 15 minutes)
3. Break long tests into smaller tests

### Issue 2: DynamoDB Throttling

**Symptoms**:
- 400 errors with "ProvisionedThroughputExceededException"
- Slow API responses

**Diagnosis**:
```bash
# Check consumed capacity
aws dynamodb describe-table --table-name TestResults \
  --query 'Table.ProvisionedThroughput'
```

**Resolution**:
```bash
# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/TestResults \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 5 \
  --max-capacity 100

# Or increase capacity manually
aws dynamodb update-table \
  --table-name TestResults \
  --provisioned-throughput ReadCapacityUnits=20,WriteCapacityUnits=20
```

### Issue 3: S3 Upload Failures

**Symptoms**:
- Screenshots not appearing in reports
- "Failed to upload to S3" errors in logs

**Diagnosis**:
```bash
# Check S3 bucket policy
aws s3api get-bucket-policy --bucket your-bucket

# Check Lambda IAM role permissions
aws iam get-role-policy \
  --role-name TestExecutionLambdaRole \
  --policy-name S3AccessPolicy
```

**Resolution**:
1. Verify S3 bucket exists and is accessible
2. Check Lambda IAM role has S3 write permissions
3. Verify S3 bucket policy allows Lambda access

### Issue 4: Authentication Failures

**Symptoms**:
- 401 Unauthorized errors
- "Invalid token" messages

**Diagnosis**:
```bash
# Check JWT secret in Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id prod/jwt-secret

# Check Authorizer Lambda logs
aws logs tail /aws/lambda/AuthorizerLambda --follow
```

**Resolution**:
1. Verify JWT_SECRET is correctly configured
2. Check token expiration time
3. Verify Authorizer Lambda is attached to API Gateway

### Issue 5: Test Generation Failures

**Symptoms**:
- "Test generation failed" errors
- Bedrock API errors

**Diagnosis**:
```bash
# Check Bedrock service status
aws bedrock list-foundation-models --region us-east-1

# Check Lambda logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/TestGenerationLambda \
  --filter-pattern "Bedrock"
```

**Resolution**:
1. Verify Bedrock access is enabled in AWS account
2. Check IAM permissions for Bedrock
3. Verify model ID is correct (Claude 3.5 Sonnet)
4. Check for rate limiting

---

## Maintenance Procedures

### Daily Tasks

- [ ] Review CloudWatch dashboard
- [ ] Check alarm status
- [ ] Review error logs
- [ ] Monitor test execution success rate

### Weekly Tasks

- [ ] Review and clear old logs (> 30 days)
- [ ] Check S3 storage usage
- [ ] Review DynamoDB capacity utilization
- [ ] Update dependencies if needed
- [ ] Review security scan results

### Monthly Tasks

- [ ] Rotate AWS access keys
- [ ] Update JWT secrets
- [ ] Review and optimize Lambda memory allocation
- [ ] Clean up old DynamoDB backups
- [ ] Review AWS costs
- [ ] Update documentation

### Quarterly Tasks

- [ ] Conduct disaster recovery drill
- [ ] Review and update IAM policies
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Update Node.js runtime version

---

## Disaster Recovery

### Backup Strategy

**DynamoDB**:
- Point-in-time recovery enabled
- Daily automated backups
- 35-day retention period

**S3**:
- Versioning enabled
- Lifecycle policy: 90 days retention
- Cross-region replication (optional)

**Lambda**:
- Code stored in Git repository
- Deployment artifacts in S3

### Recovery Procedures

#### Scenario 1: Complete Region Failure

**Recovery Time Objective (RTO)**: 4 hours
**Recovery Point Objective (RPO)**: 1 hour

**Steps**:
1. Activate backup region
2. Deploy infrastructure to backup region
3. Restore DynamoDB from backup
4. Update DNS to point to new region
5. Verify functionality

#### Scenario 2: DynamoDB Table Corruption

**RTO**: 2 hours
**RPO**: 24 hours

**Steps**:
```bash
# 1. Create new table from backup
aws dynamodb restore-table-from-backup \
  --target-table-name TestResults-Restored \
  --backup-arn arn:aws:dynamodb:us-east-1:ACCOUNT:table/TestResults/backup/BACKUP_ID

# 2. Wait for restore to complete
aws dynamodb describe-table --table-name TestResults-Restored

# 3. Update Lambda environment variables to use new table
aws lambda update-function-configuration \
  --function-name TestExecutionLambda \
  --environment Variables={TESTRESULTS_TABLE=TestResults-Restored}

# 4. Verify functionality
npm run test:smoke
```

#### Scenario 3: Lambda Function Failure

**RTO**: 30 minutes
**RPO**: 0 (no data loss)

**Steps**:
```bash
# 1. Rollback to previous version
aws lambda update-alias \
  --function-name TestExecutionLambda \
  --name prod \
  --function-version PREVIOUS_VERSION

# 2. Verify rollback
aws lambda get-alias \
  --function-name TestExecutionLambda \
  --name prod

# 3. Test functionality
npm run test:smoke
```

#### Scenario 4: S3 Bucket Deletion

**RTO**: 1 hour
**RPO**: 0 (versioning enabled)

**Steps**:
```bash
# 1. Recreate bucket
aws s3 mb s3://your-bucket

# 2. Restore bucket policy
aws s3api put-bucket-policy \
  --bucket your-bucket \
  --policy file://bucket-policy.json

# 3. Enable versioning
aws s3api put-bucket-versioning \
  --bucket your-bucket \
  --versioning-configuration Status=Enabled

# 4. Restore objects from backup or versioning
aws s3 sync s3://your-bucket-backup s3://your-bucket
```

---

## Contact Information

### On-Call Rotation

- **Primary**: [Name] - [Phone] - [Email]
- **Secondary**: [Name] - [Phone] - [Email]
- **Escalation**: [Manager Name] - [Phone] - [Email]

### Support Channels

- **Slack**: #platform-support
- **Email**: support@your-domain.com
- **PagerDuty**: https://your-org.pagerduty.com
- **Status Page**: https://status.your-domain.com

### Vendor Support

- **AWS Support**: 1-800-XXX-XXXX (Enterprise Support)
- **GitHub Support**: support@github.com
- **Snyk Support**: support@snyk.io

### Escalation Path

1. **Level 1**: On-call engineer
2. **Level 2**: Senior engineer
3. **Level 3**: Engineering manager
4. **Level 4**: CTO

---

## Appendix

### Useful Commands

```bash
# Check all Lambda functions
aws lambda list-functions --query 'Functions[].FunctionName'

# Check all DynamoDB tables
aws dynamodb list-tables

# Check S3 bucket size
aws s3 ls s3://your-bucket --recursive --summarize

# Check CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM

# Get API Gateway endpoint
aws apigateway get-rest-apis \
  --query 'items[?name==`AITestingPlatform`].{id:id,name:name}'
```

### Quick Links

- [AWS Console](https://console.aws.amazon.com/)
- [CloudWatch Dashboard](https://console.aws.amazon.com/cloudwatch/)
- [GitHub Repository](https://github.com/your-org/ai-testing-platform)
- [Documentation](https://docs.your-domain.com)
- [API Documentation](https://api.your-domain.com/docs)

---

**Last Updated**: February 20, 2026

**Version**: 1.0.0

**Maintained By**: DevOps Team
