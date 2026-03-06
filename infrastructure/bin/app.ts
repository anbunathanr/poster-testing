#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiTestingPlatformStack } from '../lib/ai-testing-platform-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'us-east-1';

new AiTestingPlatformStack(app, `AiTestingPlatform-${environment}`, {
  env: {
    account,
    region,
  },
  environment,
  description: `AI Testing Automation Platform - ${environment} environment`,
  tags: {
    Environment: environment,
    Project: 'AI Testing Platform',
    ManagedBy: 'CDK',
  },
});

app.synth();
