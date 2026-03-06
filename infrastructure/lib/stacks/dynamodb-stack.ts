import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DynamoDBStackProps {
  environment: string;
}

export class DynamoDBStack extends Construct {
  public readonly usersTable: dynamodb.Table;
  public readonly testsTable: dynamodb.Table;
  public readonly testResultsTable: dynamodb.Table;
  public readonly environmentsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDBStackProps) {
    super(scope, id);

    const { environment } = props;

    // Users Table
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `ai-testing-users-${environment}`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for tenant-based queries
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'tenantId-email-index',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Tests Table
    this.testsTable = new dynamodb.Table(this, 'TestsTable', {
      tableName: `ai-testing-tests-${environment}`,
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'testId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for user-based queries
    this.testsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // TestResults Table
    this.testResultsTable = new dynamodb.Table(this, 'TestResultsTable', {
      tableName: `ai-testing-results-${environment}`,
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'resultId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for test-based queries
    this.testResultsTable.addGlobalSecondaryIndex({
      indexName: 'testId-startTime-index',
      partitionKey: {
        name: 'testId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'startTime',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Environments Table
    this.environmentsTable = new dynamodb.Table(this, 'EnvironmentsTable', {
      tableName: `ai-testing-environments-${environment}`,
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'environment',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Tags
    cdk.Tags.of(this.usersTable).add('Component', 'Database');
    cdk.Tags.of(this.testsTable).add('Component', 'Database');
    cdk.Tags.of(this.testResultsTable).add('Component', 'Database');
    cdk.Tags.of(this.environmentsTable).add('Component', 'Database');
  }
}
