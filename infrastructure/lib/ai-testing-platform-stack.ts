import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DynamoDBStack } from './stacks/dynamodb-stack';
import { S3Stack } from './stacks/s3-stack';
import { LambdaStack } from './stacks/lambda-stack';
import { ApiGatewayStack } from './stacks/api-gateway-stack';
import { MonitoringStack } from './stacks/monitoring-stack';
import { NotificationStack } from './stacks/notification-stack';

export interface AiTestingPlatformStackProps extends cdk.StackProps {
  environment: string;
}

export class AiTestingPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AiTestingPlatformStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // DynamoDB Tables
    const dynamoDBStack = new DynamoDBStack(this, 'DynamoDB', {
      environment,
    });

    // S3 Buckets
    const s3Stack = new S3Stack(this, 'S3', {
      environment,
    });

    // SNS Topics for Notifications
    const notificationStack = new NotificationStack(this, 'Notification', {
      environment,
    });

    // Lambda Functions
    const lambdaStack = new LambdaStack(this, 'Lambda', {
      environment,
      usersTable: dynamoDBStack.usersTable,
      testsTable: dynamoDBStack.testsTable,
      testResultsTable: dynamoDBStack.testResultsTable,
      environmentsTable: dynamoDBStack.environmentsTable,
      evidenceBucket: s3Stack.evidenceBucket,
      notificationTopic: notificationStack.testNotificationTopic,
    });

    // API Gateway
    const apiGatewayStack = new ApiGatewayStack(this, 'ApiGateway', {
      environment,
      authLambda: lambdaStack.authLambda,
      testGenLambda: lambdaStack.testGenLambda,
      testExecLambda: lambdaStack.testExecLambda,
      storageLambda: lambdaStack.storageLambda,
      reportLambda: lambdaStack.reportLambda,
      authorizerLambda: lambdaStack.authorizerLambda,
    });

    // CloudWatch Monitoring
    const monitoringStack = new MonitoringStack(this, 'Monitoring', {
      environment,
      lambdaFunctions: [
        lambdaStack.authLambda,
        lambdaStack.testGenLambda,
        lambdaStack.testExecLambda,
        lambdaStack.storageLambda,
        lambdaStack.reportLambda,
      ],
      api: apiGatewayStack.api,
      dynamoDBTables: [
        dynamoDBStack.usersTable,
        dynamoDBStack.testsTable,
        dynamoDBStack.testResultsTable,
        dynamoDBStack.environmentsTable,
      ],
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: apiGatewayStack.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${id}-ApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'EvidenceBucketName', {
      value: s3Stack.evidenceBucket.bucketName,
      description: 'S3 bucket for test evidence',
      exportName: `${id}-EvidenceBucket`,
    });

    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: notificationStack.testNotificationTopic.topicArn,
      description: 'SNS topic for test notifications',
      exportName: `${id}-NotificationTopic`,
    });
  }
}
