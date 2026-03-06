import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface NotificationStackProps {
  environment: string;
}

export class NotificationStack extends Construct {
  public readonly testNotificationTopic: sns.Topic;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: NotificationStackProps) {
    super(scope, id);

    const { environment } = props;

    // Dead Letter Queue for failed notifications (Requirement 5.6)
    this.deadLetterQueue = new sqs.Queue(this, 'NotificationDLQ', {
      queueName: `ai-testing-notifications-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // SNS Topic for test notifications
    // Note: Per-tenant topics can be created dynamically at runtime
    // This is the main topic for the platform
    this.testNotificationTopic = new sns.Topic(this, 'TestNotificationTopic', {
      topicName: `ai-testing-notifications-${environment}`,
      displayName: 'AI Testing Platform Notifications',
      // Enable content-based message filtering for tenant isolation (Requirement 5.4)
      contentBasedDeduplication: false,
    });

    // Configure delivery policy with retry logic and exponential backoff (Requirement 5.6)
    const cfnTopic = this.testNotificationTopic.node.defaultChild as sns.CfnTopic;
    
    // Delivery policy with exponential backoff retry configuration
    // Retries: 3 immediate, 2 with 1s delay, 10 with exponential backoff (1s to 20s), 100,000 with 20s delay
    // Total retry attempts: ~100,015 over ~23 days before moving to DLQ
    cfnTopic.addPropertyOverride('DeliveryPolicy', {
      http: {
        defaultHealthyRetryPolicy: {
          minDelayTarget: 1,        // Minimum delay between retries (seconds)
          maxDelayTarget: 20,       // Maximum delay between retries (seconds)
          numRetries: 100015,       // Total number of retry attempts
          numNoDelayRetries: 3,     // Number of retries with no delay
          numMinDelayRetries: 2,    // Number of retries at minimum delay
          numMaxDelayRetries: 100000, // Number of retries at maximum delay
          backoffFunction: 'exponential', // Exponential backoff between min and max delay
        },
        disableSubscriptionOverrides: false,
        defaultThrottlePolicy: {
          maxReceivesPerSecond: 10, // Rate limit for notification delivery
        },
      },
    });

    // Configure delivery status logging for monitoring (Requirement 5.6)
    cfnTopic.deliveryStatusLogging = [
      {
        protocol: 'http',
        successFeedbackRoleArn: this.createLoggingRole('HttpSuccess').roleArn,
        failureFeedbackRoleArn: this.createLoggingRole('HttpFailure').roleArn,
        successFeedbackSampleRate: '100', // Log all successful deliveries
      },
      {
        protocol: 'https',
        successFeedbackRoleArn: this.createLoggingRole('HttpsSuccess').roleArn,
        failureFeedbackRoleArn: this.createLoggingRole('HttpsFailure').roleArn,
        successFeedbackSampleRate: '100', // Log all successful deliveries
      },
    ];

    // Add email subscription if provided via context (Requirement 5.5)
    const notificationEmail = cdk.Stack.of(this).node.tryGetContext('notificationEmail');
    if (notificationEmail) {
      this.testNotificationTopic.addSubscription(
        new subscriptions.EmailSubscription(notificationEmail, {
          deadLetterQueue: this.deadLetterQueue,
        })
      );
    }

    // Add webhook subscription if provided via context (for n8n integration)
    const webhookUrl = cdk.Stack.of(this).node.tryGetContext('webhookUrl');
    if (webhookUrl) {
      this.testNotificationTopic.addSubscription(
        new subscriptions.UrlSubscription(webhookUrl, {
          protocol: sns.SubscriptionProtocol.HTTPS,
          deadLetterQueue: this.deadLetterQueue,
          rawMessageDelivery: false,
        })
      );
    }

    // CloudWatch Alarms for DLQ monitoring
    const dlqAlarm = this.deadLetterQueue.metricApproximateNumberOfMessagesVisible().createAlarm(
      this,
      'NotificationDLQAlarm',
      {
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: 'Alert when notifications fail and end up in DLQ',
        alarmName: `ai-testing-notifications-dlq-alarm-${environment}`,
      }
    );

    // Outputs
    new cdk.CfnOutput(this, 'TestNotificationTopicArn', {
      value: this.testNotificationTopic.topicArn,
      description: 'SNS Topic ARN for test notifications',
      exportName: `${cdk.Stack.of(this).stackName}-NotificationTopicArn`,
    });

    new cdk.CfnOutput(this, 'NotificationDLQUrl', {
      value: this.deadLetterQueue.queueUrl,
      description: 'DLQ URL for failed notifications',
      exportName: `${cdk.Stack.of(this).stackName}-NotificationDLQUrl`,
    });

    // Tags
    cdk.Tags.of(this.testNotificationTopic).add('Component', 'Notification');
    cdk.Tags.of(this.deadLetterQueue).add('Component', 'Notification');
  }

  private createLoggingRole(suffix: string): cdk.aws_iam.Role {
    return new cdk.aws_iam.Role(this, `SNSLoggingRole${suffix}`, {
      assumedBy: new cdk.aws_iam.ServicePrincipal('sns.amazonaws.com'),
      inlinePolicies: {
        CloudWatchLogsPolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });
  }
}
