import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { NotificationStack } from '../../infrastructure/lib/stacks/notification-stack';

describe('NotificationStack', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
  });

  describe('SNS Topic Creation', () => {
    it('should create SNS topic with correct name and display name', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'ai-testing-notifications-test',
        DisplayName: 'AI Testing Platform Notifications',
      });
    });

    it('should create SNS topic with delivery status logging configured', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        DeliveryStatusLogging: Match.arrayWith([
          Match.objectLike({
            Protocol: 'http',
            SuccessFeedbackSampleRate: '100',
          }),
          Match.objectLike({
            Protocol: 'https',
            SuccessFeedbackSampleRate: '100',
          }),
        ]),
      });
    });

    it('should configure retry policy with exponential backoff', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        DeliveryPolicy: {
          http: {
            defaultHealthyRetryPolicy: {
              minDelayTarget: 1,
              maxDelayTarget: 20,
              numRetries: 100015,
              numNoDelayRetries: 3,
              numMinDelayRetries: 2,
              numMaxDelayRetries: 100000,
              backoffFunction: 'exponential',
            },
            disableSubscriptionOverrides: false,
            defaultThrottlePolicy: {
              maxReceivesPerSecond: 10,
            },
          },
        },
      });
    });

    it('should configure immediate retries for transient failures', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        DeliveryPolicy: Match.objectLike({
          http: Match.objectLike({
            defaultHealthyRetryPolicy: Match.objectLike({
              numNoDelayRetries: 3, // 3 immediate retries
            }),
          }),
        }),
      });
    });

    it('should configure exponential backoff between min and max delay', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        DeliveryPolicy: Match.objectLike({
          http: Match.objectLike({
            defaultHealthyRetryPolicy: Match.objectLike({
              minDelayTarget: 1,
              maxDelayTarget: 20,
              backoffFunction: 'exponential',
            }),
          }),
        }),
      });
    });

    it('should configure throttling policy to prevent endpoint overload', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        DeliveryPolicy: Match.objectLike({
          http: Match.objectLike({
            defaultThrottlePolicy: {
              maxReceivesPerSecond: 10,
            },
          }),
        }),
      });
    });

    it('should allow subscription-level retry policy overrides', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        DeliveryPolicy: Match.objectLike({
          http: Match.objectLike({
            disableSubscriptionOverrides: false,
          }),
        }),
      });
    });

    it('should tag SNS topic with Component tag', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        Tags: Match.arrayWith([
          {
            Key: 'Component',
            Value: 'Notification',
          },
        ]),
      });
    });
  });

  describe('Dead Letter Queue', () => {
    it('should create DLQ with correct configuration', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'ai-testing-notifications-dlq-test',
        MessageRetentionPeriod: 1209600, // 14 days in seconds
        SqsManagedSseEnabled: true,
      });
    });

    it('should create CloudWatch alarm for DLQ', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'ai-testing-notifications-dlq-alarm-test',
        AlarmDescription: 'Alert when notifications fail and end up in DLQ',
        Threshold: 1,
        EvaluationPeriods: 1,
      });
    });
  });

  describe('Email Subscription', () => {
    it('should add email subscription when notificationEmail context is provided', () => {
      // Arrange
      const appWithContext = new cdk.App({
        context: {
          notificationEmail: 'test@example.com',
        },
      });
      const stackWithContext = new cdk.Stack(appWithContext, 'TestStack');

      // Act
      new NotificationStack(stackWithContext, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stackWithContext);
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'email',
        Endpoint: 'test@example.com',
      });
    });

    it('should not add email subscription when notificationEmail context is not provided', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::SNS::Subscription', 0);
    });

    it('should configure DLQ for email subscription', () => {
      // Arrange
      const appWithContext = new cdk.App({
        context: {
          notificationEmail: 'test@example.com',
        },
      });
      const stackWithContext = new cdk.Stack(appWithContext, 'TestStack');

      // Act
      new NotificationStack(stackWithContext, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stackWithContext);
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'email',
        RedrivePolicy: Match.objectLike({
          deadLetterTargetArn: Match.anyValue(),
        }),
      });
    });
  });

  describe('Webhook Subscription', () => {
    it('should add webhook subscription when webhookUrl context is provided', () => {
      // Arrange
      const appWithContext = new cdk.App({
        context: {
          webhookUrl: 'https://webhook.example.com/notify',
        },
      });
      const stackWithContext = new cdk.Stack(appWithContext, 'TestStack');

      // Act
      new NotificationStack(stackWithContext, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stackWithContext);
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'https',
        Endpoint: 'https://webhook.example.com/notify',
      });
    });

    it('should configure DLQ for webhook subscription', () => {
      // Arrange
      const appWithContext = new cdk.App({
        context: {
          webhookUrl: 'https://webhook.example.com/notify',
        },
      });
      const stackWithContext = new cdk.Stack(appWithContext, 'TestStack');

      // Act
      new NotificationStack(stackWithContext, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stackWithContext);
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'https',
        RedrivePolicy: Match.objectLike({
          deadLetterTargetArn: Match.anyValue(),
        }),
      });
    });

    it('should support both email and webhook subscriptions simultaneously', () => {
      // Arrange
      const appWithContext = new cdk.App({
        context: {
          notificationEmail: 'test@example.com',
          webhookUrl: 'https://webhook.example.com/notify',
        },
      });
      const stackWithContext = new cdk.Stack(appWithContext, 'TestStack');

      // Act
      new NotificationStack(stackWithContext, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stackWithContext);
      template.resourceCountIs('AWS::SNS::Subscription', 2);
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'email',
      });
      template.hasResourceProperties('AWS::SNS::Subscription', {
        Protocol: 'https',
      });
    });
  });

  describe('IAM Roles for Logging', () => {
    it('should create IAM roles for SNS delivery status logging', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      // Should create 4 roles: HttpSuccess, HttpFailure, HttpsSuccess, HttpsFailure
      template.resourceCountIs('AWS::IAM::Role', 4);
    });

    it('should configure IAM roles with CloudWatch Logs permissions', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'sns.amazonaws.com',
              },
            },
          ],
        },
        Policies: [
          {
            PolicyDocument: {
              Statement: [
                {
                  Action: [
                    'logs:CreateLogGroup',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents',
                  ],
                  Effect: 'Allow',
                  Resource: '*',
                },
              ],
            },
          },
        ],
      });
    });
  });

  describe('Stack Outputs', () => {
    it('should create outputs for SNS topic ARN and DLQ URL', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      const outputs = template.toJSON().Outputs;
      
      // Check that outputs exist
      expect(outputs).toBeDefined();
      
      // Find outputs by description
      const topicOutput = Object.values(outputs || {}).find(
        (output: any) => output.Description === 'SNS Topic ARN for test notifications'
      );
      const dlqOutput = Object.values(outputs || {}).find(
        (output: any) => output.Description === 'DLQ URL for failed notifications'
      );
      
      expect(topicOutput).toBeDefined();
      expect(dlqOutput).toBeDefined();
    });
  });

  describe('Public Properties', () => {
    it('should expose testNotificationTopic property', () => {
      // Arrange & Act
      const notificationStack = new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      expect(notificationStack.testNotificationTopic).toBeDefined();
      expect(notificationStack.testNotificationTopic.topicArn).toBeDefined();
    });

    it('should expose deadLetterQueue property', () => {
      // Arrange & Act
      const notificationStack = new NotificationStack(stack, 'NotificationStack', {
        environment: 'test',
      });

      // Assert
      expect(notificationStack.deadLetterQueue).toBeDefined();
      expect(notificationStack.deadLetterQueue.queueArn).toBeDefined();
    });
  });

  describe('Environment-specific Configuration', () => {
    it('should create resources with dev environment suffix', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'dev',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'ai-testing-notifications-dev',
      });
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'ai-testing-notifications-dlq-dev',
      });
    });

    it('should create resources with prod environment suffix', () => {
      // Arrange & Act
      new NotificationStack(stack, 'NotificationStack', {
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'ai-testing-notifications-prod',
      });
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'ai-testing-notifications-dlq-prod',
      });
    });
  });
});
