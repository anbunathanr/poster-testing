# CI/CD Pipeline Setup Guide

## Overview

This document describes the CI/CD pipeline for the AI Testing Automation Platform using GitHub Actions. The pipeline automates testing, building, and deployment across Dev, Staging, and Production environments.

---

## Pipeline Architecture

### Workflow Stages

1. **Lint and Code Quality** - ESLint, Prettier, TypeScript compilation
2. **Unit Tests** - Fast, isolated tests with coverage reporting
3. **Integration Tests** - Tests with LocalStack (DynamoDB, S3, SNS)
4. **E2E Tests** - Full workflow tests with Playwright
5. **Security Scan** - npm audit and Snyk vulnerability scanning
6. **Build** - TypeScript compilation and artifact creation
7. **Deploy to Dev** - Automatic deployment on `develop` branch
8. **Deploy to Staging** - Automatic deployment on `release/*` branches
9. **Deploy to Production** - Manual approval required on `main` branch

### Branch Strategy

- **`develop`** → Deploys to Dev environment
- **`release/*`** → Deploys to Staging environment
- **`main`** → Deploys to Production environment (manual approval)
- **Pull Requests** → Runs tests only, no deployment

---

## Prerequisites

### 1. GitHub Repository Setup

1. Create a GitHub repository for the project
2. Push your code to the repository
3. Enable GitHub Actions in repository settings

### 2. AWS Account Setup

You need three AWS accounts (or separate regions/accounts):
- **Dev Account**: For development testing
- **Staging Account**: For pre-production validation
- **Production Account**: For live production environment

### 3. Required Secrets

Configure the following secrets in GitHub repository settings (`Settings` → `Secrets and variables` → `Actions`):

#### AWS Credentials (Dev)
- `AWS_ACCESS_KEY_ID_DEV`
- `AWS_SECRET_ACCESS_KEY_DEV`

#### AWS Credentials (Staging)
- `AWS_ACCESS_KEY_ID_STAGING`
- `AWS_SECRET_ACCESS_KEY_STAGING`

#### AWS Credentials (Production)
- `AWS_ACCESS_KEY_ID_PROD`
- `AWS_SECRET_ACCESS_KEY_PROD`

#### Application Secrets
- `JWT_SECRET_DEV` - JWT signing secret for Dev
- `JWT_SECRET_STAGING` - JWT signing secret for Staging
- `JWT_SECRET_PROD` - JWT signing secret for Production

#### Test User Credentials
- `TEST_USER_EMAIL_DEV`
- `TEST_USER_PASSWORD_DEV`
- `TEST_USER_EMAIL_STAGING`
- `TEST_USER_PASSWORD_STAGING`
- `TEST_USER_EMAIL_PROD`
- `TEST_USER_PASSWORD_PROD`

#### Notifications (Optional)
- `SLACK_WEBHOOK` - Slack webhook URL for deployment notifications
- `SNYK_TOKEN` - Snyk API token for security scanning

---

## Setting Up GitHub Environments

### 1. Create Environments

Go to `Settings` → `Environments` and create:

1. **development**
   - No protection rules
   - Auto-deploys on `develop` branch

2. **staging**
   - Optional: Required reviewers
   - Auto-deploys on `release/*` branches

3. **production**
   - **Required reviewers**: Add team members who can approve
   - **Wait timer**: Optional 5-minute wait before deployment
   - Deploys on `main` branch after approval

### 2. Configure Environment URLs

- **development**: `https://dev-api.your-domain.com`
- **staging**: `https://staging-api.your-domain.com`
- **production**: `https://api.your-domain.com`

---

## Pipeline Jobs Explained

### Job 1: Lint and Code Quality

**Purpose**: Ensure code meets quality standards

**Steps**:
1. Checkout code
2. Install dependencies
3. Run ESLint
4. Run Prettier format check
5. Compile TypeScript

**Triggers**: All pushes and pull requests

**Duration**: ~2 minutes

---

### Job 2: Unit Tests

**Purpose**: Run fast, isolated unit tests

**Steps**:
1. Checkout code
2. Install dependencies
3. Run unit tests with coverage
4. Upload coverage to Codecov
5. Archive test results

**Triggers**: After lint job passes

**Duration**: ~3 minutes

**Coverage Target**: 80%+

---

### Job 3: Integration Tests

**Purpose**: Test with real AWS services (LocalStack)

**Steps**:
1. Start LocalStack container (DynamoDB, S3, SNS)
2. Checkout code
3. Install dependencies
4. Wait for LocalStack to be ready
5. Create DynamoDB tables
6. Run integration tests
7. Archive test results

**Triggers**: After lint job passes

**Duration**: ~5 minutes

---

### Job 4: E2E Tests

**Purpose**: Test complete workflows with Playwright

**Steps**:
1. Start LocalStack container
2. Checkout code
3. Install dependencies
4. Install Playwright browsers
5. Setup local environment
6. Run E2E tests
7. Archive test results

**Triggers**: After lint job passes

**Duration**: ~8 minutes

---

### Job 5: Security Scan

**Purpose**: Identify security vulnerabilities

**Steps**:
1. Checkout code
2. Install dependencies
3. Run npm audit
4. Run Snyk security scan

**Triggers**: After lint job passes

**Duration**: ~2 minutes

**Note**: Continues on error to not block deployment

---

### Job 6: Build

**Purpose**: Compile TypeScript and create artifacts

**Steps**:
1. Checkout code
2. Install dependencies
3. Build application
4. Archive build artifacts

**Triggers**: After unit and integration tests pass

**Duration**: ~2 minutes

---

### Job 7: Deploy to Dev

**Purpose**: Deploy to development environment

