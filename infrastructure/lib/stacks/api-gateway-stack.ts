import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps {
  environment: string;
  authLambda: lambda.Function;
  testGenLambda: lambda.Function;
  testExecLambda: lambda.Function;
  storageLambda: lambda.Function;
  reportLambda: lambda.Function;
  authorizerLambda: lambda.Function;
}

export class ApiGatewayStack extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id);

    const {
      environment,
      authLambda,
      testGenLambda,
      testExecLambda,
      storageLambda,
      reportLambda,
      authorizerLambda,
    } = props;

    // CloudWatch Log Group for API Gateway
    const logGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: `/aws/apigateway/ai-testing-${environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // REST API
    this.api = new apigateway.RestApi(this, 'AiTestingApi', {
      restApiName: `ai-testing-api-${environment}`,
      description: `AI Testing Platform API - ${environment}`,
      deployOptions: {
        stageName: environment,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Should be restricted in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Lambda Authorizer
    const authorizer = new apigateway.TokenAuthorizer(this, 'JwtAuthorizer', {
      handler: authorizerLambda,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Lambda Integrations
    const authIntegration = new apigateway.LambdaIntegration(authLambda);
    const testGenIntegration = new apigateway.LambdaIntegration(testGenLambda);
    const testExecIntegration = new apigateway.LambdaIntegration(testExecLambda);
    const storageIntegration = new apigateway.LambdaIntegration(storageLambda);
    const reportIntegration = new apigateway.LambdaIntegration(reportLambda);

    // /auth resource
    const auth = this.api.root.addResource('auth');
    
    // POST /auth/register
    const register = auth.addResource('register');
    register.addMethod('POST', authIntegration);

    // POST /auth/login
    const login = auth.addResource('login');
    login.addMethod('POST', authIntegration);

    // /tests resource
    const tests = this.api.root.addResource('tests');

    // POST /tests/generate (protected)
    const generate = tests.addResource('generate');
    generate.addMethod('POST', testGenIntegration, {
      authorizer,
    });

    // /tests/{testId} resource
    const testId = tests.addResource('{testId}');

    // POST /tests/{testId}/execute (protected)
    const execute = testId.addResource('execute');
    execute.addMethod('POST', testExecIntegration, {
      authorizer,
    });

    // /tests/{testId}/results resource
    const results = testId.addResource('results');

    // GET /tests/{testId}/results/{resultId} (protected)
    const resultId = results.addResource('{resultId}');
    resultId.addMethod('GET', storageIntegration, {
      authorizer,
    });

    // GET /tests/results (protected) - list all results
    const allResults = tests.addResource('results');
    allResults.addMethod('GET', storageIntegration, {
      authorizer,
    });

    // /reports resource
    const reports = this.api.root.addResource('reports');

    // GET /reports/{resultId} (protected)
    const reportResultId = reports.addResource('{resultId}');
    reportResultId.addMethod('GET', reportIntegration, {
      authorizer,
    });

    // /environments resource
    const environments = this.api.root.addResource('environments');

    // POST /environments (protected)
    environments.addMethod('POST', storageIntegration, {
      authorizer,
    });

    // GET /environments (protected)
    environments.addMethod('GET', storageIntegration, {
      authorizer,
    });

    // /environments/{environment} resource
    const envName = environments.addResource('{environment}');

    // GET /environments/{environment} (protected)
    envName.addMethod('GET', storageIntegration, {
      authorizer,
    });

    // PUT /environments/{environment} (protected)
    envName.addMethod('PUT', storageIntegration, {
      authorizer,
    });

    // DELETE /environments/{environment} (protected)
    envName.addMethod('DELETE', storageIntegration, {
      authorizer,
    });

    // Tags
    cdk.Tags.of(this.api).add('Component', 'API');
  }
}
