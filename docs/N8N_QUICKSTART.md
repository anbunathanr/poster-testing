# n8n Integration Quick Start Guide

## Overview

This guide provides quick instructions for integrating n8n with the AI Testing Automation Platform to receive test result notifications via webhooks.

## Prerequisites

- n8n instance deployed and accessible via HTTPS
- AWS CLI configured with appropriate credentials
- Infrastructure deployed (SNS topic created)

## Quick Setup (5 Minutes)

### Step 1: Import n8n Workflow

1. Download a workflow template:
   - **Basic**: `docs/n8n-workflow-examples/basic-notification-workflow.json`
   - **Slack**: `docs/n8n-workflow-examples/slack-notification-workflow.json`

2. Import into n8n:
   - Open n8n
   - Click "Workflows" → "Import from File"
   - Select the downloaded JSON file
   - Click "Import"

### Step 2: Configure Workflow (Slack Only)

If using the Slack workflow:

1. Add Slack credentials:
   - Go to "Credentials" → "Add Credential"
   - Select "Slack OAuth2 API"
   - Complete OAuth flow
   - Save credential

2. Configure Slack nodes:
   - Open "Slack - Success" node
   - Select your credential
   - Choose channel (e.g., #test-results)
   - Update "View Results" button URL
   - Repeat for "Slack - Failure" node

### Step 3: Activate Workflow

1. Click "Active" toggle (top right)
2. Copy the webhook URL from the Webhook node
   - Example: `https://your-n8n.com/webhook/test-notifications`

### Step 4: Subscribe Webhook to SNS

**Option A: Using Script (Recommended)**

```bash
export ENVIRONMENT=dev
export AWS_REGION=us-east-1
./infrastructure/scripts/setup-n8n-webhook.sh
```

Enter your webhook URL when prompted.

**Option B: Using AWS CLI**

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --protocol https \
  --notification-endpoint https://your-n8n.com/webhook/test-notifications \
  --region us-east-1
```

### Step 5: Verify Setup

The workflow will automatically confirm the subscription. Check n8n executions to verify.

### Step 6: Test Integration

Send a test notification:

```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --message '{"resultId":"test-123","testId":"test-456","status":"PASS","duration":45000,"testName":"Test notification","timestamp":1707753645000}' \
  --subject "Test Notification" \
  --region us-east-1
```

Check n8n executions and Slack (if configured) for the notification.

## What You'll Receive

### Success Notifications (PASS)

```
✅ Test Passed: Login functionality test

Test ID: test-456
Duration: 45 seconds
Timestamp: 2024-02-12T15:34:05.000Z
```

### Failure Notifications (FAIL)

```
❌ Test Failed: Login functionality test

Test ID: test-456
Duration: 32 seconds
Error: Element not found: #login-button
Timestamp: 2024-02-12T15:34:05.000Z
```

## Common Issues

### Webhook Not Receiving Messages

✓ Verify workflow is active (green toggle)  
✓ Check SNS subscription is confirmed  
✓ Ensure webhook URL is HTTPS  
✓ Test webhook with curl  

### Subscription Not Confirming

✓ Check n8n executions for SubscriptionConfirmation  
✓ Verify SubscribeURL was accessed  
✓ Manually open SubscribeURL in browser  

### Slack Messages Not Sending

✓ Verify Slack credentials are configured  
✓ Check Slack app has channel access  
✓ Review Slack node execution logs  

## Next Steps

After basic setup:

1. ✓ Customize notification format
2. ✓ Add more actions (email, Jira, etc.)
3. ✓ Set up tenant-specific routing
4. ✓ Configure failure alerting
5. ✓ Monitor workflow executions

## Customization Examples

### Add Email Notification

Add a Gmail node after the status check:

```
Parse SNS Message → Is Success? → Gmail Node
```

Configure Gmail node with your credentials and email template.

### Create Jira Tickets for Failures

Add a Jira node after the failure branch:

```
Is Success? → (No) → Jira Node
```

Configure to create a bug ticket with test details.

### Route by Tenant

Add a Code node to determine routing:

```javascript
const tenantId = $json.tenantId;
let channel = tenantId === 'tenant-1' ? '#tenant-1' : '#general';
return { json: { ...$json, slackChannel: channel } };
```

## Resources

- **Detailed Setup**: [N8N Webhook Setup Guide](./N8N_WEBHOOK_SETUP.md)
- **Workflow Examples**: [n8n-workflow-examples/](./n8n-workflow-examples/)
- **SNS Configuration**: [SNS Notification Setup](./SNS_NOTIFICATION_SETUP.md)
- **Troubleshooting**: See detailed setup guide

## Support

For issues:

1. Check n8n execution logs
2. Review SNS delivery logs in CloudWatch
3. Verify subscription status
4. Test webhook endpoint
5. Contact platform administrators

## Environment-Specific Topics

Subscribe to the appropriate topic for your environment:

- **Dev**: `ai-testing-notifications-dev`
- **Staging**: `ai-testing-notifications-staging`
- **Production**: `ai-testing-notifications-prod`

## Security Notes

✓ Use HTTPS for webhook endpoints  
✓ Keep webhook URLs private  
✓ Monitor n8n executions for suspicious activity  
✓ Consider adding SNS signature verification  
✓ Limit workflow modification access  

---

**Setup Time**: ~5 minutes  
**Difficulty**: Easy  
**Requirements**: n8n instance, AWS CLI, SNS topic  

Ready to get started? Import a workflow and follow the steps above!
