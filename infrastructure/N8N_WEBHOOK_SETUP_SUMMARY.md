# n8n Webhook Setup Summary

## Task 9.3: Set up n8n webhook (if using n8n)

This document summarizes the n8n webhook integration setup completed for the AI Testing Automation Platform.

## What Was Implemented

### 1. Comprehensive Documentation

#### n8n Webhook Setup Guide
**File**: `docs/N8N_WEBHOOK_SETUP.md`

A comprehensive 10-part guide covering:
- **Part 1**: n8n webhook setup (creating workflow, adding webhook node)
- **Part 2**: Subscribing n8n webhook to SNS (CDK and CLI methods)
- **Part 3**: Processing notifications in n8n (payload structure, parsing)
- **Part 4**: n8n workflow examples (Slack, Jira, Email, Dashboard, Database)
- **Part 5**: Advanced configurations (tenant routing, failure thresholds, time-based routing)
- **Part 6**: Testing the integration (test notifications, verification)
- **Part 7**: Monitoring and troubleshooting (CloudWatch, DLQ, common issues)
- **Part 8**: Security considerations (signature verification, authentication, network security)
- **Part 9**: Best practices (error handling, idempotency, logging, monitoring)
- **Part 10**: Complete workflow template (ready-to-import JSON)

#### n8n Quick Start Guide
**File**: `docs/N8N_QUICKSTART.md`

A quick reference guide providing:
- 5-minute setup process
- Step-by-step instructions
- Common issues and solutions
- Customization examples
- Resource links

### 2. Setup Script

**File**: `infrastructure/scripts/setup-n8n-webhook.sh`

An automated bash script that:
- Validates environment configuration
- Locates the SNS topic automatically
- Prompts for n8n webhook URL with validation
- Tests webhook endpoint accessibility
- Subscribes webhook to SNS topic
- Lists current webhook subscriptions
- Provides next steps and testing commands

**Usage**:
```bash
export ENVIRONMENT=dev
export AWS_REGION=us-east-1
./infrastructure/scripts/setup-n8n-webhook.sh
```

### 3. n8n Workflow Examples

#### Basic Notification Workflow
**File**: `docs/n8n-workflow-examples/basic-notification-workflow.json`

A foundational workflow demonstrating:
- Webhook entry point
- Automatic subscription confirmation
- SNS message parsing
- Status-based routing (PASS/FAIL)
- Console logging

**Use cases**:
- Learning n8n integration basics
- Testing webhook setup
- Building custom workflows

#### Slack Notification Workflow
**File**: `docs/n8n-workflow-examples/slack-notification-workflow.json`

A production-ready workflow featuring:
- Webhook entry point
- Automatic subscription confirmation
- SNS message parsing
- Rich Slack message formatting
- Success messages (green, with metadata)
- Failure messages (red, with error details)
- Interactive buttons to view results

**Use cases**:
- Team notifications in Slack
- Real-time test result visibility
- Quick access to detailed results

#### Workflow Examples README
**File**: `docs/n8n-workflow-examples/README.md`

Comprehensive documentation for workflows:
- Import instructions
- Configuration steps
- Testing procedures
- Customization examples
- Troubleshooting guide
- Best practices
- Security considerations

### 4. Infrastructure Support

The existing NotificationStack (from task 9.1) already supports n8n webhooks:

**Webhook Subscription**:
- CDK context parameter: `webhookUrl`
- HTTPS protocol support
- Automatic subscription during deployment
- DLQ configuration for failed deliveries

**Configuration Methods**:

**Method 1: CDK Context**
```bash
cdk deploy --context webhookUrl=https://your-n8n.com/webhook/test-notifications
```

**Method 2: AWS CLI**
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:ai-testing-notifications-ENV \
  --protocol https \
  --notification-endpoint https://your-n8n.com/webhook/test-notifications
```

**Method 3: Setup Script**
```bash
./infrastructure/scripts/setup-n8n-webhook.sh
```

## Integration Flow

```
Test Execution Lambda
        ↓
    SNS Topic
        ↓
  n8n Webhook
        ↓
   n8n Workflow
   (Parse & Route)
        ↓
  Custom Actions
  (Slack, Jira, Email, etc.)
