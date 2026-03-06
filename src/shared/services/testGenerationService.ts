/**
 * Test Generation Service
 * Orchestrates AI-powered test script generation using Amazon Bedrock
 * Handles API invocation, retries, error handling, and response parsing
 */

import { BedrockClient, BedrockError, getBedrockClient } from '../utils/bedrock';
import { buildTestGenerationPrompt, parseTestScriptResponse } from '../utils/promptBuilder';
import { TestScript, Environment, EnvironmentConfig } from '../types';

/**
 * Input parameters for test generation
 */
export interface GenerateTestInput {
  testPrompt: string;
  environment: Environment;
  environmentConfig?: EnvironmentConfig;
  additionalContext?: string;
}

/**
 * Result of test generation
 */
export interface GenerateTestResult {
  testScript: TestScript;
  tokensUsed?: {
    input: number;
    output: number;
  };
  attempts: number;
}

/**
 * Error thrown when test generation fails
 */
export class TestGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly attempts: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'TestGenerationError';
    Object.setPrototypeOf(this, TestGenerationError.prototype);
  }
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Test Generation Service
 * Provides high-level API for generating test scripts using Bedrock
 */
export class TestGenerationService {
  private bedrockClient: BedrockClient;
  private retryConfig: RetryConfig;

  /**
   * Initialize the test generation service
   * @param bedrockClient - Optional Bedrock client instance (creates default if not provided)
   * @param retryConfig - Optional retry configuration
   */
  constructor(
    bedrockClient?: BedrockClient,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.bedrockClient = bedrockClient || getBedrockClient();
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Generate a test script from a natural language prompt
   * @param input - Test generation input parameters
   * @returns Generated test script with metadata
   * @throws TestGenerationError if generation fails after all retries
   */
  async generateTest(input: GenerateTestInput): Promise<GenerateTestResult> {
    const { testPrompt, environment, environmentConfig, additionalContext } = input;

    // Validate input
    if (!testPrompt || testPrompt.trim().length === 0) {
      throw new TestGenerationError(
        'Test prompt cannot be empty',
        'INVALID_INPUT',
        0
      );
    }

    // Build the prompt for Bedrock
    const prompt = buildTestGenerationPrompt({
      testPrompt,
      environment,
      baseUrl: environmentConfig?.baseUrl,
      additionalContext,
    });

    // Invoke Bedrock with retry logic
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await this.bedrockClient.invoke({
          prompt,
          maxTokens: 4096,
          temperature: 0.7,
        });

        // Parse and validate the response
        const testScript = parseTestScriptResponse(response.completion);

        return {
          testScript,
          tokensUsed: response.usage
            ? {
                input: response.usage.inputTokens,
                output: response.usage.outputTokens,
              }
            : undefined,
          attempts: attempt,
        };
      } catch (error) {
        lastError = error as Error;

        // Determine if we should retry
        const shouldRetry = this.shouldRetry(error, attempt);

        if (!shouldRetry) {
          // Don't retry for certain error types
          throw this.createTestGenerationError(error, attempt);
        }

        // Calculate delay with exponential backoff
        if (attempt < this.retryConfig.maxAttempts) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw this.createTestGenerationError(
      lastError || new Error('Unknown error'),
      this.retryConfig.maxAttempts
    );
  }

  /**
   * Determine if an error should trigger a retry
   * @param error - The error that occurred
   * @param attempt - Current attempt number
   * @returns True if should retry, false otherwise
   */
  private shouldRetry(error: unknown, attempt: number): boolean {
    // Don't retry if we've exhausted attempts
    if (attempt >= this.retryConfig.maxAttempts) {
      return false;
    }

    // Don't retry for validation errors (invalid input)
    if (error instanceof TestGenerationError) {
      return false;
    }

    // Don't retry for JSON parsing errors (invalid response format)
    if (error instanceof Error && error.message.includes('Failed to parse')) {
      return false;
    }

    // Retry for Bedrock errors (timeouts, throttling, temporary failures)
    if (error instanceof BedrockError) {
      return true;
    }

    // Retry for network errors and timeouts
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('econnreset') ||
        message.includes('enotfound') ||
        message.includes('econnrefused')
      ) {
        return true;
      }
    }

    // Default: retry for unknown errors
    return true;
  }

  /**
   * Calculate exponential backoff delay
   * @param attempt - Current attempt number (1-indexed)
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay =
      this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleep for a specified duration
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a TestGenerationError from a caught error
   * @param error - The original error
   * @param attempts - Number of attempts made
   * @returns TestGenerationError instance
   */
  private createTestGenerationError(
    error: unknown,
    attempts: number
  ): TestGenerationError {
    const err = error as Error;

    // Determine error code based on error type
    let code = 'GENERATION_FAILED';
    let message = err.message;

    if (error instanceof BedrockError) {
      code = 'BEDROCK_API_ERROR';
      message = `Bedrock API error: ${err.message}`;
    } else if (err.message.toLowerCase().includes('timeout')) {
      code = 'TIMEOUT';
      message = `Test generation timed out after ${attempts} attempts`;
    } else if (err.message.includes('Failed to parse')) {
      code = 'INVALID_RESPONSE';
      message = `Invalid response from AI model: ${err.message}`;
    } else if (err.message.toLowerCase().includes('network')) {
      code = 'NETWORK_ERROR';
      message = `Network error during test generation: ${err.message}`;
    }

    return new TestGenerationError(message, code, attempts, err);
  }

  /**
   * Get the configured retry settings
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}

/**
 * Create a singleton test generation service instance
 */
let serviceInstance: TestGenerationService | null = null;

/**
 * Get or create the test generation service instance
 * @param bedrockClient - Optional Bedrock client override
 * @param retryConfig - Optional retry configuration
 * @returns Test generation service instance
 */
export function getTestGenerationService(
  bedrockClient?: BedrockClient,
  retryConfig?: Partial<RetryConfig>
): TestGenerationService {
  if (!serviceInstance || bedrockClient || retryConfig) {
    serviceInstance = new TestGenerationService(bedrockClient, retryConfig);
  }
  return serviceInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetTestGenerationService(): void {
  serviceInstance = null;
}