**Steps**:
1. Checkout code
2. Configure AWS credentials
3. Install dependencies
4. Deploy with CDK
5. Run smoke tests
6. Send Slack notification

**Triggers**: Push to `develop` branch after all tests pass

**Duration**: ~10 minutes

**Approval**: None required (automatic)

---

### Job 8: Deploy to Staging

**Purpose**: Deploy to staging environment for validation

**Steps**:
1. Checkout code
2. Configure AWS credentials
3. Install dependencies
4. Deploy with CDK
5. Run integration tests against staging
6. Run smoke tests
7. Send Slack notification

**Triggers**: Push to `release/*` branch after all tests pass

**Duration**: ~15 minutes

**Approval**: Optional (configure in environment settings)

---

### Job 9: Deploy to Production

**Purpose**: Deploy to production environment

**Steps**:
1. Checkout code
2. Configure AWS credentials
3. Install dependencies
4. Create deployment backup
5. Deploy with CDK
6. Run smoke tests
7. Create GitHub release
8. Send Slack notification
9. Rollback on failure

**Triggers**: Push to `main` branch after all tests pass

**Duration**: ~15 minutes

**Approval**: **REQUIRED** - Manual approval in GitHub UI

---

## Deployment Workflow

### Development Deployment

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "Add new feature"

# 3. Push to GitHub
git push origin feature/my-feature

# 4. Create pull request to develop
# GitHub Actions will run tests

# 5. Merge to develop
# Automatic deployment to Dev environment
```

### Staging Deployment

```bash
# 1. Create release branch from develop
git checkout develop
git pull
git checkout -b release/v1.0.0

# 2. Update version numbers if needed
npm version minor

# 3. Push release branch
git push origin release/v1.0.0

# Automatic deployment to Staging environment
```

### Production Deployment

```bash
# 1. Merge release branch to main
git checkout main
git merge release/v1.0.0

# 2. Push to main
git push origin main

# 3. Go to GitHub Actions
# 4. Approve production deployment
# 5. Monitor deployment progress
```

---

## Rollback Procedures

### Automatic Rollback

If deployment fails, the pipeline automatically attempts to rollback using CDK rollback functionality.

### Manual Rollback

If you need to manually rollback:

```bash
# 1. Identify the last successful deployment
git log --oneline

# 2. Revert to previous commit
git revert <commit-hash>

# 3. Push to trigger redeployment
git push origin main

# 4. Approve deployment
```

### Emergency Rollback

For immediate rollback:

```bash
# 1. SSH to deployment machine or use AWS Console
# 2. Navigate to infrastructure directory
cd infrastructure

# 3. Rollback using CDK
npx cdk deploy --all --rollback

# 4. Verify rollback
npm run test:smoke
```

---

## Monitoring Deployments

### GitHub Actions UI

1. Go to repository → `Actions` tab
2. Click on the workflow run
3. View job status and logs
4. Download artifacts if needed

### Slack Notifications

If configured, you'll receive Slack notifications for:
- Deployment started
- Deployment succeeded
- Deployment failed
- Rollback initiated

### CloudWatch Logs

Monitor Lambda function logs in CloudWatch:
1. Go to AWS Console → CloudWatch
2. Navigate to Log Groups
3. Filter by Lambda function name
4. View real-time logs

---

## Troubleshooting

### Tests Failing in CI

**Problem**: Tests pass locally but fail in CI

**Solutions**:
1. Check environment variables
2. Verify LocalStack is running
3. Check for timing issues (add waits)
4. Review CI logs for specific errors

### Deployment Fails

**Problem**: CDK deployment fails

**Solutions**:
1. Check AWS credentials are valid
2. Verify IAM permissions
3. Check CloudFormation stack events
4. Review CDK diff before deploying

### Smoke Tests Fail

**Problem**: Smoke tests fail after deployment

**Solutions**:
1. Verify API Gateway endpoint is accessible
2. Check Lambda function logs
3. Verify DynamoDB tables exist
4. Test manually with curl

### Rollback Fails

**Problem**: Automatic rollback doesn't work

**Solutions**:
1. Check CloudFormation stack status
2. Manually delete failed resources
3. Redeploy previous version
4. Contact AWS support if needed

---

## Best Practices

### 1. Branch Protection

Enable branch protection for `main` and `develop`:
- Require pull request reviews
- Require status checks to pass
- Require branches to be up to date

### 2. Secrets Management

- Rotate secrets regularly (every 90 days)
- Use different secrets for each environment
- Never commit secrets to repository
- Use AWS Secrets Manager for production

### 3. Testing

- Run tests locally before pushing
- Keep tests fast and reliable
- Fix flaky tests immediately
- Maintain 80%+ code coverage

### 4. Deployments

- Deploy to Dev frequently (multiple times per day)
- Deploy to Staging daily
- Deploy to Production weekly or as needed
- Always test in Staging before Production

### 5. Monitoring

- Monitor CloudWatch alarms after deployment
- Check error rates and latency
- Review logs for warnings
- Set up alerts for critical issues

---

## Maintenance

### Weekly Tasks

- Review failed deployments
- Update dependencies
- Check security vulnerabilities
- Review CloudWatch metrics

### Monthly Tasks

- Rotate AWS credentials
- Update Node.js version if needed
- Review and optimize pipeline
- Clean up old artifacts

### Quarterly Tasks

- Review and update documentation
- Conduct security audit
- Review AWS costs
- Update disaster recovery procedures

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [Playwright Documentation](https://playwright.dev/)

---

## Support

For CI/CD pipeline issues:
- **GitHub Actions**: Check workflow logs
- **AWS Deployment**: Check CloudFormation events
- **Slack**: #devops-support channel
- **Email**: devops@your-domain.com
