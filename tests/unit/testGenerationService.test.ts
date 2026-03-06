/**
 * Unit tests for Test Generation Service
 */

import {
  TestGenerationService,
  TestGenerationError,
  GenerateTestInput,
  getTestGenerationService,
  resetTestGenerationService,
} from '../../src/shared/services/testGenerationService';
import { BedrockClient, BedrockError, BedrockResponse } from '../../src/shared/utils/bedrock';
import { TestScript } from '../../src/shared/types';

// Mock the bedrock client
jest.mock('../../src/shared/utils/bedrock');

describe('TestGenerationService', () => {
  let mockBedrockClient: jest.Mocked<BedrockClient>;
  let service: TestGenerationService;

  beforeEach(() => {
    // Create mock Bedrock client
    mockBedrockClient = {
      invoke: jest.fn(),
      getModelId: jest.fn().mockReturnValue('anthropic.claude-3-5-sonnet-20240620-v1:0'),
      getRegion: jest.fn().mockReturnValue('us-east-1'),
    } as any;

    // Create service with mock client
    service = new TestGenerationService(mockBedrockClient, {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetTestGenerationService();
  });

  describe('generateTest', () => {
    const validInput: GenerateTestInput = {
      testPrompt: 'Test login functionality with valid credentials',
      environment: 'DEV',
    };

    const validTestScript: TestScript = {
      steps: [
        { action: 'navigate', url: 'https://example.com/login' },
        { action: 'fill', selector: '#email', value: 'test@example.com' },
        { action: 'fill', selector: '#password', value: 'password123' },
        { action: 'click', selector: 'button[type="submit"]' },
        { action: 'waitForNavigation' },
        { action: 'assert', selector: '.dashboard', condition: 'visible' },
      ],
    };

    it('should successfully generate a test script', async () => {
      const mockResponse: BedrockResponse = {
        completion: JSON.stringify(validTestScript),
        stopReason: 'end_turn',
        usage: {
          inputTokens: 500,
          outputTokens: 200,
        },
      };

      mockBedrockClient.invoke.mockResolvedValue(mockResponse);

      const result = await service.generateTest(validInput);

      expect(result.testScript).toEqual(validTestScript);
      expect(result.tokensUsed).toEqual({
        input: 500,
        output: 200,
      });
      expect(result.attempts).toBe(1);
      expect(mockBedrockClient.invoke).toHaveBeenCalledTimes(1);
    });

    it('should include environment config in prompt when provided', async () => {
      const inputWithConfig: GenerateTestInput = {
        ...validInput,
        environmentConfig: {
          tenantId: 'tenant-123',
          environment: 'DEV',
          baseUrl: 'https://dev.example.com',
          credentials: {},
          configuration: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const mockResponse: BedrockResponse = {
        completion: JSON.stringify(validTestScript),
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke.mockResolvedValue(mockResponse);

      await service.generateTest(inputWithConfig);

      const invokeCall = mockBedrockClient.invoke.mock.calls[0][0];
      expect(invokeCall.prompt).toContain('https://dev.example.com');
    });

    it('should throw error for empty test prompt', async () => {
      const invalidInput: GenerateTestInput = {
        testPrompt: '',
        environment: 'DEV',
      };

      await expect(service.generateTest(invalidInput)).rejects.toThrow(
        TestGenerationError
      );
      await expect(service.generateTest(invalidInput)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        attempts: 0,
      });
    });

    it('should handle JSON response with markdown code blocks', async () => {
      const responseWithMarkdown = `\`\`\`json
${JSON.stringify(validTestScript)}
\`\`\``;

      const mockResponse: BedrockResponse = {
        completion: responseWithMarkdown,
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke.mockResolvedValue(mockResponse);

      const result = await service.generateTest(validInput);

      expect(result.testScript).toEqual(validTestScript);
    });

    it('should throw error for invalid JSON response', async () => {
      const mockResponse: BedrockResponse = {
        completion: 'This is not valid JSON',
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke.mockResolvedValue(mockResponse);

      await expect(service.generateTest(validInput)).rejects.toThrow(
        TestGenerationError
      );
      await expect(service.generateTest(validInput)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('should throw error for invalid test script structure', async () => {
      const invalidScript = {
        steps: [
          { action: 'invalid_action', selector: '#test' },
        ],
      };

      const mockResponse: BedrockResponse = {
        completion: JSON.stringify(invalidScript),
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke.mockResolvedValue(mockResponse);

      await expect(service.generateTest(validInput)).rejects.toThrow(
        TestGenerationError
      );
    });
  });

  describe('retry logic', () => {
    const validInput: GenerateTestInput = {
      testPrompt: 'Test login functionality',
      environment: 'DEV',
    };

    const validTestScript: TestScript = {
      steps: [
        { action: 'navigate', url: 'https://example.com' },
      ],
    };

    it('should retry on Bedrock API errors', async () => {
      const bedrockError = new BedrockError('Throttling error', 429);
      const successResponse: BedrockResponse = {
        completion: JSON.stringify(validTestScript),
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke
        .mockRejectedValueOnce(bedrockError)
        .mockRejectedValueOnce(bedrockError)
        .mockResolvedValueOnce(successResponse);

      const result = await service.generateTest(validInput);

      expect(result.testScript).toEqual(validTestScript);
      expect(result.attempts).toBe(3);
      expect(mockBedrockClient.invoke).toHaveBeenCalledTimes(3);
    });

    it('should retry on timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      const successResponse: BedrockResponse = {
        completion: JSON.stringify(validTestScript),
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(successResponse);

      const result = await service.generateTest(validInput);

      expect(result.testScript).toEqual(validTestScript);
      expect(result.attempts).toBe(2);
      expect(mockBedrockClient.invoke).toHaveBeenCalledTimes(2);
    });

    it('should retry on network errors', async () => {
      const networkError = new Error('Network error: ECONNRESET');
      const successResponse: BedrockResponse = {
        completion: JSON.stringify(validTestScript),
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(successResponse);

      const result = await service.generateTest(validInput);

      expect(result.testScript).toEqual(validTestScript);
      expect(result.attempts).toBe(2);
    });

    it('should NOT retry on parsing errors', async () => {
      const mockResponse: BedrockResponse = {
        completion: 'Invalid JSON',
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke.mockResolvedValue(mockResponse);

      await expect(service.generateTest(validInput)).rejects.toThrow(
        TestGenerationError
      );

      // Should only try once, no retries
      expect(mockBedrockClient.invoke).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retry attempts', async () => {
      const bedrockError = new BedrockError('Service unavailable', 503);

      mockBedrockClient.invoke.mockRejectedValue(bedrockError);

      try {
        await service.generateTest(validInput);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TestGenerationError);
        const testGenError = error as TestGenerationError;
        expect(testGenError.code).toBe('BEDROCK_API_ERROR');
        expect(testGenError.attempts).toBe(3);
      }

      expect(mockBedrockClient.invoke).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff between retries', async () => {
      const bedrockError = new BedrockError('Throttling', 429);
      
      mockBedrockClient.invoke.mockRejectedValue(bedrockError);

      const startTime = Date.now();
      
      try {
        await service.generateTest(validInput);
      } catch (error) {
        // Expected to fail
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // With initial delay 100ms and multiplier 2:
      // Attempt 1: fail
      // Wait 100ms
      // Attempt 2: fail
      // Wait 200ms
      // Attempt 3: fail
      // Total wait time should be at least 300ms
      expect(totalTime).toBeGreaterThanOrEqual(300);
    });
  });

  describe('error handling', () => {
    const validInput: GenerateTestInput = {
      testPrompt: 'Test login',
      environment: 'DEV',
    };

    it('should create appropriate error for Bedrock API errors', async () => {
      const bedrockError = new BedrockError('API error', 500);
      mockBedrockClient.invoke.mockRejectedValue(bedrockError);

      await expect(service.generateTest(validInput)).rejects.toMatchObject({
        name: 'TestGenerationError',
        code: 'BEDROCK_API_ERROR',
        message: expect.stringContaining('Bedrock API error'),
      });
    });

    it('should create appropriate error for timeout', async () => {
      const timeoutError = new Error('Request timeout after 30s');
      mockBedrockClient.invoke.mockRejectedValue(timeoutError);

      await expect(service.generateTest(validInput)).rejects.toMatchObject({
        name: 'TestGenerationError',
        code: 'TIMEOUT',
        message: expect.stringContaining('timed out'),
      });
    });

    it('should create appropriate error for network errors', async () => {
      const networkError = new Error('Network failure: ENOTFOUND');
      mockBedrockClient.invoke.mockRejectedValue(networkError);

      await expect(service.generateTest(validInput)).rejects.toMatchObject({
        name: 'TestGenerationError',
        code: 'NETWORK_ERROR',
        message: expect.stringContaining('Network error'),
      });
    });

    it('should preserve original error in TestGenerationError', async () => {
      const originalError = new Error('Original error message');
      mockBedrockClient.invoke.mockRejectedValue(originalError);

      try {
        await service.generateTest(validInput);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(TestGenerationError);
        const testGenError = error as TestGenerationError;
        expect(testGenError.originalError).toBe(originalError);
      }
    });
  });

  describe('configuration', () => {
    it('should use custom retry configuration', () => {
      const customConfig = {
        maxAttempts: 5,
        initialDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 3,
      };

      const customService = new TestGenerationService(
        mockBedrockClient,
        customConfig
      );

      const config = customService.getRetryConfig();
      expect(config).toEqual(customConfig);
    });

    it('should merge partial retry configuration with defaults', () => {
      const partialConfig = {
        maxAttempts: 5,
      };

      const customService = new TestGenerationService(
        mockBedrockClient,
        partialConfig
      );

      const config = customService.getRetryConfig();
      expect(config.maxAttempts).toBe(5);
      expect(config.initialDelayMs).toBe(1000); // default
      expect(config.maxDelayMs).toBe(10000); // default
      expect(config.backoffMultiplier).toBe(2); // default
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance when called multiple times', () => {
      const instance1 = getTestGenerationService();
      const instance2 = getTestGenerationService();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance when client is provided', () => {
      const instance1 = getTestGenerationService();
      const instance2 = getTestGenerationService(mockBedrockClient);

      expect(instance1).not.toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = getTestGenerationService();
      resetTestGenerationService();
      const instance2 = getTestGenerationService();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace-only test prompt', async () => {
      const input: GenerateTestInput = {
        testPrompt: '   ',
        environment: 'DEV',
      };

      await expect(service.generateTest(input)).rejects.toThrow(
        TestGenerationError
      );
    });

    it('should handle very long test prompts', async () => {
      const longPrompt = 'Test '.repeat(1000);
      const input: GenerateTestInput = {
        testPrompt: longPrompt,
        environment: 'DEV',
      };

      const validTestScript: TestScript = {
        steps: [{ action: 'navigate', url: 'https://example.com' }],
      };

      const mockResponse: BedrockResponse = {
        completion: JSON.stringify(validTestScript),
        stopReason: 'end_turn',
      };

      mockBedrockClient.invoke.mockResolvedValue(mockResponse);

      const result = await service.generateTest(input);

      expect(result.testScript).toEqual(validTestScript);
    });

    it('should handle response without usage information', async () => {
      const validTestScript: TestScript = {
        steps: [{ action: 'navigate', url: 'https://example.com' }],
      };

      const mockResponse: BedrockResponse = {
        completion: JSON.stringify(validTestScript),
        stopReason: 'end_turn',
        // No usage field
      };

      mockBedrockClient.invoke.mockResolvedValue(mockResponse);

      const result = await service.generateTest({
        testPrompt: 'Test something',
        environment: 'DEV',
      });

      expect(result.testScript).toEqual(validTestScript);
      expect(result.tokensUsed).toBeUndefined();
    });
  });
});
