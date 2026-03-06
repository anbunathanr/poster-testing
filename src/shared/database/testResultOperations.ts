/**
 * DynamoDB Test Result Operations
 * Handles CRUD operations for the TestResults table
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
import { TestResult } from '../types';

// Initialize DynamoDB client lazily
let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({});
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

const TEST_RESULTS_TABLE = process.env.TEST_RESULTS_TABLE || 'TestResults';

/**
 * Input for creating a new test result
 */
export interface CreateTestResultInput {
  testId: string;
  tenantId: string;
  userId: string;
  status: 'PASS' | 'FAIL';
  startTime: number;
  endTime: number;
  duration: number;
  screenshotsS3Keys: string[];
  logsS3Key: string;
  errorMessage?: string;
  executionLog: Record<string, any>;
}

/**
 * Creates a new test result in the TestResults table
 * 
 * @param input - Test result creation data
 * @returns The created test result
 * @throws Error if test result creation fails or validation fails
 */
export async function createTestResult(input: CreateTestResultInput): Promise<TestResult> {
  // Validate input
  if (!input.tenantId || input.tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!input.testId || input.testId.trim() === '') {
    throw new Error('Test ID is required');
  }
  if (!input.userId || input.userId.trim() === '') {
    throw new Error('User ID is required');
  }

  const testResult: TestResult = {
    resultId: uuidv4(),
    testId: input.testId,
    tenantId: input.tenantId,
    userId: input.userId,
    status: input.status,
    startTime: input.startTime,
    endTime: input.endTime,
    duration: input.duration,
    screenshotsS3Keys: input.screenshotsS3Keys,
    logsS3Key: input.logsS3Key,
    errorMessage: input.errorMessage,
    executionLog: input.executionLog,
  };

  const command = new PutCommand({
    TableName: TEST_RESULTS_TABLE,
    Item: testResult,
  });

  try {
    await getDocClient().send(command);
    return testResult;
  } catch (error) {
    throw new Error(`Failed to create test result: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieves a test result by resultId and tenantId
 * 
 * @param tenantId - Tenant identifier
 * @param resultId - Test result identifier
 * @returns The test result if found, null otherwise
 * @throws Error if query fails
 */
export async function getTestResult(tenantId: string, resultId: string): Promise<TestResult | null> {
  // Validate input
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!resultId || resultId.trim() === '') {
    throw new Error('Result ID is required');
  }

  const command = new GetCommand({
    TableName: TEST_RESULTS_TABLE,
    Key: {
      tenantId,
      resultId,
    },
  });

  try {
    const response = await getDocClient().send(command);
    
    if (!response.Item) {
      return null;
    }

    return response.Item as TestResult;
  } catch (error) {
    throw new Error(`Failed to get test result: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Lists test results for a specific test
 * Uses the testId-startTime GSI for efficient lookup
 * 
 * @param testId - Test identifier
 * @param limit - Maximum number of results to return (default: 20)
 * @param lastEvaluatedKey - Pagination token from previous query
 * @returns Test results and pagination token
 * @throws Error if query fails
 */
export async function listTestResultsByTest(
  testId: string,
  limit: number = 20,
  lastEvaluatedKey?: Record<string, any>
): Promise<{ results: TestResult[]; lastEvaluatedKey?: Record<string, any> }> {
  // Validate input
  if (!testId || testId.trim() === '') {
    throw new Error('Test ID is required');
  }

  const command = new QueryCommand({
    TableName: TEST_RESULTS_TABLE,
    IndexName: 'testId-startTime-index',
    KeyConditionExpression: 'testId = :testId',
    ExpressionAttributeValues: {
      ':testId': testId,
    },
    ScanIndexForward: false, // Sort by startTime descending (newest first)
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey,
  });

  try {
    const response = await getDocClient().send(command);
    
    return {
      results: (response.Items || []) as TestResult[],
      lastEvaluatedKey: response.LastEvaluatedKey,
    };
  } catch (error) {
    throw new Error(`Failed to list test results: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Input for updating a test result
 */
export interface UpdateTestResultInput {
  tenantId: string;
  resultId: string;
  status?: 'PASS' | 'FAIL' | 'EXECUTING';
  endTime?: number;
  duration?: number;
  screenshotsS3Keys?: string[];
  logsS3Key?: string;
  errorMessage?: string;
  executionLog?: Record<string, any>;
}

/**
 * Updates an existing test result in the TestResults table
 * Supports updating status from EXECUTING to PASS/FAIL and updating metadata
 * Ensures tenant isolation by validating tenantId
 * 
 * @param input - Test result update data
 * @returns The updated test result
 * @throws Error if test result not found, validation fails, or update fails
 */
export async function updateTestResult(input: UpdateTestResultInput): Promise<TestResult> {
  // Validate input
  if (!input.tenantId || input.tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!input.resultId || input.resultId.trim() === '') {
    throw new Error('Result ID is required');
  }

  // First, retrieve the existing test result to ensure it exists and belongs to the tenant
  const existingResult = await getTestResult(input.tenantId, input.resultId);
  
  if (!existingResult) {
    throw new Error('Test result not found');
  }

  // Build update expression dynamically based on provided fields
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  if (input.status !== undefined) {
    updateExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = input.status;
  }

  if (input.endTime !== undefined) {
    updateExpressions.push('#endTime = :endTime');
    expressionAttributeNames['#endTime'] = 'endTime';
    expressionAttributeValues[':endTime'] = input.endTime;
  }

  if (input.duration !== undefined) {
    updateExpressions.push('#duration = :duration');
    expressionAttributeNames['#duration'] = 'duration';
    expressionAttributeValues[':duration'] = input.duration;
  }

  if (input.screenshotsS3Keys !== undefined) {
    updateExpressions.push('#screenshotsS3Keys = :screenshotsS3Keys');
    expressionAttributeNames['#screenshotsS3Keys'] = 'screenshotsS3Keys';
    expressionAttributeValues[':screenshotsS3Keys'] = input.screenshotsS3Keys;
  }

  if (input.logsS3Key !== undefined) {
    updateExpressions.push('#logsS3Key = :logsS3Key');
    expressionAttributeNames['#logsS3Key'] = 'logsS3Key';
    expressionAttributeValues[':logsS3Key'] = input.logsS3Key;
  }

  if (input.errorMessage !== undefined) {
    updateExpressions.push('#errorMessage = :errorMessage');
    expressionAttributeNames['#errorMessage'] = 'errorMessage';
    expressionAttributeValues[':errorMessage'] = input.errorMessage;
  }

  if (input.executionLog !== undefined) {
    updateExpressions.push('#executionLog = :executionLog');
    expressionAttributeNames['#executionLog'] = 'executionLog';
    expressionAttributeValues[':executionLog'] = input.executionLog;
  }

  // If no fields to update, return the existing result
  if (updateExpressions.length === 0) {
    return existingResult;
  }

  const command = new UpdateCommand({
    TableName: TEST_RESULTS_TABLE,
    Key: {
      tenantId: input.tenantId,
      resultId: input.resultId,
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  });

  try {
    const response = await getDocClient().send(command);
    
    if (!response.Attributes) {
      throw new Error('Update failed: No attributes returned');
    }

    return response.Attributes as TestResult;
  } catch (error) {
    throw new Error(`Failed to update test result: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
/**
 * Input for querying test results with filters
 */
export interface QueryTestResultsInput {
  tenantId: string;
  startDate?: number;
  endDate?: number;
  status?: 'PASS' | 'FAIL';
  limit?: number;
  lastEvaluatedKey?: Record<string, any>;
}

/**
 * Queries test results for a tenant with optional filtering
 * Uses the tenantId partition key to retrieve all results for a tenant
 *
 * @param input - Query parameters including filters
 * @returns Test results and pagination token
 * @throws Error if query fails
 */
export async function queryTestResults(
  input: QueryTestResultsInput
): Promise<{ results: TestResult[]; lastEvaluatedKey?: Record<string, any> }> {
  // Validate input
  if (!input.tenantId || input.tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }

  const limit = input.limit || 20;

  // Build query expression
  let keyConditionExpression = 'tenantId = :tenantId';
  const expressionAttributeValues: Record<string, any> = {
    ':tenantId': input.tenantId,
  };

  // Build filter expression for optional filters
  const filterExpressions: string[] = [];

  if (input.startDate !== undefined) {
    filterExpressions.push('startTime >= :startDate');
    expressionAttributeValues[':startDate'] = input.startDate;
  }

  if (input.endDate !== undefined) {
    filterExpressions.push('startTime <= :endDate');
    expressionAttributeValues[':endDate'] = input.endDate;
  }

  if (input.status) {
    filterExpressions.push('#status = :status');
    expressionAttributeValues[':status'] = input.status;
  }

  const command = new QueryCommand({
    TableName: TEST_RESULTS_TABLE,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ...(filterExpressions.length > 0 && {
      FilterExpression: filterExpressions.join(' AND '),
      ExpressionAttributeNames: input.status ? { '#status': 'status' } : undefined,
    }),
    ScanIndexForward: false, // Sort by resultId descending (newest first)
    Limit: limit,
    ExclusiveStartKey: input.lastEvaluatedKey,
  });

  try {
    const response = await getDocClient().send(command);

    return {
      results: (response.Items || []) as TestResult[],
      lastEvaluatedKey: response.LastEvaluatedKey,
    };
  } catch (error) {
    throw new Error(`Failed to query test results: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
