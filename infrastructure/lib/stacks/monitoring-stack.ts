import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface MonitoringStackProps {
  environment: string;
  lambdaFunctions: lambda.Function[];
  api: apigateway.RestApi;
  dynamoDBTables: dynamodb.Table[];
}

export class MonitoringStack extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id);

    const { environment, lambdaFunctions, api, dynamoDBTables } = props;

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `ai-testing-alarms-${environment}`,
      displayName: 'AI Testing Platform Alarms',
    });

    // Add email subscription if provided via context
    const alarmEmail = cdk.Stack.of(this).node.tryGetContext('alarmEmail');
    if (alarmEmail) {
      this.alarmTopic.addSubscription(
        new subscriptions.EmailSubscription(alarmEmail)
      );
    }

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `ai-testing-platform-${environment}`,
    });

    // Lambda Metrics
    const lambdaWidgets: cloudwatch.IWidget[] = [];

    lambdaFunctions.forEach((fn) => {
      // Invocations
      const invocationsMetric = fn.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Errors
      const errorsMetric = fn.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Duration
      const durationMetric = fn.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      // Error Rate Alarm
      const errorRateAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ErrorRateAlarm`, {
        alarmName: `${fn.functionName}-error-rate`,
        metric: errorsMetric,
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorRateAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

      // Add widget to dashboard
      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${fn.functionName} Metrics`,
          left: [invocationsMetric, errorsMetric],
          right: [durationMetric],
          width: 12,
        })
      );
    });

    this.dashboard.addWidgets(...lambdaWidgets);

    // API Gateway Metrics
    const apiRequests = api.metricCount({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api4xxErrors = api.metricClientError({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api5xxErrors = api.metricServerError({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiLatency = api.metricLatency({
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // API 5xx Error Alarm
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxErrorAlarm', {
      alarmName: `${api.restApiName}-5xx-errors`,
      metric: api5xxErrors,
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    api5xxAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Metrics',
        left: [apiRequests, api4xxErrors, api5xxErrors],
        right: [apiLatency],
        width: 24,
      })
    );

    // DynamoDB Metrics
    const dynamoWidgets: cloudwatch.IWidget[] = [];

    dynamoDBTables.forEach((table) => {
      const readThrottleMetric = table.metricUserErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Throttling Alarm
      const throttleAlarm = new cloudwatch.Alarm(this, `${table.node.id}ThrottleAlarm`, {
        alarmName: `${table.tableName}-throttling`,
        metric: readThrottleMetric,
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      throttleAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

      dynamoWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${table.tableName} Throttling`,
          left: [readThrottleMetric],
          width: 12,
        })
      );
    });

    this.dashboard.addWidgets(...dynamoWidgets);

    // Custom Metrics (to be emitted by Lambda functions)
    const testSuccessRate = new cloudwatch.Metric({
      namespace: 'AiTestingPlatform',
      metricName: 'TestSuccessRate',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const testExecutionDuration = new cloudwatch.Metric({
      namespace: 'AiTestingPlatform',
      metricName: 'TestExecutionDuration',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const testGenerationDuration = new cloudwatch.Metric({
      namespace: 'AiTestingPlatform',
      metricName: 'TestGenerationDuration',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Test Failure Rate Alarm
    const testFailureAlarm = new cloudwatch.Alarm(this, 'TestFailureRateAlarm', {
      alarmName: `test-failure-rate-${environment}`,
      metric: testSuccessRate,
      threshold: 0.8, // Alert if success rate drops below 80%
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    testFailureAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Test Execution Metrics',
        left: [testSuccessRate],
        right: [testExecutionDuration, testGenerationDuration],
        width: 24,
      })
    );

    // Tags
    cdk.Tags.of(this.dashboard).add('Component', 'Monitoring');
  }
}
