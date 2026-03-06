#!/usr/bin/env node

/**
 * Create local DynamoDB tables for testing
 * This script is used in CI/CD pipeline
 */

const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const endpoint = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const region = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({
  endpoint,
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

const tables = [
  {
    TableName: 'ai-testing-users-local',
    KeySchema: [
      { AttributeName: 'tenantId', KeyType: 'HASH' },
      { AttributeName: 'email', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'tenantId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ai-testing-tests-local',
    KeySchema: [
      { AttributeName: 'tenantId', KeyType: 'HASH' },
      { AttributeName: 'testId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'tenantId', AttributeType: 'S' },
      { AttributeName: 'testId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ai-testing-results-local',
    KeySchema: [
      { AttributeName: 'tenantId', KeyType: 'HASH' },
      { AttributeName: 'resultId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'tenantId', AttributeType: 'S' },
      { AttributeName: 'resultId', AttributeType: 'S' },
      { AttributeName: 'testId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'testId-index',
        KeySchema: [
          { AttributeName: 'tenantId', KeyType: 'HASH' },
          { AttributeName: 'testId', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ai-testing-environments-local',
    KeySchema: [
      { AttributeName: 'tenantId', KeyType: 'HASH' },
      { AttributeName: 'environment', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'tenantId', AttributeType: 'S' },
      { AttributeName: 'environment', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function createTables() {
  try {
    // Check existing tables
    const listCommand = new ListTablesCommand({});
    const { TableNames } = await client.send(listCommand);
    
    console.log('Existing tables:', TableNames);

    for (const tableConfig of tables) {
      if (TableNames && TableNames.includes(tableConfig.TableName)) {
        console.log(`Table ${tableConfig.TableName} already exists, skipping...`);
        continue;
      }

      console.log(`Creating table: ${tableConfig.TableName}...`);
      const command = new CreateTableCommand(tableConfig);
      await client.send(command);
      console.log(`✓ Table ${tableConfig.TableName} created successfully`);
    }

    console.log('\n✓ All tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error.message);
    // Don't fail the script - tables might already exist
    process.exit(0);
  }
}

createTables();
