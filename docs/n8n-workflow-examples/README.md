# n8n Workflow Examples

This directory contains ready-to-use n8n workflow templates for integrating with the AI Testing Automation Platform's SNS notifications.

## Available Workflows

### 1. Basic Notification Workflow
**File**: `basic-notification-workflow.json`

A simple workflow that demonstrates the core functionality:
- Receives webhook notifications from SNS
- Automatically confirms SNS subscription
- Parses test notification messages
- Routes based on test status (PASS/FAIL)
- Logs notifications to console

**Use this workflow to**:
- Learn the basic structure of n8n integration
- Test your webhook setup
- Build custom workflows on top of this foundation

### 2. Slack Notification Workflow
**File**: `slack-notification-workflow.json`

A production-ready workflow that sends formatted notifications to Slack:
- Receives webhook notifications from SNS
- Automatically confirms SNS subscription
- Parses test notification messages
- Sends rich formatted messages to Slack with:
  - Success messages with green color
  - Failure messages with red color and error details
  - Test metadata (ID, duration, timestamp)
  - Button to view full results

**Use this workflow to**:
- Send test notifications to your team's Slack channel
- Get immediate visibility into test results
- Quickly access detailed test results

## How to Import Workflows

### Method 1: Import from File

1. Open your n8n instance
2. Click on "Workflows" in the left sidebar
3. Click the "Import from File" button
4. Select one of the JSON files from this directory
5. Click "Import"

### Method 2: Copy and Paste

1. Open your n8n instance
2. Click on "Workflows" in the left sidebar
3. Click "Add Workflow"
4. Click the three dots menu (⋮) in the top right
5. Select "Import from URL or File"
6. Copy the contents of the JSON file
7. Paste into the text area
8. Click "Import"

## Configuring Workflows

### Basic Notification Workflow

No configuration needed! This workflow works out of the box.

1. Import the workflow
2. Activate the workflow
3. Copy the webhook URL from the Webhook node
4. Subscribe the webhook to your SNS topic (see setup guide)

### Slack Notification Workflow

Requires Slack credentials and channel configuration:

1. **Set up Slack credentials**:
   - In n8n, go to "Credentials" in the left sidebar
   - Click "Add Credential"
   - Select "Slack OAuth2 API"
   - Follow the OAuth flow to connect your Slack workspace
   - Save the credential

2. **Configure the Slack nodes**:
   - Open the "Slack - Success" node
   - Select your Slack credential
   - Choose the channel where you want to send notifications
   - Update the "View Results" button URL to match your platform URL
   - Repeat for the "Slack - Failure" node

3. **Activate the workflow**:
   - Click "Active" toggle in the top right
   - Copy the webhook URL
   - Subscribe the webhook to your SNS topic

## Testing Your Workflow

### Step 1: Activate the Workflow

1. Open the workflow in n8n
2. Click the "Active" toggle in the top right
3. The workflow is now listening for webhooks

### Step 2: Get the Webhook URL

1. Click on the "Webhook" node
2. Copy the "Test URL" or "Production URL"
3. Example: `https://your-n8n-instance.com/webhook/test-notifications`

### Step 3: Subscribe to SNS

Use the setup script:

```bash
export ENVIRONMENT=dev
export AWS_REGION=us-east-1
./infrastructure/scripts/setup-n8n-webhook.sh
```

Or manually:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --protocol https \
  --notification-endpoint https://your-n8n-instance.com/webhook/test-notifications \
  --region us-east-1
```

### Step 4: Confirm Subscription

The workflow will automatically confirm the subscription when SNS sends the confirmation request.

Check the workflow executions in n8n to verify the confirmation was successful.

### Step 5: Send Test Notification

```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --message '{"resultId":"test-123","testId":"test-456","status":"PASS","duration":45000,"tenantId":"tenant-1","userId":"user-1","testName":"Test notification","timestamp":1707753645000}' \
  --subject "Test Notification" \
  --region us-east-1
```

### Step 6: Verify in n8n

1. Go to "Executions" in n8n
2. You should see a new execution for your workflow
3. Click on it to see the execution details
4. Verify that the message was parsed correctly
5. Check Slack (if using Slack workflow) for the notification

## Customizing Workflows

### Adding More Actions

You can extend these workflows by adding more nodes after the status check:

**For Success Notifications**:
- Send email via Gmail/SendGrid
- Update a dashboard via HTTP request
- Store results in a database
- Trigger other workflows

**For Failure Notifications**:
- Create Jira tickets
- Send PagerDuty alerts
- Post to Microsoft Teams
- Send SMS via Twilio

### Filtering by Tenant

Add a filter node after parsing to route notifications by tenant:

```javascript
// In a Code node
const tenantId = $json.tenantId;

