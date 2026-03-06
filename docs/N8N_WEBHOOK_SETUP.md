# n8n Webhook Integration Guide

## Overview

This guide explains how to integrate n8n with the AI Testing Automation Platform to receive real-time test result notifications via webhooks. n8n is a powerful workflow automation tool that can process test notifications and trigger custom actions like sending formatted messages to Slack, creating Jira tickets, or updating dashboards.

## Architecture

The webhook integration flow:

```
Test Execution Lambda
        ↓
    SNS Topic
        ↓
  n8n Webhook
        ↓
   n8n Workflow
        ↓
  Custom Actions
  (Slack, Email, Jira, etc.)
```

## Prerequisites

- n8n instance deployed and accessible via HTTPS
- SNS topic created (automatically created during infrastructure deployment)
- AWS CLI configured with appropriate credentials
- n8n webhook URL (must be publicly accessible or have appropriate network access)

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 5.1**: Send success notifications for PASS status
- **Requirement 5.2**: Send failure notifications with error summary for FAIL status
- **Requirement 5.3**: Include test execution metadata in notifications
- **Requirement 5.6**: Retry policies for failed notifications (via DLQ)

## Part 1: n8n Webhook Setup

### Step 1: Create n8n Workflow

1. Log in to your n8n instance
2. Click "Create New Workflow"
3. Name it "AI Testing Platform Notifications"

### Step 2: Add Webhook Node

1. Click the "+" button to add a node
2. Search for "Webhook" and select it
3. Configure the webhook node:
   - **HTTP Method**: POST
   - **Path**: `test-notifications` (or your preferred path)
   - **Authentication**: None (SNS uses signature verification)
   - **Response Mode**: Immediately
   - **Response Code**: 200

4. Copy the webhook URL (e.g., `https://your-n8n-instance.com/webhook/test-notifications`)

### Step 3: Test the Webhook

1. Click "Execute Workflow" in n8n
2. The webhook will wait for incoming requests
3. Keep this tab open for testing

## Part 2: Subscribe n8n Webhook to SNS

### Method 1: Using CDK Context (Recommended)

Add the webhook URL to your CDK context:

**Option A: Command Line**
```bash
cdk deploy --context webhookUrl=https://your-n8n-instance.com/webhook/test-notifications
```

**Option B: cdk.context.json**
```json
{
  "webhookUrl": "https://your-n8n-instance.com/webhook/test-notifications"
}
```

Then deploy:
```bash
cdk deploy
```

### Method 2: Using AWS CLI

Subscribe the webhook manually:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --protocol https \
  --notification-endpoint https://your-n8n-instance.com/webhook/test-notifications \
  --region us-east-1
```

### Step 4: Confirm Subscription

SNS will send a subscription confirmation request to your n8n webhook. You need to confirm it:

**Option A: Automatic Confirmation (Recommended)**

Add a confirmation handler to your n8n workflow:

1. After the Webhook node, add an "IF" node
2. Configure the condition:
   - **Value 1**: `{{ $json.Type }}`
   - **Operation**: Equal
   - **Value 2**: `SubscriptionConfirmation`

3. For the "true" branch, add an "HTTP Request" node:
   - **Method**: GET
   - **URL**: `{{ $json.SubscribeURL }}`
   - This automatically confirms the subscription

4. For the "false" branch, continue with notification processing

**Option B: Manual Confirmation**

1. Check the n8n webhook execution log
2. Find the `SubscribeURL` in the payload
3. Open the URL in a browser to confirm the subscription

### Step 5: Verify Subscription

Check that the subscription is confirmed:

```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --region us-east-1
```

Look for your webhook URL with status `arn:aws:sns:...` (not `PendingConfirmation`).

## Part 3: Processing Notifications in n8n

### Understanding the Payload

SNS sends notifications in this format:

```json
{
  "Type": "Notification",
  "MessageId": "12345678-1234-1234-1234-123456789012",
  "TopicArn": "arn:aws:sns:us-east-1:123456789012:ai-testing-notifications-dev",
  "Subject": "Test Execution Result",
  "Message": "{\"resultId\":\"result-uuid\",\"testId\":\"test-uuid\",\"status\":\"PASS\",\"duration\":45000,\"tenantId\":\"tenant-uuid\",\"userId\":\"user-uuid\",\"testName\":\"Login functionality test\",\"timestamp\":1707753645000}",
  "Timestamp": "2024-02-12T15:34:05.000Z",
  "SignatureVersion": "1",
  "Signature": "...",
  "SigningCertURL": "...",
  "UnsubscribeURL": "..."
}
```

The actual test notification data is in the `Message` field as a JSON string.

### Basic n8n Workflow Example

Here's a complete n8n workflow to process test notifications:

#### Node 1: Webhook (Entry Point)
```json
{
  "httpMethod": "POST",
  "path": "test-notifications",
  "responseMode": "onReceived",
  "responseCode": 200
}
```

#### Node 2: IF (Check Message Type)
```json
{
  "conditions": {
    "string": [
      {
        "value1": "={{ $json.Type }}",
        "operation": "equal",
        "value2": "SubscriptionConfirmation"
      }
    ]
  }
}
```

#### Node 3a: HTTP Request (Confirm Subscription - True Branch)
```json
{
  "method": "GET",
  "url": "={{ $json.SubscribeURL }}"
}
```

#### Node 3b: Code (Parse Message - False Branch)
```javascript
// Parse the SNS message
const snsMessage = JSON.parse($input.item.json.Message);

