import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import { PlaywrightLayer } from '../constructs/playwright-layer';

export interface LambdaStackProps {
  environment: string;
  usersTable: dynamodb.Table;
  testsTable: dynamodb.Table;
  testResultsTable: dynamodb.Table;
  environmentsTable: dynamodb.Table;
  evidenceBucket: s3.Bucket;
  notificationTopic: sns.Topic;
}

export class LambdaStack extends Construct {
  public readonly authLambda: lambda.Function;
  public readonly testGenLambda: lambda.Function;
  public readonly testExecLambda: lambda.Function;
  public readonly storageLambda: lambda.Function;
  public readonly reportLambda: lambda.Function;
  public readonly authorizerLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id);

    const {
      environment,
      usersTable,
      testsTable,
      testResultsTable,
      environmentsTable,
      evidenceBucket,
      notificationTopic,
    } = props;

    // Create Playwright Lambda Layer for test execution
    const playwrightLayer = new PlaywrightLayer(this, 'PlaywrightLayer', {
      layerName: `playwright-chromium-${environment}`,
      description: `Playwright with Chromium for ${environment} environment`,
    });

    // Common environment variables
    const commonEnv = {
      ENVIRONMENT: environment,
      USERS_TABLE: usersTable.tableName,
      TESTS_TABLE: testsTable.tableName,
      TEST_RESULTS_TABLE: testResultsTable.tableName,
      ENVIRONMENTS_TABLE: environmentsTable.tableName,
      EVIDENCE_BUCKET: evidenceBucket.bucketName,
      NOTIFICATION_TOPIC_ARN: notificationTopic.topicArn,
      JWT_SECRET: 'CHANGE_ME_IN_PRODUCTION', // Should use Secrets Manager in production
    };

    // Auth Lambda
    this.authLambda = new lambda.Function(this, 'AuthLambda', {
      functionName: `ai-testing-auth-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../dist/lambdas/auth')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    usersTable.grantReadWriteData(this.authLambda);

    // Authorizer Lambda
    this.authorizerLambda = new lambda.Function(this, 'AuthorizerLambda', {
      functionName: `ai-testing-authorizer-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../dist/lambdas/authorizer')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Test Generation Lambda
    this.testGenLambda = new lambda.Function(this, 'TestGenLambda', {
      functionName: `ai-testing-testgen-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../dist/lambdas/testgen')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    testsTable.grantReadWriteData(this.testGenLambda);
    environmentsTable.grantReadData(this.testGenLambda);

    // Grant Bedrock access
    this.testGenLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: ['*'], // Should be restricted to specific model ARN in production
      })
    );

    // Test Execution Lambda
    this.testExecLambda = new lambda.Function(this, 'TestExecLambda', {
      functionName: `ai-testing-testexec-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../dist/lambdas/testexec')),
      timeout: cdk.Duration.seconds(300), // 5 minutes
      memorySize: 2048,
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
      reservedConcurrentExecutions: 100, // Limit concurrent executions
      layers: [playwrightLayer.layer], // Add Playwright layer
    });

    testsTable.grantReadData(this.testExecLambda);
    testResultsTable.grantReadWriteData(this.testExecLambda);
    environmentsTable.grantReadData(this.testExecLambda);
    evidenceBucket.grantReadWrite(this.testExecLambda);
    notificationTopic.grantPublish(this.testExecLambda);

    // Storage Lambda
    this.storageLambda = new lambda.Function(this, 'StorageLambda', {
      functionName: `ai-testing-storage-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../dist/lambdas/storage')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    testResultsTable.grantReadWriteData(this.storageLambda);
    evidenceBucket.grantReadWrite(this.storageLambda);

    // Report Lambda
    this.reportLambda = new lambda.Function(this, 'ReportLambda', {
      functionName: `ai-testing-report-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../dist/lambdas/report')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    testsTable.grantReadData(this.reportLambda);
    testResultsTable.grantReadData(this.reportLambda);
    evidenceBucket.grantRead(this.reportLambda);

    // Tags
    const lambdas = [
      this.authLambda,
      this.authorizerLambda,
      this.testGenLambda,
      this.testExecLambda,
      this.storageLambda,
      this.reportLambda,
    ];

    lambdas.forEach((fn) => {
      cdk.Tags.of(fn).add('Component', 'Lambda');
    });
  }
}
