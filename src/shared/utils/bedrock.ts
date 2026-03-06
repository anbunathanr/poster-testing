/**
 * Amazon Bedrock client utility for AI-powered test generation
 * Uses Claude 3.5 Sonnet model for intelligent test case generation
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { getConfig } from '../config';

/**
 * Bedrock request parameters for Claude models
 */
export interface BedrockRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Bedrock response from Claude models
 */
export interface BedrockResponse {
  completion: string;
  stopReason: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Error thrown when Bedrock API calls fail
 */
export class BedrockError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'BedrockError';
    Object.setPrototypeOf(this, BedrockError.prototype);
  }
}

/**
 * Bedrock client wrapper for Claude 3.5 Sonnet
 */
export class BedrockClient {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private maxTokens: number;
  private temperature: number;
  private region: string;

  /**
   * Initialize Bedrock client with configuration
   * @param region - AWS region for Bedrock (optional, uses config if not provided)
   */
  constructor(region?: string) {
    const config = getConfig();
    this.region = region || config.bedrock.region;

    this.client = new BedrockRuntimeClient({
      region: this.region,
      // Credentials are automatically loaded from environment or IAM role
    });

    this.modelId = config.bedrock.modelId;
    this.maxTokens = config.bedrock.maxTokens;
    this.temperature = config.bedrock.temperature;
  }

  /**
   * Invoke Claude model with a prompt
   * @param request - Bedrock request parameters
   * @returns Bedrock response with completion text
   * @throws BedrockError if the API call fails
   */
  async invoke(request: BedrockRequest): Promise<BedrockResponse> {
    try {
      // Construct the request body for Claude models
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: request.maxTokens || this.maxTokens,
        temperature: request.temperature ?? this.temperature,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        ...(request.topP !== undefined && { top_p: request.topP }),
        ...(request.stopSequences && { stop_sequences: request.stopSequences }),
      };

      const input: InvokeModelCommandInput = {
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      };

      const command = new InvokeModelCommand(input);
      const response: InvokeModelCommandOutput = await this.client.send(command);

      if (!response.body) {
        throw new BedrockError('Empty response body from Bedrock API');
      }

      // Parse the response body
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Extract completion text from Claude response format
      const completion = this.extractCompletion(responseBody);

      return {
        completion,
        stopReason: responseBody.stop_reason || 'unknown',
        usage: responseBody.usage
          ? {
              inputTokens: responseBody.usage.input_tokens,
              outputTokens: responseBody.usage.output_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof BedrockError) {
        throw error;
      }

      const err = error as Error;
      throw new BedrockError(`Failed to invoke Bedrock model: ${err.message}`, undefined, err);
    }
  }

  /**
   * Extract completion text from Claude response
   * @param responseBody - Parsed response body from Bedrock
   * @returns Completion text
   */
  private extractCompletion(responseBody: any): string {
    // Claude 3 models return content as an array of content blocks
    if (responseBody.content && Array.isArray(responseBody.content)) {
      const textBlocks = responseBody.content.filter((block: any) => block.type === 'text');
      if (textBlocks.length > 0) {
        return textBlocks.map((block: any) => block.text).join('');
      }
    }

    // Fallback for older response formats
    if (responseBody.completion) {
      return responseBody.completion;
    }

    throw new BedrockError('Unable to extract completion from response');
  }

  /**
   * Get the configured model ID
   */
  getModelId(): string {
    return this.modelId;
  }

  /**
   * Get the configured region
   */
  getRegion(): string {
    return this.region;
  }
}

/**
 * Create a singleton Bedrock client instance
 */
let bedrockClientInstance: BedrockClient | null = null;

/**
 * Get or create the Bedrock client instance
 * @param region - Optional AWS region override
 * @returns Bedrock client instance
 */
export function getBedrockClient(region?: string): BedrockClient {
  if (!bedrockClientInstance || region) {
    bedrockClientInstance = new BedrockClient(region);
  }
  return bedrockClientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetBedrockClient(): void {
  bedrockClientInstance = null;
}
