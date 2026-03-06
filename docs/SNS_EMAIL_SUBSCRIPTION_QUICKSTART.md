# SNS Email Subscription Quick Start Guide

## Overview

This guide provides quick instructions for configuring email subscriptions to receive test result notifications from the AI Testing Automation Platform.

## Prerequisites

- Infrastructure deployed using CDK
- AWS CLI configured with appropriate credentials
- SNS topic created (automatically created during infrastructure deployment)

## Quick Setup Methods

### Method 1: Automated Script (Recommended)

The fastest way to configure email subscriptions:

```bash
# Set your environment
export ENVIRONMENT=dev  # or staging, prod
export AWS_REGION=us-east-1

# Run the setup script
./infrastructure/scripts/setup-sns-subscriptions.sh
```

Follow the prompts to enter email addresses. The script will:
- ✓ Find the SNS topic automatically
- ✓ Subscribe each email address
- ✓ Display subscription status
- ✓ Provide next steps

### Method 2: CDK Context (During Deployment)

Add email during infrastructure deployment:

```bash
cdk deploy --context notificationEmail=your-email@example.com
```

Or add to `cdk.context.json`:

```json
{
  "notificationEmail": "your-email@example.com"
}
```

### Method 3: AWS CLI (Manual)

Subscribe a single email address:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-east-1
```

## Confirmation Required

⚠️ **Important**: After subscribing, each email address will receive a confirmation email from AWS SNS.

**You must click the "Confirm subscription" link** in the email to start receiving notifications.

## Verify Subscription Status

Check if subscriptions are confirmed:

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --region us-east-1
```

Look for:
- `PendingConfirmation` = Not yet confirmed
- `arn:aws:sns:...` = Confirmed and active

## Test Notifications

Send a test notification to verify setup:

```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --message "Test notification from AI Testing Platform" \
  --subject "Test Notification" \
  --region us-east-1
```

Check your email inbox for the test message.

## Notification Types

You'll receive two types of notifications:

### ✓ Success Notifications (PASS)

**Subject**: `✓ Test Execution PASS: {test name}`

**Content**:
- Test ID and Result ID
- Execution duration
- Timestamp
- Link to full results

### ✗ Failure Notifications (FAIL)

**Subject**: `✗ Test Execution FAIL: {test name}`

**Content**:
- Test ID and Result ID
- Execution duration
- Error message and details
- Link to full results with screenshots

## Common Issues

### Email Not Received

1. **Check spam folder** - AWS SNS emails may be filtered
2. **Verify subscription** - Ensure status is not `PendingConfirmation`
3. **Check email address** - Verify spelling and format
4. **Wait a few minutes** - Initial confirmation emails may be delayed

### Subscription Stuck in PendingConfirmation

1. Check spam folder for confirmation email
2. Resubscribe using the script or AWS CLI
3. Try a different email address to test

### Too Many Notifications

Unsubscribe by:
- Clicking "Unsubscribe" link in any notification email
- Using AWS CLI to remove subscription
- Contacting platform administrator

## Managing Subscriptions

### Add More Subscribers

Run the setup script again:

```bash
./infrastructure/scripts/setup-sns-subscriptions.sh
```

### Remove Subscribers

1. Get subscription ARN:
```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --region us-east-1
```

2. Unsubscribe:
```bash
aws sns unsubscribe \
  --subscription-arn arn:aws:sns:...:SUBSCRIPTION_ID \
  --region us-east-1
```

## Best Practices

✓ **Use team email aliases** for broader coverage  
✓ **Separate environments** - Different emails for dev/staging/prod  
✓ **Confirm promptly** - Unconfirmed subscriptions don't receive notifications  
✓ **Test regularly** - Verify notifications are working  
✓ **Monitor DLQ** - Check for failed deliveries  
✓ **Document subscribers** - Keep track of who is subscribed  

## Environment-Specific Topics

Each environment has its own SNS topic:

- **Dev**: `ai-testing-notifications-dev`
- **Staging**: `ai-testing-notifications-staging`
- **Production**: `ai-testing-notifications-prod`

Subscribe to the appropriate topic for your needs.

## Security Notes

- Email addresses are stored securely in AWS SNS
- Only AWS account administrators can view subscriptions
- Notifications contain test metadata but not sensitive credentials
- Users can unsubscribe at any time

## Next Steps

After configuring email subscriptions:

1. ✓ Confirm all email subscriptions
2. ✓ Send a test notification
3. ✓ Run a test execution to verify end-to-end flow
4. ✓ Monitor CloudWatch for notification delivery metrics
5. ✓ Document subscribers for your team

## Support

For issues or questions:

1. Check [SNS Notification Setup Guide](./SNS_NOTIFICATION_SETUP.md) for detailed documentation
2. Review CloudWatch logs for delivery issues
3. Contact platform administrators

## Related Documentation

- [SNS Notification Setup](./SNS_NOTIFICATION_SETUP.md) - Comprehensive setup guide
- [CloudWatch Setup](./CLOUDWATCH_SETUP.md) - Monitoring and alarms
- [Infrastructure Deployment](./INFRASTRUCTURE_DEPLOYMENT.md) - CDK deployment