return {
  json: {
    resultId: snsMessage.resultId,
    testId: snsMessage.testId,
    status: snsMessage.status,
    duration: snsMessage.duration,
    tenantId: snsMessage.tenantId,
    userId: snsMessage.userId,
    testName: snsMessage.testName,
    timestamp: snsMessage.timestamp,
    errorMessage: snsMessage.errorMessage || null,
    // Format duration for display
    durationSeconds: Math.round(snsMessage.duration / 1000),
    // Format timestamp
    timestampFormatted: new Date(snsMessage.timestamp).toISOString(),
    // Determine emoji based on status
    statusEmoji: snsMessage.status === 'PASS' ? '✅' : '❌'
  }
};
```

#### Node 4: IF (Check Test Status)
```json
{
  "conditions": {
    "string": [
      {
        "value1": "={{ $json.status }}",
        "operation": "equal",
        "value2": "PASS"
      }
    ]
  }
}
```

#### Node 5a: Process Success (True Branch)
Continue to success notification actions (Slack, email, etc.)

#### Node 5b: Process Failure (False Branch)
Continue to failure notification actions with error details

## Part 4: n8n Workflow Examples

### Example 1: Send to Slack

Add a Slack node after parsing the message:

**For Success (PASS)**:
```json
{
  "channel": "#test-results",
  "text": "✅ Test Passed: {{ $json.testName }}",
  "attachments": [
    {
      "color": "good",
      "fields": [
        {
          "title": "Test ID",
          "value": "{{ $json.testId }}",
          "short": true
        },
        {
          "title": "Duration",
          "value": "{{ $json.durationSeconds }}s",
          "short": true
        },
        {
          "title": "Result ID",
          "value": "{{ $json.resultId }}",
          "short": true
        },
        {
          "title": "Timestamp",
          "value": "{{ $json.timestampFormatted }}",
          "short": true
        }
      ]
    }
  ]
}
```

**For Failure (FAIL)**:
```json
{
  "channel": "#test-results",
  "text": "❌ Test Failed: {{ $json.testName }}",
  "attachments": [
    {
      "color": "danger",
      "fields": [
        {
          "title": "Test ID",
          "value": "{{ $json.testId }}",
          "short": true
        },
        {
          "title": "Duration",
          "value": "{{ $json.durationSeconds }}s",
          "short": true
        },
        {
          "title": "Error",
          "value": "{{ $json.errorMessage }}",
          "short": false
        },
        {
          "title": "Result ID",
          "value": "{{ $json.resultId }}",
          "short": true
        }
      ]
    }
  ]
}
```

### Example 2: Create Jira Ticket (for Failures)

Add a Jira node after the failure branch:

```json
{
  "project": "TEST",
  "issueType": "Bug",
  "summary": "Test Failure: {{ $json.testName }}",
  "description": "Automated test failed:\n\nTest ID: {{ $json.testId }}\nResult ID: {{ $json.resultId }}\nDuration: {{ $json.durationSeconds }}s\nError: {{ $json.errorMessage }}\n\nTimestamp: {{ $json.timestampFormatted }}",
  "priority": "High"
}
```

### Example 3: Send Email with Gmail

Add a Gmail node:

**For Success**:
```json
{
  "to": "qa-team@example.com",
  "subject": "✅ Test Passed: {{ $json.testName }}",
  "message": "Test execution completed successfully.\n\nTest ID: {{ $json.testId }}\nResult ID: {{ $json.resultId }}\nDuration: {{ $json.durationSeconds }} seconds\nTimestamp: {{ $json.timestampFormatted }}\n\nView full results: https://platform.example.com/results/{{ $json.resultId }}"
}
```

**For Failure**:
```json
{
  "to": "qa-team@example.com",
  "subject": "❌ Test Failed: {{ $json.testName }}",
  "message": "Test execution failed.\n\nTest ID: {{ $json.testId }}\nResult ID: {{ $json.resultId }}\nDuration: {{ $json.durationSeconds }} seconds\nError: {{ $json.errorMessage }}\nTimestamp: {{ $json.timestampFormatted }}\n\nView full results: https://platform.example.com/results/{{ $json.resultId }}"
}
```

### Example 4: Update Dashboard (HTTP Request)

Add an HTTP Request node to update a custom dashboard:

```json
{
  "method": "POST",
  "url": "https://your-dashboard.com/api/test-results",
  "authentication": "headerAuth",
  "headerAuth": {
    "name": "Authorization",
    "value": "Bearer YOUR_API_TOKEN"
  },
  "bodyParameters": {
    "resultId": "={{ $json.resultId }}",
    "testId": "={{ $json.testId }}",
    "status": "={{ $json.status }}",
    "duration": "={{ $json.duration }}",
    "testName": "={{ $json.testName }}",
    "timestamp": "={{ $json.timestamp }}",
    "errorMessage": "={{ $json.errorMessage }}"
  }
}
```

### Example 5: Store in Database

Add a database node (e.g., PostgreSQL, MySQL):

```json
{
  "operation": "insert",
  "table": "test_results",
  "columns": "result_id, test_id, status, duration, test_name, timestamp, error_message",
  "values": "={{ $json.resultId }}, ={{ $json.testId }}, ={{ $json.status }}, ={{ $json.duration }}, ={{ $json.testName }}, ={{ $json.timestamp }}, ={{ $json.errorMessage }}"
}
```

## Part 5: Advanced Configurations

### Tenant-Specific Routing

Route notifications to different channels based on tenant:

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

### Failure Threshold Alerting

Only alert on repeated failures:

```javascript
// In a Code node
const testId = $json.testId;
const status = $json.status;

