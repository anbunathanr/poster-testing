# Quick AWS Deployment Guide

Follow these steps to deploy your AI Testing Platform to AWS.

## Prerequisites Checklist

- [ ] AWS Account created
- [ ] Node.js 18.x installed
- [ ] Project built successfully

## Step 1: Install AWS CLI

Download and install from: https://aws.amazon.com/cli/

Or use this command:
```cmd
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
```

Verify installation:
```cmd
aws --version
```

## Step 2: Configure AWS Credentials

You need AWS Access Keys. Get them from:
1. Go to AWS Console → IAM → Users
2. Create a new user or use existing
3. Attach policy: `AdministratorAccess`
4. Create access keys
5. Save the Access Key ID and Secret Access Key

Configure AWS CLI:
```cmd
aws configure
```

Enter when prompted:
- AWS Access Key ID: [your-access-key]
- AWS Secret Access Key: [your-secret-key]
- Default region: us-east-1
- Default output format: json

## Step 3: Install AWS CDK

```cmd
npm install -g aws-cdk
```

Verify installation:
```cmd
cdk --version
```

## Step 4: Build the Project

```cmd
npm run build
```

This compiles TypeScript to JavaScript.

## Step 5: Bootstrap CDK (First Time Only)

```cmd
cd infrastructure
cdk bootstrap
```

This creates necessary AWS resources for CDK deployments.

## Step 6: Deploy to AWS

```cmd
cdk deploy --context environment=dev
```

This will:
- Create DynamoDB tables
- Create S3 bucket
- Deploy Lambda functions
- Create API Gateway
- Set up CloudWatch monitoring
- Configure SNS notifications

**Deployment takes ~10-15 minutes.**

## Step 7: Get Your API URL

After deployment completes, CDK will output your API Gateway URL:

```
Outputs:
AiTestingPlatformStack-dev.ApiUrl = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
```

Save this URL - you'll use it to access your API!

## Step 8: Enable Bedrock Access

1. Go to AWS Console → Bedrock
2. Click "Model access" in left menu
3. Click "Request model access"
4. Select "Claude 3.5 Sonnet"
5. Click "Request model access"
6. Wait for approval (usually instant)

## Step 9: Test Your Deployment

Register a test user:
```cmd
curl -X POST "https://YOUR-API-URL/auth/register" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"TestPass123!\",\"tenantId\":\"test-tenant\"}"
```

Login:
```cmd
curl -X POST "https://YOUR-API-URL/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"TestPass123!\"}"
```

You'll get a JWT token in the response!

## Troubleshooting

### Error: "Unable to resolve AWS account"
**Solution**: Run `aws configure` again and check your credentials

### Error: "CDK bootstrap required"
**Solution**: Run `cdk bootstrap` in the infrastructure directory

### Error: "Access Denied"
**Solution**: Make sure your IAM user has `AdministratorAccess` policy

### Error: "Region not specified"
**Solution**: Run `aws configure` and set default region to `us-east-1`

## Cost Estimate

**Dev Environment**: ~$25-60/month
- DynamoDB: $5-10
- Lambda: $10-20
- S3: $1-5
- API Gateway: $3-10
- CloudWatch: $5-10
- Bedrock: Pay per use

## Next Steps

After successful deployment:

1. ✅ Test all API endpoints
2. ✅ Configure email notifications (optional)
3. ✅ Set up CloudWatch alarms
4. ✅ Review monitoring dashboards
5. ✅ Read the User Guide: `docs/USER_GUIDE.md`

## Useful Commands

```cmd
# View deployment status
cdk list

# View what will be deployed (dry run)
cdk diff --context environment=dev

# Destroy everything (careful!)
cdk destroy --context environment=dev

# View CloudWatch logs
aws logs tail /aws/lambda/ai-testing-auth-dev --follow
```

## Support

- Full deployment guide: `AWS_DEPLOYMENT_GUIDE.md`
- API documentation: `docs/API_DOCUMENTATION.md`
- Production runbook: `docs/PRODUCTION_RUNBOOK.md`

---

**You're ready to deploy!** 🚀

Start with Step 1 and work through each step. The entire process takes about 30 minutes including AWS account setup.
