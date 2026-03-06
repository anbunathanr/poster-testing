# AWS Deployment Checklist

Quick reference checklist for deploying the AI Testing Automation Platform to AWS.

## Pre-Deployment

- [ ] AWS Account created with admin access
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS CLI configured (`aws configure`)
- [ ] Node.js 18.x+ installed (`node --version`)
- [ ] Project dependencies installed (`npm install`)
- [ ] Project builds successfully (`npm run build`)
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] AWS CDK installed globally (`npm install -g aws-cdk`)

## AWS Setup

- [ ] IAM user created for deployment
- [ ] Access keys generated and saved securely
- [ ] AWS CLI profile configured
- [ ] CDK bootstrapped (`cdk bootstrap`)
- [ ] JWT secret generated (32+ characters)
- [ ] `.env` file created with required variables

## Infrastructure Deployment

- [ ] Review infrastructure code in `infrastructure/lib/`
- [ ] Synthesize CloudFormation template (`cdk synth`)
- [ ] Deploy to Dev environment (`cdk deploy --context environment=dev`)
- [ ] Verify CloudFormation stack created successfully
- [ ] Note API Gateway URL from outputs
- [ ] Verify all resources created:
  - [ ] DynamoDB tables (4 tables)
  - [ ] S3 bucket
  - [ ] Lambda functions (6 functions)
  - [ ] API Gateway
  - [ ] CloudWatch log groups
  - [ ] SNS topics
  - [ ] IAM roles

## Post-Deployment Configuration

- [ ] Store JWT secret in Secrets Manager
- [ ] Enable Bedrock model access (Claude 3.5 Sonnet)
- [ ] Configure SNS email subscriptions
- [ ] Confirm email subscription
- [ ] Set up CloudWatch alarms
- [ ] Configure S3 lifecycle policies (auto-configured)
- [ ] Enable CloudTrail for audit logging (optional)

## Testing

- [ ] Test user registration endpoint
- [ ] Test user login endpoint
- [ ] Save JWT token from login
- [ ] Test test generation endpoint (requires Bedrock)
- [ ] Test test execution endpoint
- [ ] Test report generation endpoint
- [ ] Verify notifications received
- [ ] Check CloudWatch logs for errors
- [ ] Review CloudWatch metrics

## Monitoring Setup

- [ ] Access CloudWatch dashboard
- [ ] Verify metrics are being collected
- [ ] Test CloudWatch alarms
- [ ] Set up SNS notifications for alarms
- [ ] Configure log retention (30 days default)
- [ ] Set up cost alerts in AWS Budgets

## Security

- [ ] Review IAM roles and policies
- [ ] Verify encryption at rest enabled (DynamoDB, S3)
- [ ] Verify HTTPS only for API Gateway
- [ ] Review S3 bucket policies
- [ ] Enable MFA for AWS account
- [ ] Rotate access keys regularly
- [ ] Review security groups (if using VPC)

## Documentation

- [ ] Document API Gateway URL
- [ ] Document AWS resource ARNs
- [ ] Update team documentation
- [ ] Share access credentials securely
- [ ] Document custom configurations
- [ ] Create runbook for common operations

## CI/CD (Optional)

- [ ] Set up GitHub Actions secrets
- [ ] Test CI/CD pipeline
- [ ] Configure branch protection rules
- [ ] Set up staging environment
- [ ] Configure production approval gates

## Production Deployment (When Ready)

- [ ] Review all dev/staging tests
- [ ] Deploy to staging (`cdk deploy --context environment=staging`)
- [ ] Run full test suite in staging
- [ ] Get stakeholder approval
- [ ] Deploy to production (`cdk deploy --context environment=prod`)
- [ ] Run smoke tests in production
- [ ] Monitor for 24 hours
- [ ] Announce to users

## Post-Launch

- [ ] Monitor CloudWatch dashboards daily
- [ ] Review costs weekly
- [ ] Check for errors in logs
- [ ] Gather user feedback
- [ ] Plan for scaling if needed
- [ ] Schedule regular maintenance
- [ ] Update documentation as needed

## Rollback Plan

If deployment fails:
- [ ] Note error messages
- [ ] Check CloudFormation events
- [ ] Rollback using `cdk deploy --rollback`
- [ ] Or delete stack and redeploy
- [ ] Review logs for root cause
- [ ] Fix issues and redeploy

## Quick Commands Reference

```powershell
# Deploy to Dev
cd infrastructure && cdk deploy --context environment=dev

# View logs
aws logs tail /aws/lambda/ai-testing-auth-dev --follow

# Get API URL
aws cloudformation describe-stacks --stack-name AiTestingPlatformStack-dev --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text

# Test registration
curl -X POST https://YOUR-API-URL/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Test123!","tenantId":"test"}'

# View costs
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31 --granularity MONTHLY --metrics BlendedCost
```

## Support Contacts

- AWS Support: https://console.aws.amazon.com/support
- Project Documentation: `docs/` directory
- Deployment Guide: `AWS_DEPLOYMENT_GUIDE.md`
- Production Runbook: `docs/PRODUCTION_RUNBOOK.md`

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed

**Deployment Date**: _______________
**Deployed By**: _______________
**Environment**: ⬜ Dev | ⬜ Staging | ⬜ Production
**API URL**: _______________
**Notes**: _______________