let channel;
switch(tenantId) {
  case 'tenant-1':
    channel = '#tenant-1-tests';
    break;
  case 'tenant-2':
    channel = '#tenant-2-tests';
    break;
  default:
    channel = '#general-tests';
}

return {
  json: {
    ...$json,
    slackChannel: channel
  }
};
```

### Adding Error Handling

Wrap your processing logic in try-catch:

```javascript
try {
  const snsMessage = JSON.parse($input.item.json.Message);
  return { json: snsMessage };
} catch (error) {
  console.error('Error parsing message:', error);
  return { 
    json: { 
      error: error.message,
      rawMessage: $input.item.json.Message 
    } 
  };
}
```

## Workflow Structure

All workflows follow this basic structure:

```
Webhook (Entry Point)
    ↓
Is Subscription Confirmation?
    ↓ (Yes)              ↓ (No)
Confirm Subscription    Parse SNS Message
                            ↓
                        Is Success?
                    ↓ (Yes)    ↓ (No)
                Success Actions  Failure Actions
```

## Message Format

The workflows expect SNS messages in this format:

```json
{
  "Type": "Notification",
  "MessageId": "...",
  "TopicArn": "...",
  "Message": "{\"resultId\":\"...\",\"testId\":\"...\",\"status\":\"PASS\",\"duration\":45000,...}",
  "Timestamp": "2024-02-12T15:34:05.000Z"
}
```

The `Message` field contains the actual test notification as a JSON string:

```json
{
  "resultId": "result-uuid",
  "testId": "test-uuid",
  "status": "PASS",
  "duration": 45000,
  "tenantId": "tenant-uuid",
  "userId": "user-uuid",
  "testName": "Login functionality test",
  "timestamp": 1707753645000,
  "errorMessage": "Optional error message for FAIL status"
}
```

## Troubleshooting

### Workflow Not Receiving Messages

1. **Check workflow is active**: Toggle should be green
2. **Verify webhook URL**: Copy from the Webhook node
3. **Check SNS subscription**: Should be confirmed, not pending
4. **Test webhook directly**:
   ```bash
   curl -X POST https://your-n8n-instance.com/webhook/test-notifications \
     -H "Content-Type: application/json" \
     -d '{"test":"message"}'
   ```

### Subscription Not Confirming

1. **Check workflow executions**: Look for SubscriptionConfirmation message
2. **Verify SubscribeURL was accessed**: Check the HTTP Request node execution
3. **Manual confirmation**: Extract SubscribeURL from execution log and open in browser

### Message Parsing Errors

1. **Check execution log**: Look for errors in the Parse SNS Message node
2. **Verify message format**: Ensure Message field contains valid JSON
3. **Add error handling**: Wrap parsing logic in try-catch

### Slack Messages Not Sending

1. **Check Slack credentials**: Ensure OAuth is properly configured
2. **Verify channel access**: Ensure the Slack app has access to the channel
3. **Check channel ID**: Ensure the channel ID is correct
4. **Review Slack node execution**: Look for error messages

## Best Practices

1. **Always include subscription confirmation**: Ensures webhook is properly subscribed
2. **Add error handling**: Prevents workflow failures on malformed messages
3. **Log important events**: Helps with debugging and monitoring
4. **Use descriptive node names**: Makes workflows easier to understand
5. **Test thoroughly**: Send test notifications before relying on the workflow
6. **Monitor executions**: Regularly check for failed executions
7. **Keep workflows simple**: Break complex logic into multiple workflows
8. **Document customizations**: Add notes to explain custom logic

## Security Considerations

1. **Use HTTPS**: SNS requires HTTPS for webhook endpoints
2. **Validate messages**: Consider adding SNS signature verification
3. **Protect webhook URL**: Don't share publicly
4. **Use authentication**: Add webhook authentication if possible
5. **Limit access**: Restrict who can modify workflows
6. **Monitor executions**: Watch for suspicious activity

## Related Documentation

- [n8n Webhook Setup Guide](../N8N_WEBHOOK_SETUP.md) - Comprehensive setup instructions
- [SNS Notification Setup](../SNS_NOTIFICATION_SETUP.md) - SNS configuration guide
- [Infrastructure Deployment](../INFRASTRUCTURE_DEPLOYMENT.md) - CDK deployment guide

## Support

For issues with n8n workflows:

1. Check n8n execution logs for errors
2. Review the n8n webhook setup guide
3. Test webhook endpoint with curl
4. Verify SNS subscription status
5. Contact platform administrators

## Contributing

Have a useful workflow to share? Consider contributing:

1. Create a new workflow JSON file
2. Add documentation to this README
3. Test thoroughly
4. Submit a pull request

## License

These workflow examples are provided as-is for use with the AI Testing Automation Platform.
