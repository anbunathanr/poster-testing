# SNS Notification Retry Policy Configuration

## Overview

This document describes the retry policy configuration for SNS notification delivery in the AI Testing Automation Platform. The retry policy ensures that failed notifications are retried with exponential backoff before being sent to the Dead Letter Queue (DLQ).

## Retry Policy Configuration

### Exponential Backoff Strategy

The SNS topic is configured with an exponential backoff retry policy that provides multiple retry attempts with increasing delays:

```typescript
{
  minDelayTarget: 1,        // Minimum delay: 1 second
  maxDelayTarget: 20,       // Maximum delay: 20 seconds
  numRetries: 100015,       // Total retry attempts
  numNoDelayRetries: 3,     // Immediate retries: 3
  numMinDelayRetries: 2,    // Retries at min delay: 2
  numMaxDelayRetries: 100000, // Retries at max delay: 100,000
  backoffFunction: 'exponential'
}
```

### Retry Phases

The retry policy operates in four distinct phases:

#### Phase 1: Immediate Retries (3 attempts)
- **Delay**: 0 seconds
- **Attempts**: 3
- **Purpose**: Handle transient network issues or temporary endpoint unavailability

#### Phase 2: Minimum Delay Retries (2 attempts)
- **Delay**: 1 second
- **Attempts**: 2
- **Purpose**: Allow brief recovery time for the endpoint

#### Phase 3: Exponential Backoff (10 attempts)
- **Delay**: Exponentially increases from 1s to 20s
- **Attempts**: 10
- **Backoff Sequence**: ~1s, 2s, 4s, 8s, 16s, 20s, 20s, 20s, 20s, 20s
- **Purpose**: Handle longer endpoint outages with increasing delays

#### Phase 4: Maximum Delay Retries (100,000 attempts)
- **Delay**: 20 seconds
- **Attempts**: 100,000
- **Duration**: ~23 days
- **Purpose**: Provide extended retry period for prolonged outages

### Total Retry Duration

- **Total Attempts**: 100,015
- **Total Duration**: Approximately 23 days
- **After All Retries**: Message is moved to the Dead Letter Queue (DLQ)

## Dead Letter Queue (DLQ)

### Configuration

```typescript
{
  queueName: `ai-testing-notifications-dlq-${environment}`,
  retentionPeriod: 14 days,
  encryption: SQS_MANAGED
}
```

### Purpose

The DLQ captures notifications that fail after all retry attempts have been exhausted. This ensures:

1. **No Message Loss**: Failed notifications are preserved for investigation
2. **Monitoring**: CloudWatch alarms trigger when messages enter the DLQ
3. **Manual Recovery**: Operations team can review and manually reprocess failed notifications

### DLQ Monitoring

A CloudWatch alarm is configured to alert when messages appear in the DLQ:

```typescript
{
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'Alert when notifications fail and end up in DLQ'
}
```

## Delivery Status Logging

### Configuration

All notification delivery attempts are logged to CloudWatch Logs with 100% sampling rate:

```typescript
{
  successFeedbackSampleRate: '100',  // Log all successful deliveries
  successFeedbackRoleArn: '<IAM Role ARN>',
  failureFeedbackRoleArn: '<IAM Role ARN>'
}
```

### Log Information

Delivery logs include:

- **Success Logs**: Confirmation of successful delivery with timestamp
- **Failure Logs**: Error details, HTTP status codes, retry attempts
- **Protocol**: HTTP/HTTPS protocol used for delivery

## Throttling Policy

To prevent overwhelming downstream systems, a throttling policy is configured:

```typescript
{
  maxReceivesPerSecond: 10  // Maximum 10 notifications per second
}
```

This ensures that notification endpoints are not overloaded during high-volume test execution periods.

## Subscription-Level Configuration

Individual SNS subscriptions (email, webhook) can override the topic-level retry policy if needed:

```typescript
{
  deadLetterQueue: this.deadLetterQueue,  // DLQ for failed deliveries
  rawMessageDelivery: false  // Wrap messages in SNS envelope
}
```

## Monitoring and Alerting

### CloudWatch Metrics

Monitor the following metrics to track notification delivery health:

- `NumberOfNotificationsFailed`: Failed delivery attempts
- `NumberOfNotificationsDelivered`: Successful deliveries
- `NumberOfMessagesPublished`: Total messages published to topic

### CloudWatch Alarms

- **DLQ Alarm**: Triggers when messages enter the DLQ (threshold: 1 message)
- **Failure Rate Alarm**: Triggers when failure rate exceeds acceptable threshold

### CloudWatch Logs

All delivery attempts are logged to CloudWatch Logs:

- **Log Group**: `/aws/sns/${environment}/ai-testing-notifications`
- **Retention**: 30 days
- **Content**: Success/failure status, error messages, retry attempts

## Best Practices

### For Operations Teams

1. **Monitor DLQ**: Regularly check the DLQ for failed notifications
2. **Investigate Failures**: Review CloudWatch logs to identify root causes
3. **Manual Reprocessing**: Reprocess DLQ messages after resolving issues
4. **Endpoint Health**: Ensure notification endpoints (email, webhooks) are operational

### For Developers

1. **Idempotent Handlers**: Ensure notification handlers are idempotent (can handle duplicate deliveries)
2. **Timeout Configuration**: Set appropriate timeouts for webhook endpoints
3. **Error Handling**: Return appropriate HTTP status codes (2xx for success, 5xx for retry)
4. **Testing**: Test notification delivery with simulated failures

## Troubleshooting

### High Retry Rate

**Symptom**: Many retry attempts in CloudWatch logs

**Possible Causes**:
- Webhook endpoint is down or unreachable
- Email service is experiencing issues
- Network connectivity problems

**Resolution**:
1. Check endpoint health and availability
2. Review CloudWatch logs for error details
3. Verify network connectivity and security groups
4. Consider temporarily disabling problematic subscriptions

### Messages in DLQ

**Symptom**: CloudWatch alarm triggered for DLQ messages

**Possible Causes**:
- Endpoint permanently unavailable
- Invalid webhook URL or email address
- Authentication failures

**Resolution**:
1. Review DLQ messages to identify the issue
2. Fix the underlying problem (update URL, fix endpoint, etc.)
3. Manually reprocess DLQ messages
4. Monitor for recurrence

### No Notifications Received

**Symptom**: Test executions complete but no notifications are received

**Possible Causes**:
- SNS topic not configured correctly
- Subscription not confirmed (email)
- Webhook endpoint rejecting messages
- IAM permissions issues

**Resolution**:
1. Verify SNS topic configuration
2. Confirm email subscriptions
3. Check webhook endpoint logs
4. Review IAM roles and permissions
5. Check CloudWatch logs for delivery attempts

## Configuration Examples

### Email Subscription with DLQ

```typescript
topic.addSubscription(
  new subscriptions.EmailSubscription('user@example.com', {
    deadLetterQueue: dlq,
  })
);
```

### Webhook Subscription with DLQ

```typescript
topic.addSubscription(
  new subscriptions.UrlSubscription('https://webhook.example.com', {
    protocol: sns.SubscriptionProtocol.HTTPS,
    deadLetterQueue: dlq,
    rawMessageDelivery: false,
  })
);
```

## References

- [AWS SNS Delivery Policies](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html)
- [AWS SNS Dead Letter Queues](https://docs.aws.amazon.com/sns/latest/dg/sns-dead-letter-queues.html)
- [AWS SNS Delivery Status Logging](https://docs.aws.amazon.com/sns/latest/dg/sns-topic-attributes.html)
- [Requirement 5.6: Notification Retry Policies](../requirements.md#requirement-5-test-result-notifications)

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2024-01-XX | 1.0 | AI Testing Platform Team | Initial documentation |
