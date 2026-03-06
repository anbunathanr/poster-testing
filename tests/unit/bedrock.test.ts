/**
 * Unit tests for Bedrock client utility
 */

import { mockClient } from 'aws-sdk-client-mock';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  BedrockClient,
  BedrockError,
  getBedrockClient,
  resetBedrockClient,
} from '../../src/shared/utils/bedrock';

// Mock the config module
jest.mock('../../src/shared/config', () => ({
  getConfig: jest.fn(() => ({
    bedrock: {
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v2:0',
      region: 'us-east-1',
      maxTokens: 4096,
      temperature: 0.7,
    },
  })),
}));

const bedrockMock = mockClient(BedrockRuntimeClient);

// Helper function to create mock response body
const createMockBody = (response: any) => {
  return new TextEncoder().encode(JSON.stringify(response)) as any;
};

describe('BedrockClient', () => {
  beforeEach(() => {
    bedrockMock.reset();
    resetBedrockClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default region from config', () => {
      const client = new BedrockClient();
      expect(client.getRegion()).toBe('us-east-1');
      expect(client.getModelId()).toBe('anthropic.claude-3-5-sonnet-20240620-v2:0');
    });

    it('should initialize with custom region', () => {
      const client = new BedrockClient('us-west-2');
      expect(client.getRegion()).toBe('us-west-2');
    });
  });

  describe('invoke', () => {
    it('should successfully invoke Bedrock with a prompt', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'This is a test response',
          },
        ],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();
      const response = await client.invoke({
        prompt: 'Test prompt',
      });

      expect(response.completion).toBe('This is a test response');
      expect(response.stopReason).toBe('end_turn');
      expect(response.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
      });
    });

    it('should use custom maxTokens and temperature', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();
      const response = await client.invoke({
        prompt: 'Test',
        maxTokens: 2000,
        temperature: 0.5,
      });

      expect(response.completion).toBe('Response');
      expect(bedrockMock.commandCalls(InvokeModelCommand).length).toBe(1);
    });

    it('should include optional parameters when provided', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();
      const response = await client.invoke({
        prompt: 'Test',
        topP: 0.9,
        stopSequences: ['STOP', 'END'],
      });

      expect(response.completion).toBe('Response');
      expect(bedrockMock.commandCalls(InvokeModelCommand).length).toBe(1);
    });

    it('should handle multiple text blocks in response', async () => {
      const mockResponse = {
        content: [
          { type: 'text', text: 'First part ' },
          { type: 'text', text: 'Second part' },
        ],
        stop_reason: 'end_turn',
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();
      const response = await client.invoke({ prompt: 'Test' });

      expect(response.completion).toBe('First part Second part');
    });

    it('should handle legacy completion format', async () => {
      const mockResponse = {
        completion: 'Legacy response format',
        stop_reason: 'end_turn',
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();
      const response = await client.invoke({ prompt: 'Test' });

      expect(response.completion).toBe('Legacy response format');
    });

    it('should throw BedrockError when response body is empty', async () => {
      bedrockMock.on(InvokeModelCommand).resolves({
        body: undefined,
      });

      const client = new BedrockClient();

      await expect(client.invoke({ prompt: 'Test' })).rejects.toThrow(
        BedrockError
      );
      await expect(client.invoke({ prompt: 'Test' })).rejects.toThrow(
        'Empty response body from Bedrock API'
      );
    });

    it('should throw BedrockError when completion cannot be extracted', async () => {
      const mockResponse = {
        // Missing both content and completion fields
        stop_reason: 'end_turn',
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();

      await expect(client.invoke({ prompt: 'Test' })).rejects.toThrow(
        BedrockError
      );
      await expect(client.invoke({ prompt: 'Test' })).rejects.toThrow(
        'Unable to extract completion from response'
      );
    });

    it('should throw BedrockError when API call fails', async () => {
      bedrockMock.on(InvokeModelCommand).rejects(new Error('API Error'));

      const client = new BedrockClient();

      await expect(client.invoke({ prompt: 'Test' })).rejects.toThrow(
        BedrockError
      );
      await expect(client.invoke({ prompt: 'Test' })).rejects.toThrow(
        'Failed to invoke Bedrock model'
      );
    });

    it('should include usage information when available', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 50,
          output_tokens: 100,
        },
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();
      const response = await client.invoke({ prompt: 'Test' });

      expect(response.usage).toEqual({
        inputTokens: 50,
        outputTokens: 100,
      });
    });

    it('should handle response without usage information', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();
      const response = await client.invoke({ prompt: 'Test' });

      expect(response.usage).toBeUndefined();
    });

    it('should invoke Bedrock with proper model configuration', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: createMockBody(mockResponse),
      });

      const client = new BedrockClient();
      const response = await client.invoke({ prompt: 'Test prompt' });

      expect(response.completion).toBe('Response');
      expect(bedrockMock.commandCalls(InvokeModelCommand).length).toBe(1);
      expect(client.getModelId()).toBe('anthropic.claude-3-5-sonnet-20240620-v2:0');
    });
  });

  describe('getBedrockClient', () => {
    it('should return singleton instance', () => {
      const client1 = getBedrockClient();
      const client2 = getBedrockClient();

      expect(client1).toBe(client2);
    });

    it('should create new instance when region is provided', () => {
      const client1 = getBedrockClient();
      const client2 = getBedrockClient('us-west-2');

      expect(client1).not.toBe(client2);
      expect(client2.getRegion()).toBe('us-west-2');
    });

    it('should reset singleton with resetBedrockClient', () => {
      const client1 = getBedrockClient();
      resetBedrockClient();
      const client2 = getBedrockClient();

      expect(client1).not.toBe(client2);
    });
  });

  describe('BedrockError', () => {
    it('should create error with message', () => {
      const error = new BedrockError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('BedrockError');
      expect(error.statusCode).toBeUndefined();
      expect(error.originalError).toBeUndefined();
    });

    it('should create error with status code', () => {
      const error = new BedrockError('Test error', 500);

      expect(error.statusCode).toBe(500);
    });

    it('should create error with original error', () => {
      const originalError = new Error('Original');
      const error = new BedrockError('Test error', 500, originalError);

      expect(error.originalError).toBe(originalError);
    });

    it('should be instanceof Error', () => {
      const error = new BedrockError('Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof BedrockError).toBe(true);
    });
  });
});