// Get recent failures from workflow static data or external storage
const recentFailures = $workflow.staticData.failures || {};

if (status === 'FAIL') {
  recentFailures[testId] = (recentFailures[testId] || 0) + 1;
  $workflow.staticData.failures = recentFailures;
  
  // Alert only if failed 3+ times
  if (recentFailures[testId] >= 3) {
    return {
      json: {
        ...$json,
        shouldAlert: true,
        failureCount: recentFailures[testId]
      }
    };
  }
} else {
  // Reset on success
  delete recentFailures[testId];
  $workflow.staticData.failures = recentFailures;
}

return {
  json: {
    ...$json,
    shouldAlert: false
  }
};
```

### Time-Based Routing

Route notifications differently based on time of day:

```javascript
// In a Code node
const hour = new Date().getHours();
const isBusinessHours = hour >= 9 && hour < 17;

return {
  json: {
    ...$json,
    isBusinessHours: isBusinessHours,
    urgency: isBusinessHours ? 'normal' : 'low'
  }
};
```

## Part 6: Testing the Integration

### Test 1: Send Test Notification

Use AWS CLI to send a test notification:

```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --message '{"resultId":"test-123","testId":"test-456","status":"PASS","duration":45000,"tenantId":"tenant-1","userId":"user-1","testName":"Test notification","timestamp":1707753645000}' \
  --subject "Test Notification" \
  --region us-east-1
```

### Test 2: Verify n8n Execution

1. Check n8n workflow executions
2. Verify the webhook received the message
3. Confirm the message was parsed correctly
4. Check that downstream actions executed (Slack, email, etc.)

### Test 3: End-to-End Test

1. Run an actual test execution in the platform
2. Wait for test completion
3. Verify notification arrives in n8n
4. Confirm all workflow actions execute correctly

## Part 7: Monitoring and Troubleshooting

### CloudWatch Monitoring

Monitor webhook delivery in CloudWatch:

```bash
# Check SNS delivery logs
aws logs tail /aws/sns/us-east-1/ACCOUNT_ID/ai-testing-notifications-dev/Failure \
  --follow \
  --region us-east-1
