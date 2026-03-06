/**
 * DynamoDB Test Operations
 * Handles CRUD operations for the Tests table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Test, TestScript, Environment } from '../types';

// Initialize DynamoDB client lazily
let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({});
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

const TESTS_TABLE = process.env.TESTS_TABLE || 'Tests';

/**
 * Input for creating a new test
 */
export interface CreateTestInput {
  tenantId: string;
  userId: string;
  testPrompt: string;
  testScript: TestScript;
  environment: Environment;
  testName?: string;
}

/**
 * Creates a new test in the Tests table
 *
 * @param input - Test creation data
 * @returns The created test
 * @throws Error if test creation fails or validation fails
 */
export async function createTest(input: CreateTestInput): Promise<Test> {
  // Validate input
  if (!input.tenantId || input.tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!input.userId || input.userId.trim() === '') {
    throw new Error('User ID is required');
  }
  if (!input.testPrompt || input.testPrompt.trim() === '') {
    throw new Error('Test prompt is required');
  }
  if (!input.testScript || !input.testScript.steps || input.testScript.steps.length === 0) {
    throw new Error('Test script with steps is required');
  }
  if (!input.environment) {
    throw new Error('Environment is required');
  }

  const now = Date.now();
  const test: Test = {
    testId: uuidv4(),
    tenantId: input.tenantId,
    userId: input.userId,
    testPrompt: input.testPrompt,
    testScript: input.testScript,
    environment: input.environment,
    createdAt: now,
    status: 'READY',
  };

  // Add testName if provided
  if (input.testName && input.testName.trim() !== '') {
    (test as any).testName = input.testName.trim();
  }

  const command = new PutCommand({
    TableName: TESTS_TABLE,
    Item: test,
  });

  try {
    await getDocClient().send(command);
    return test;
  } catch (error) {
    throw new Error(
      `Failed to create test: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Retrieves a test by testId and tenantId
 *
 * @param tenantId - Tenant identifier
 * @param testId - Test identifier
 * @returns The test if found, null otherwise
 * @throws Error if query fails
 */
export async function getTest(tenantId: string, testId: string): Promise<Test | null> {
  // Validate input
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!testId || testId.trim() === '') {
    throw new Error('Test ID is required');
  }

  const command = new GetCommand({
    TableName: TESTS_TABLE,
    Key: {
      tenantId,
      testId,
    },
  });

  try {
    const response = await getDocClient().send(command);

    if (!response.Item) {
      return null;
    }

    return response.Item as Test;
  } catch (error) {
    throw new Error(
      `Failed to get test: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Lists tests for a specific user
 * Uses the userId-createdAt GSI for efficient lookup
 *
 * @param userId - User identifier
 * @param limit - Maximum number of tests to return (default: 20)
 * @param lastEvaluatedKey - Pagination token from previous query
 * @returns Tests and pagination token
 * @throws Error if query fails
 */
export async function listTestsByUser(
  userId: string,
  limit: number = 20,
  lastEvaluatedKey?: Record<string, any>
): Promise<{ tests: Test[]; lastEvaluatedKey?: Record<string, any> }> {
  // Validate input
  if (!userId || userId.trim() === '') {
    throw new Error('User ID is required');
  }

  const command = new QueryCommand({
    TableName: TESTS_TABLE,
    IndexName: 'userId-createdAt-index',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
    ScanIndexForward: false, // Sort by createdAt descending (newest first)
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey,
  });

  try {
    const response = await getDocClient().send(command);

    return {
      tests: (response.Items || []) as Test[],
      lastEvaluatedKey: response.LastEvaluatedKey,
    };
  } catch (error) {
    throw new Error(
      `Failed to list tests by user: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Updates test status
 *
 * @param tenantId - Tenant identifier
 * @param testId - Test identifier
 * @param status - New status
 * @returns The updated test
 * @throws Error if test not found or update fails
 */
export async function updateTestStatus(
  tenantId: string,
  testId: string,
  status: Test['status']
): Promise<Test> {
  // Validate input
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!testId || testId.trim() === '') {
    throw new Error('Test ID is required');
  }

  const validStatuses: Test['status'][] = ['DRAFT', 'READY', 'EXECUTING', 'COMPLETED'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Verify test exists
  const existingTest = await getTest(tenantId, testId);
  if (!existingTest) {
    throw new Error('Test not found');
  }

  const command = new UpdateCommand({
    TableName: TESTS_TABLE,
    Key: {
      tenantId,
      testId,
    },
    UpdateExpression: 'SET #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': status,
    },
    ReturnValues: 'ALL_NEW',
  });

  try {
    const response = await getDocClient().send(command);

    if (!response.Attributes) {
      throw new Error('Failed to update test status');
    }

    return response.Attributes as Test;
  } catch (error) {
    throw new Error(
      `Failed to update test status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