```

## n8n Workflow Structure

All provided workflows follow this pattern:

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

SNS sends notifications to n8n in this format:

```json
{
  "Type": "Notification",
  "MessageId": "12345678-1234-1234-1234-123456789012",
  "TopicArn": "arn:aws:sns:us-east-1:123456789012:ai-testing-notifications-dev",
  "Message": "{\"resultId\":\"result-uuid\",\"testId\":\"test-uuid\",\"status\":\"PASS\",\"duration\":45000,\"testName\":\"Login test\",\"timestamp\":1707753645000}",
  "Timestamp": "2024-02-12T15:34:05.000Z"
}
```

The `Message` field contains the test notification as a JSON string:

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
  "errorMessage": "Optional error for FAIL status"
}
```

## Workflow Examples Provided

### 1. Basic Notification Workflow

**Features**:
- Automatic subscription confirmation
- Message parsing
- Status-based routing
- Console logging

**Best for**:
- Learning and testing
- Building custom workflows
- Simple notification needs

### 2. Slack Notification Workflow

**Features**:
- Automatic subscription confirmation
- Message parsing
- Rich Slack formatting
- Success/failure color coding
- Interactive buttons
- Error details for failures

**Best for**:
- Team collaboration
- Real-time notifications
- Production use

### 3. Customization Examples (in documentation)

**Email Notifications**:
- Gmail integration
- Formatted email templates
- Success/failure templates

**Jira Integration**:
- Automatic ticket creation for failures
- Test metadata in ticket description
- Priority assignment

**Dashboard Updates**:
- HTTP requests to custom APIs
- Real-time dashboard updates
- Test result tracking

**Database Storage**:
- PostgreSQL/MySQL integration
- Test result persistence
- Historical data analysis

**Tenant-Specific Routing**:
- Route by tenant ID
- Different channels per tenant
- Custom logic per tenant

**Failure Threshold Alerting**:
- Track repeated failures
- Alert only on threshold
- Prevent alert fatigue

**Time-Based Routing**:
- Business hours vs. off-hours
- Different urgency levels
- Conditional notifications

## Setup Process

### Quick Setup (5 Minutes)

1. **Import workflow** → Choose basic or Slack template
2. **Configure** → Add Slack credentials (if using Slack workflow)
3. **Activate** → Enable workflow and copy webhook URL
4. **Subscribe** → Run setup script or use AWS CLI
5. **Verify** → Check n8n executions for confirmation
6. **Test** → Send test notification via AWS CLI

### Detailed Setup

See the comprehensive guide: `docs/N8N_WEBHOOK_SETUP.md`

## Testing

### Test 1: Subscription Confirmation

1. Subscribe webhook to SNS
2. Check n8n executions
3. Verify SubscriptionConfirmation was received
4. Confirm SubscribeURL was accessed

### Test 2: Test Notification

```bash
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:ai-testing-notifications-dev \
  --message '{"resultId":"test-123","testId":"test-456","status":"PASS","duration":45000,"testName":"Test notification","timestamp":1707753645000}' \
  --subject "Test Notification" \
  --region us-east-1
```

### Test 3: End-to-End

1. Run actual test execution
2. Wait for completion
3. Verify notification in n8n
4. Check downstream actions (Slack, etc.)

## Requirements Satisfied

This implementation satisfies the following requirements:

- ✓ **Requirement 5.1**: Send success notifications for PASS status
- ✓ **Requirement 5.2**: Send failure notifications with error summary for FAIL status
- ✓ **Requirement 5.3**: Include test execution metadata in notifications
- ✓ **Requirement 5.6**: Retry policies for failed notifications (via DLQ)

## Security Features

1. **HTTPS Required**: SNS only sends to HTTPS endpoints
2. **Signature Verification**: Documentation includes SNS signature verification example
3. **Webhook Authentication**: Guidance for adding authentication
4. **Network Security**: VPC and security group recommendations
5. **Access Control**: Best practices for workflow access

## Monitoring and Troubleshooting

### CloudWatch Monitoring

- SNS delivery logs
- DLQ message count
- Delivery success/failure rates

### n8n Monitoring

- Workflow execution logs
- Success/failure tracking
- Execution time monitoring

### Common Issues Documented

1. **Webhook not receiving messages**
   - Workflow not active
   - Subscription not confirmed
   - Webhook URL not HTTPS
   - Network accessibility issues

2. **Subscription not confirming**
   - SubscribeURL not accessed
   - Workflow error during confirmation
   - Manual confirmation needed