```

### Common Issues

#### Issue 1: Subscription Not Confirmed

**Symptoms**: No notifications received in n8n

**Solution**:
1. Check subscription status in AWS Console or CLI
2. Verify the SubscribeURL was accessed
3. Add automatic confirmation to n8n workflow (see Step 4)

#### Issue 2: Webhook Returns Error

**Symptoms**: Messages in DLQ, CloudWatch shows delivery failures

**Solution**:
1. Verify n8n webhook is active and listening
2. Check n8n workflow for errors
3. Ensure webhook returns 200 status code
4. Review n8n execution logs

#### Issue 3: Message Parsing Fails

**Symptoms**: n8n workflow errors on message parsing

**Solution**:
1. Verify the Message field is valid JSON
2. Add error handling in Code node:
```javascript
try {
  const snsMessage = JSON.parse($input.item.json.Message);
  return { json: snsMessage };
} catch (error) {
  return { 
    json: { 
      error: 'Failed to parse message',
      rawMessage: $input.item.json.Message 
    } 
  };
}
```

#### Issue 4: n8n Webhook Not Accessible

**Symptoms**: SNS cannot reach webhook URL

**Solution**:
1. Verify n8n instance is publicly accessible
2. Check firewall rules and security groups
3. Ensure HTTPS is configured (SNS requires HTTPS)
4. Test webhook URL with curl:
```bash
curl -X POST https://your-n8n-instance.com/webhook/test-notifications \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'
```

### Dead Letter Queue (DLQ)

Monitor failed deliveries:

```bash
# Check DLQ message count
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/ai-testing-notifications-dlq-dev \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1
```

Retrieve failed messages:

```bash
# Receive messages from DLQ
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/ai-testing-notifications-dlq-dev \
  --max-number-of-messages 10 \
  --region us-east-1
```

## Part 8: Security Considerations

### SNS Signature Verification

For production environments, verify SNS message signatures in n8n:

```javascript
// In a Code node (requires crypto library)
const crypto = require('crypto');

function verifySNSSignature(message) {
  const {
    Message,
    MessageId,
    Timestamp,
    TopicArn,
    Type,
    Signature,
    SigningCertURL
  } = message;
  
  // Verify SigningCertURL is from AWS
  if (!SigningCertURL.startsWith('https://sns.')) {
    return false;
  }
  
  // In production, fetch the certificate and verify the signature
  // This is a simplified example
  return true;
}

const isValid = verifySNSSignature($input.item.json);

if (!isValid) {
  throw new Error('Invalid SNS signature');
}

return { json: $input.item.json };
```

### Webhook Authentication

Add authentication to your n8n webhook:

1. In the Webhook node, set **Authentication**: Header Auth
2. Configure a secret token
3. Update SNS subscription to include the auth header (requires custom Lambda)

### Network Security

For private n8n instances:

1. Use VPC endpoints for SNS
2. Configure security groups to allow SNS IP ranges
3. Use AWS PrivateLink for secure connectivity

## Part 9: Best Practices

### 1. Error Handling

Always include error handling in n8n workflows:

```javascript
try {
  // Your processing logic
  const result = processNotification($json);
  return { json: result };
} catch (error) {
  // Log error and continue
  console.error('Error processing notification:', error);
  return { 
    json: { 
      error: error.message,
      originalData: $json 
    } 
  };
}
```

### 2. Idempotency

Handle duplicate notifications gracefully:

```javascript
// Store processed message IDs
const processedIds = $workflow.staticData.processedIds || new Set();
const messageId = $json.MessageId;

if (processedIds.has(messageId)) {
  // Already processed, skip
  return null;
}

processedIds.add(messageId);
$workflow.staticData.processedIds = processedIds;

