/**
 * Unit tests for testOperations module
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Create mock DynamoDB client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock the DynamoDBClient
jest.mock('@aws-sdk/client-dynamodb');

// Mock DynamoDBDocumentClient.from to return the mocked client
DynamoDBDocumentClient.from = jest.fn().mockReturnValue(ddbMock as any);

// Now import the functions to test
import {
  createTest,
  getTest,
  listTestsByUser,
  updateTestStatus,
  CreateTestInput,
} from '../../src/shared/database/testOperations';
import { Test, TestScript, Environment } from '../../src/shared/types';

describe('testOperations', () => {
  beforeEach(() => {
    // Reset mock before each test
    ddbMock.reset();
    // Set default table name
    process.env.TESTS_TABLE = 'Tests';
  });

  afterEach(() => {
    delete process.env.TESTS_TABLE;
    jest.clearAllMocks();
  });

  describe('createTest', () => {
    const validTestScript: TestScript = {
      steps: [
        { action: 'navigate', url: 'https://example.com' },
        { action: 'click', selector: '#button' },
      ],
    };

    const validInput: CreateTestInput = {
      tenantId: 'tenant-123',
      userId: 'user-456',
      testPrompt: 'Test login functionality',
      testScript: validTestScript,
      environment: 'DEV' as Environment,
    };

    it('should create a test successfully', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await createTest(validInput);

      expect(result).toBeDefined();
      expect(result.testId).toBeDefined();
      expect(result.tenantId).toBe(validInput.tenantId);
      expect(result.userId).toBe(validInput.userId);
      expect(result.testPrompt).toBe(validInput.testPrompt);
      expect(result.testScript).toEqual(validInput.testScript);
      expect(result.environment).toBe(validInput.environment);
      expect(result.status).toBe('READY');
      expect(result.createdAt).toBeDefined();
      expect(typeof result.createdAt).toBe('number');

      // Verify DynamoDB was called correctly
      const calls = ddbMock.commandCalls(PutCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.TableName).toBe('Tests');
      expect(calls[0].args[0].input.Item).toMatchObject({
        tenantId: validInput.tenantId,
        userId: validInput.userId,
        testPrompt: validInput.testPrompt,
        testScript: validInput.testScript,
        environment: validInput.environment,
        status: 'READY',
      });
    });

    it('should create a test with optional testName', async () => {
      ddbMock.on(PutCommand).resolves({});

      const inputWithName = { ...validInput, testName: 'My Test' };
      const result = await createTest(inputWithName);

      expect(result).toBeDefined();
      expect((result as any).testName).toBe('My Test');
    });

    it('should throw error if tenantId is missing', async () => {
      const invalidInput = { ...validInput, tenantId: '' };

      await expect(createTest(invalidInput)).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if userId is missing', async () => {
      const invalidInput = { ...validInput, userId: '' };

      await expect(createTest(invalidInput)).rejects.toThrow('User ID is required');
    });

    it('should throw error if testPrompt is missing', async () => {
      const invalidInput = { ...validInput, testPrompt: '' };

      await expect(createTest(invalidInput)).rejects.toThrow('Test prompt is required');
    });

    it('should throw error if testScript is missing', async () => {
      const invalidInput = { ...validInput, testScript: null as any };

      await expect(createTest(invalidInput)).rejects.toThrow('Test script with steps is required');
    });

    it('should throw error if testScript has no steps', async () => {
      const invalidInput = { ...validInput, testScript: { steps: [] } };

      await expect(createTest(invalidInput)).rejects.toThrow('Test script with steps is required');
    });

    it('should throw error if environment is missing', async () => {
      const invalidInput = { ...validInput, environment: null as any };

      await expect(createTest(invalidInput)).rejects.toThrow('Environment is required');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      await expect(createTest(validInput)).rejects.toThrow('Failed to create test');
    });
  });

  describe('getTest', () => {
    const mockTest: Test = {
      testId: 'test-123',
      tenantId: 'tenant-123',
      userId: 'user-456',
      testPrompt: 'Test login',
      testScript: { steps: [] },
      environment: 'DEV',
      createdAt: Date.now(),
      status: 'READY',
    };

    it('should retrieve a test successfully', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockTest });

      const result = await getTest('tenant-123', 'test-123');

      expect(result).toEqual(mockTest);

      // Verify DynamoDB was called correctly
      const calls = ddbMock.commandCalls(GetCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.TableName).toBe('Tests');
      expect(calls[0].args[0].input.Key).toEqual({
        tenantId: 'tenant-123',
        testId: 'test-123',
      });
    });

    it('should return null if test not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      const result = await getTest('tenant-123', 'test-123');

      expect(result).toBeNull();
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(getTest('', 'test-123')).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if testId is missing', async () => {
      await expect(getTest('tenant-123', '')).rejects.toThrow('Test ID is required');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      await expect(getTest('tenant-123', 'test-123')).rejects.toThrow('Failed to get test');
    });
  });

  describe('listTestsByUser', () => {
    const mockTests: Test[] = [
      {
        testId: 'test-1',
        tenantId: 'tenant-123',
        userId: 'user-456',
        testPrompt: 'Test 1',
        testScript: { steps: [] },
        environment: 'DEV',
        createdAt: Date.now(),
        status: 'READY',
      },
      {
        testId: 'test-2',
        tenantId: 'tenant-123',
        userId: 'user-456',
        testPrompt: 'Test 2',
        testScript: { steps: [] },
        environment: 'STAGING',
        createdAt: Date.now() - 1000,
        status: 'COMPLETED',
      },
    ];

    it('should list tests for a user successfully', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: mockTests });

      const result = await listTestsByUser('user-456');

      expect(result.tests).toEqual(mockTests);
      expect(result.lastEvaluatedKey).toBeUndefined();

      // Verify DynamoDB was called correctly
      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.TableName).toBe('Tests');
      expect(calls[0].args[0].input.IndexName).toBe('userId-createdAt-index');
      expect(calls[0].args[0].input.KeyConditionExpression).toBe('userId = :userId');
      expect(calls[0].args[0].input.ExpressionAttributeValues).toEqual({
        ':userId': 'user-456',
      });
      expect(calls[0].args[0].input.ScanIndexForward).toBe(false);
      expect(calls[0].args[0].input.Limit).toBe(20);
    });

    it('should support custom limit', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: mockTests });

      await listTestsByUser('user-456', 10);

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input.Limit).toBe(10);
    });

    it('should support pagination', async () => {
      const lastKey = { userId: 'user-456', createdAt: 123456 };
      ddbMock.on(QueryCommand).resolves({ 
        Items: mockTests,
        LastEvaluatedKey: lastKey,
      });

      const result = await listTestsByUser('user-456', 20, lastKey);

      expect(result.lastEvaluatedKey).toEqual(lastKey);

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input.ExclusiveStartKey).toEqual(lastKey);
    });

    it('should return empty array if no tests found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await listTestsByUser('user-456');

      expect(result.tests).toEqual([]);
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it('should throw error if userId is missing', async () => {
      await expect(listTestsByUser('')).rejects.toThrow('User ID is required');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      await expect(listTestsByUser('user-456')).rejects.toThrow('Failed to list tests by user');
    });
  });

  describe('updateTestStatus', () => {
    const mockTest: Test = {
      testId: 'test-123',
      tenantId: 'tenant-123',
      userId: 'user-456',
      testPrompt: 'Test login',
      testScript: { steps: [] },
      environment: 'DEV',
      createdAt: Date.now(),
      status: 'READY',
    };

    beforeEach(() => {
      // Mock getTest to return existing test
      ddbMock.on(GetCommand).resolves({ Item: mockTest });
    });

    it('should update test status successfully', async () => {
      const updatedTest = { ...mockTest, status: 'EXECUTING' as const };
      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedTest });

      const result = await updateTestStatus('tenant-123', 'test-123', 'EXECUTING');

      expect(result.status).toBe('EXECUTING');

      // Verify DynamoDB was called correctly
      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.TableName).toBe('Tests');
      expect(calls[0].args[0].input.Key).toEqual({
        tenantId: 'tenant-123',
        testId: 'test-123',
      });
      expect(calls[0].args[0].input.UpdateExpression).toBe('SET #status = :status');
      expect(calls[0].args[0].input.ExpressionAttributeValues).toEqual({
        ':status': 'EXECUTING',
      });
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(updateTestStatus('', 'test-123', 'EXECUTING')).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if testId is missing', async () => {
      await expect(updateTestStatus('tenant-123', '', 'EXECUTING')).rejects.toThrow('Test ID is required');
    });

    it('should throw error if status is invalid', async () => {
      await expect(updateTestStatus('tenant-123', 'test-123', 'INVALID' as any)).rejects.toThrow('Invalid status');
    });

    it('should throw error if test not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      await expect(updateTestStatus('tenant-123', 'test-123', 'EXECUTING')).rejects.toThrow('Test not found');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));

      await expect(updateTestStatus('tenant-123', 'test-123', 'EXECUTING')).rejects.toThrow('Failed to update test status');
    });
  });
});