3. **Message parsing errors**
   - Invalid JSON in Message field
   - Missing error handling
   - Unexpected message format

4. **Slack messages not sending**
   - Invalid credentials
   - Missing channel access
   - Incorrect channel ID

## Best Practices Implemented

✓ **Automatic Confirmation**: Workflows handle subscription confirmation automatically  
✓ **Error Handling**: Examples include try-catch blocks  
✓ **Idempotency**: Guidance for handling duplicate messages  
✓ **Logging**: Comprehensive logging examples  
✓ **Monitoring**: Workflow execution monitoring recommendations  
✓ **Testing**: Multiple testing approaches documented  
✓ **Security**: Signature verification and authentication guidance  
✓ **Flexibility**: Multiple workflow examples for different use cases  

## Advanced Features Documented

### Tenant-Specific Routing

Route notifications to different channels based on tenant:

```javascript
const tenantId = $json.tenantId;
let channel = tenantId === 'tenant-1' ? '#tenant-1-tests' : '#general-tests';
```

### Failure Threshold Alerting

Alert only after repeated failures:

```javascript
const recentFailures = $workflow.staticData.failures || {};
if (status === 'FAIL') {
  recentFailures[testId] = (recentFailures[testId] || 0) + 1;
  if (recentFailures[testId] >= 3) {
    // Alert
  }
}
```

### Time-Based Routing

Different handling for business hours vs. off-hours:

```javascript
const hour = new Date().getHours();
const isBusinessHours = hour >= 9 && hour < 17;
```

## Files Created

### Documentation
- `docs/N8N_WEBHOOK_SETUP.md` - Comprehensive 10-part setup guide
- `docs/N8N_QUICKSTART.md` - Quick start guide (5 minutes)
- `docs/n8n-workflow-examples/README.md` - Workflow examples documentation

### Scripts
- `infrastructure/scripts/setup-n8n-webhook.sh` - Automated setup script

### Workflow Templates
- `docs/n8n-workflow-examples/basic-notification-workflow.json` - Basic workflow
- `docs/n8n-workflow-examples/slack-notification-workflow.json` - Slack workflow

### Summary
- `infrastructure/N8N_WEBHOOK_SETUP_SUMMARY.md` - This document

## Next Steps

After setting up n8n webhook integration:

1. ✓ Import a workflow template
2. ✓ Configure credentials (if using Slack/Jira/etc.)
3. ✓ Activate the workflow
4. ✓ Subscribe webhook to SNS
5. ✓ Verify subscription confirmation
6. ✓ Send test notification
7. ✓ Customize workflow for your needs
8. ✓ Monitor workflow executions
9. ✓ Set up additional integrations (email, Jira, etc.)
10. ✓ Document your customizations

## Support Resources

- **Quick Start**: `docs/N8N_QUICKSTART.md`
- **Detailed Guide**: `docs/N8N_WEBHOOK_SETUP.md`
- **Workflow Examples**: `docs/n8n-workflow-examples/`
- **SNS Setup**: `docs/SNS_NOTIFICATION_SETUP.md`
- **CloudWatch Monitoring**: `docs/CLOUDWATCH_SETUP.md`

## Verification

All documentation and examples have been created and tested:

✓ Comprehensive setup guide (10 parts)  
✓ Quick start guide (5 minutes)  
✓ Automated setup script  
✓ Basic workflow template  
✓ Slack workflow template  
✓ Workflow examples documentation  
✓ Advanced configuration examples  
✓ Security considerations  
✓ Troubleshooting guide  
✓ Best practices  

## Summary

The n8n webhook integration is fully documented and ready to use. Users can:

1. **Quick Start**: Import a workflow and be running in 5 minutes
2. **Customize**: Extensive examples for Slack, Jira, Email, and more
3. **Automate**: Setup script handles subscription automatically
4. **Monitor**: Comprehensive monitoring and troubleshooting guidance
5. **Secure**: Security best practices and signature verification examples
6. **Scale**: Advanced features for tenant routing and failure alerting

---

**Task Status**: ✓ Complete  
**Requirements Satisfied**: 5.1, 5.2, 5.3, 5.6  
**Documentation**: Complete (5 files)  
**Workflow Templates**: 2 ready-to-use templates  
**Setup Script**: Automated subscription script  

The n8n webhook integration is production-ready and fully documented!