return { json: $json };
```

### 3. Logging

Add comprehensive logging:

```javascript
console.log('Received notification:', {
  messageId: $json.MessageId,
  testId: $json.testId,
  status: $json.status,
  timestamp: new Date().toISOString()
});
```

### 4. Monitoring

Set up n8n workflow monitoring:
- Enable workflow error notifications
- Monitor execution times
- Track success/failure rates
- Set up alerts for workflow failures

### 5. Testing

Test your n8n workflow thoroughly:
- Test with PASS notifications
- Test with FAIL notifications
- Test subscription confirmation
- Test error scenarios
- Test with malformed messages

## Part 10: Complete Workflow Template

Here's a complete n8n workflow JSON you can import:

```json
{
  "name": "AI Testing Platform Notifications",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "test-notifications",
        "responseMode": "onReceived",
        "responseCode": 200
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.Type }}",
              "operation": "equal",
              "value2": "SubscriptionConfirmation"
            }
          ]
        }
      },
      "name": "Is Subscription Confirmation?",
      "type": "n8n-nodes-base.if",
      "position": [450, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ $json.SubscribeURL }}"
      },
      "name": "Confirm Subscription",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 200]
    },
    {
      "parameters": {
        "jsCode": "const snsMessage = JSON.parse($input.item.json.Message);\n\nreturn {\n  json: {\n    resultId: snsMessage.resultId,\n    testId: snsMessage.testId,\n    status: snsMessage.status,\n    duration: snsMessage.duration,\n    testName: snsMessage.testName,\n    timestamp: snsMessage.timestamp,\n    errorMessage: snsMessage.errorMessage || null,\n    durationSeconds: Math.round(snsMessage.duration / 1000),\n    timestampFormatted: new Date(snsMessage.timestamp).toISOString(),\n    statusEmoji: snsMessage.status === 'PASS' ? '✅' : '❌'\n  }\n};"
      },
      "name": "Parse Message",
      "type": "n8n-nodes-base.code",
      "position": [650, 400]
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.status }}",
              "operation": "equal",
              "value2": "PASS"
            }
          ]
        }
      },
      "name": "Is Success?",
      "type": "n8n-nodes-base.if",
      "position": [850, 400]
    },
    {
      "parameters": {
        "channel": "#test-results",
        "text": "={{ $json.statusEmoji }} Test {{ $json.status }}: {{ $json.testName }}",
        "attachments": [
          {
            "color": "={{ $json.status === 'PASS' ? 'good' : 'danger' }}",
            "fields": [
              {
                "title": "Test ID",
                "value": "={{ $json.testId }}",
                "short": true
              },
              {
                "title": "Duration",
                "value": "={{ $json.durationSeconds }}s",
                "short": true
              }
            ]
          }
        ]
      },
      "name": "Send to Slack",
      "type": "n8n-nodes-base.slack",
      "position": [1050, 400]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "Is Subscription Confirmation?", "type": "main", "index": 0 }]]
    },
    "Is Subscription Confirmation?": {
      "main": [
        [{ "node": "Confirm Subscription", "type": "main", "index": 0 }],
        [{ "node": "Parse Message", "type": "main", "index": 0 }]
      ]
    },
    "Parse Message": {
      "main": [[{ "node": "Is Success?", "type": "main", "index": 0 }]]
    },
    "Is Success?": {
      "main": [
        [{ "node": "Send to Slack", "type": "main", "index": 0 }],
        [{ "node": "Send to Slack", "type": "main", "index": 0 }]
      ]
    }
  }
}
```

## Summary

This guide covered:

✅ Setting up n8n webhook for SNS notifications  
✅ Subscribing the webhook to SNS topic  
✅ Processing test notifications in n8n  
✅ Example workflows for Slack, Jira, Email, and more  
✅ Advanced configurations and routing  
✅ Testing and troubleshooting  
✅ Security considerations  
✅ Best practices  

## Related Documentation

- [SNS Notification Setup](./SNS_NOTIFICATION_SETUP.md) - Comprehensive SNS setup guide
- [SNS Email Subscription Quick Start](./SNS_EMAIL_SUBSCRIPTION_QUICKSTART.md) - Email setup guide
- [CloudWatch Setup](./CLOUDWATCH_SETUP.md) - Monitoring and alarms
- [Infrastructure Deployment](./INFRASTRUCTURE_DEPLOYMENT.md) - CDK deployment guide

## Support

For issues with n8n webhook integration:

1. Check n8n workflow execution logs
2. Review SNS delivery logs in CloudWatch
3. Verify subscription status using AWS CLI
4. Check DLQ for failed messages
5. Test webhook endpoint with curl
6. Contact platform administrators for assistance
