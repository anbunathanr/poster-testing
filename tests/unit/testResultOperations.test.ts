/**
 * Unit tests for Test Result Operations
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
  createTestResult,
  getTestResult,
  listTestResultsByTest,
  updateTestResult,
  CreateTestResultInput,
  UpdateTestResultInput,
} from '../../src/shared/database/testResultOperations';

describe('Test Result Operations', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.TEST_RESULTS_TABLE = 'TestResults';
  });

  describe('createTestResult', () => {
    it('should create a test result successfully', async () => {
      ddbMock.on(PutCommand).resolves({});

      const input: CreateTestResultInput = {
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: ['screenshot1.png'],
        logsS3Key: 'log.json',
        executionLog: { steps: [] },
      };

      const result = await createTestResult(input);

      expect(result.testId).toBe('test-123');
      expect(result.tenantId).toBe('tenant-123');
      expect(result.status).toBe('PASS');
      expect(result.resultId).toBeDefined();
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should create a test result with FAIL status', async () => {
      ddbMock.on(PutCommand).resolves({});

      const input: CreateTestResultInput = {
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'FAIL',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: ['screenshot1.png', 'failure.png'],
        logsS3Key: 'log.json',
        errorMessage: 'Test failed: Element not found',
        executionLog: { steps: [], error: 'Element not found' },
      };

      const result = await createTestResult(input);

      expect(result.status).toBe('FAIL');
      expect(result.errorMessage).toBe('Test failed: Element not found');
      expect(result.screenshotsS3Keys).toHaveLength(2);
    });

    it('should generate unique resultId for each test result', async () => {
      ddbMock.on(PutCommand).resolves({});

      const input: CreateTestResultInput = {
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      };

      const result1 = await createTestResult(input);
      const result2 = await createTestResult(input);

      expect(result1.resultId).toBeDefined();
      expect(result2.resultId).toBeDefined();
      expect(result1.resultId).not.toBe(result2.resultId);
    });

    it('should throw error if tenantId is missing', async () => {
      const input: CreateTestResultInput = {
        testId: 'test-123',
        tenantId: '',
        userId: 'user-456',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      };

      await expect(createTestResult(input)).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if testId is missing', async () => {
      const input: CreateTestResultInput = {
        testId: '',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      };

      await expect(createTestResult(input)).rejects.toThrow('Test ID is required');
    });

    it('should throw error if userId is missing', async () => {
      const input: CreateTestResultInput = {
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: '',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      };

      await expect(createTestResult(input)).rejects.toThrow('User ID is required');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      const input: CreateTestResultInput = {
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      };

      await expect(createTestResult(input)).rejects.toThrow('Failed to create test result');
    });
  });

  describe('getTestResult', () => {
    it('should retrieve a test result successfully', async () => {
      const mockResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: ['screenshot1.png'],
        logsS3Key: 'log.json',
        executionLog: { steps: [] },
      };

      ddbMock.on(GetCommand).resolves({ Item: mockResult });

      const result = await getTestResult('tenant-123', 'result-123');

      expect(result).toEqual(mockResult);
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should return null if test result not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      const result = await getTestResult('tenant-123', 'result-123');

      expect(result).toBeNull();
    });

    it('should throw error if tenantId is missing', async () => {
      await expect(getTestResult('', 'result-123')).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if resultId is missing', async () => {
      await expect(getTestResult('tenant-123', '')).rejects.toThrow('Result ID is required');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      await expect(getTestResult('tenant-123', 'result-123')).rejects.toThrow('Failed to get test result');
    });
  });

  describe('listTestResultsByTest', () => {
    it('should list test results for a test', async () => {
      const mockResults = [
        {
          resultId: 'result-1',
          testId: 'test-123',
          tenantId: 'tenant-123',
          userId: 'user-456',
          status: 'PASS',
          startTime: 1707753600000,
          endTime: 1707753645000,
          duration: 45000,
          screenshotsS3Keys: [],
          logsS3Key: 'log.json',
          executionLog: {},
        },
        {
          resultId: 'result-2',
          testId: 'test-123',
          tenantId: 'tenant-123',
          userId: 'user-456',
          status: 'FAIL',
          startTime: 1707753500000,
          endTime: 1707753530000,
          duration: 30000,
          screenshotsS3Keys: [],
          logsS3Key: 'log.json',
          executionLog: {},
        },
      ];

      ddbMock.on(QueryCommand).resolves({
        Items: mockResults,
        LastEvaluatedKey: undefined,
      });

      const result = await listTestResultsByTest('test-123');

      expect(result.results).toEqual(mockResults);
      expect(result.lastEvaluatedKey).toBeUndefined();
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should support pagination with limit', async () => {
      const mockResults = [
        {
          resultId: 'result-1',
          testId: 'test-123',
          tenantId: 'tenant-123',
          userId: 'user-456',
          status: 'PASS',
          startTime: 1707753600000,
          endTime: 1707753645000,
          duration: 45000,
          screenshotsS3Keys: [],
          logsS3Key: 'log.json',
          executionLog: {},
        },
      ];

      const lastKey = { testId: 'test-123', startTime: 1707753600000 };

      ddbMock.on(QueryCommand).resolves({
        Items: mockResults,
        LastEvaluatedKey: lastKey,
      });

      const result = await listTestResultsByTest('test-123', 10);

      expect(result.results).toHaveLength(1);
      expect(result.lastEvaluatedKey).toEqual(lastKey);
    });

    it('should support pagination with lastEvaluatedKey', async () => {
      const mockResults = [
        {
          resultId: 'result-2',
          testId: 'test-123',
          tenantId: 'tenant-123',
          userId: 'user-456',
          status: 'PASS',
          startTime: 1707753500000,
          endTime: 1707753530000,
          duration: 30000,
          screenshotsS3Keys: [],
          logsS3Key: 'log.json',
          executionLog: {},
        },
      ];

      const lastKey = { testId: 'test-123', startTime: 1707753600000 };

      ddbMock.on(QueryCommand).resolves({
        Items: mockResults,
        LastEvaluatedKey: undefined,
      });

      const result = await listTestResultsByTest('test-123', 10, lastKey);

      expect(result.results).toHaveLength(1);
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it('should return empty array if no results found', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [],
        LastEvaluatedKey: undefined,
      });

      const result = await listTestResultsByTest('test-123');

      expect(result.results).toEqual([]);
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it('should throw error if testId is missing', async () => {
      await expect(listTestResultsByTest('')).rejects.toThrow('Test ID is required');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      await expect(listTestResultsByTest('test-123')).rejects.toThrow('Failed to list test results');
    });
  });

  describe('updateTestResult', () => {
    it('should update test result status successfully', async () => {
      const existingResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'EXECUTING',
        startTime: 1707753600000,
        endTime: 1707753600000,
        duration: 0,
        screenshotsS3Keys: [],
        logsS3Key: '',
        executionLog: {},
      };

      const updatedResult = {
        ...existingResult,
        status: 'PASS',
        endTime: 1707753645000,
        duration: 45000,
      };

      ddbMock.on(GetCommand).resolves({ Item: existingResult });
      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedResult });

      const input: UpdateTestResultInput = {
        tenantId: 'tenant-123',
        resultId: 'result-123',
        status: 'PASS',
        endTime: 1707753645000,
        duration: 45000,
      };

      const result = await updateTestResult(input);

      expect(result.status).toBe('PASS');
      expect(result.endTime).toBe(1707753645000);
      expect(result.duration).toBe(45000);
      expect(ddbMock.calls()).toHaveLength(2);
    });

    it('should update multiple fields at once', async () => {
      const existingResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'EXECUTING',
        startTime: 1707753600000,
        endTime: 1707753600000,
        duration: 0,
        screenshotsS3Keys: [],
        logsS3Key: '',
        executionLog: {},
      };

      const updatedResult = {
        ...existingResult,
        status: 'FAIL',
        endTime: 1707753645000,
        duration: 45000,
        errorMessage: 'Test failed',
        screenshotsS3Keys: ['screenshot1.png', 'failure.png'],
        logsS3Key: 'log.json',
      };

      ddbMock.on(GetCommand).resolves({ Item: existingResult });
      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedResult });

      const input: UpdateTestResultInput = {
        tenantId: 'tenant-123',
        resultId: 'result-123',
        status: 'FAIL',
        endTime: 1707753645000,
        duration: 45000,
        errorMessage: 'Test failed',
        screenshotsS3Keys: ['screenshot1.png', 'failure.png'],
        logsS3Key: 'log.json',
      };

      const result = await updateTestResult(input);

      expect(result.status).toBe('FAIL');
      expect(result.errorMessage).toBe('Test failed');
      expect(result.screenshotsS3Keys).toHaveLength(2);
    });

    it('should return existing result if no fields to update', async () => {
      const existingResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'PASS',
        startTime: 1707753600000,
        endTime: 1707753645000,
        duration: 45000,
        screenshotsS3Keys: [],
        logsS3Key: 'log.json',
        executionLog: {},
      };

      ddbMock.on(GetCommand).resolves({ Item: existingResult });

      const input: UpdateTestResultInput = {
        tenantId: 'tenant-123',
        resultId: 'result-123',
      };

      const result = await updateTestResult(input);

      expect(result).toEqual(existingResult);
      expect(ddbMock.calls()).toHaveLength(1); // Only GetCommand, no UpdateCommand
    });

    it('should throw error if test result not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      const input: UpdateTestResultInput = {
        tenantId: 'tenant-123',
        resultId: 'result-123',
        status: 'PASS',
      };

      await expect(updateTestResult(input)).rejects.toThrow('Test result not found');
    });

    it('should throw error if tenantId is missing', async () => {
      const input: UpdateTestResultInput = {
        tenantId: '',
        resultId: 'result-123',
        status: 'PASS',
      };

      await expect(updateTestResult(input)).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if resultId is missing', async () => {
      const input: UpdateTestResultInput = {
        tenantId: 'tenant-123',
        resultId: '',
        status: 'PASS',
      };

      await expect(updateTestResult(input)).rejects.toThrow('Result ID is required');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      const existingResult = {
        resultId: 'result-123',
        testId: 'test-123',
        tenantId: 'tenant-123',
        userId: 'user-456',
        status: 'EXECUTING',
        startTime: 1707753600000,
        endTime: 1707753600000,
        duration: 0,
        screenshotsS3Keys: [],
        logsS3Key: '',
        executionLog: {},
      };

      ddbMock.on(GetCommand).resolves({ Item: existingResult });
      ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));

      const input: UpdateTestResultInput = {
        tenantId: 'tenant-123',
        resultId: 'result-123',
        status: 'PASS',
      };

      await expect(updateTestResult(input)).rejects.toThrow('Failed to update test result');
    });
  });
});
