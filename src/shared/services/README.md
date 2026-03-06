# Services

This directory contains high-level service layer implementations that orchestrate business logic and integrate multiple utilities.

## Test Generation Service

**File:** `testGenerationService.ts`

The Test Generation Service provides AI-powered test script generation using Amazon Bedrock with Claude 3.5 Sonnet. It handles the complete workflow of generating executable Playwright test scripts from natural language descriptions.

### Features

- **AI-Powered Generation**: Uses Claude 3.5 Sonnet via Amazon Bedrock to generate structured test scripts
- **Automatic Retries**: Implements exponential backoff retry logic for transient failures
- **Error Handling**: Comprehensive error handling with specific error codes for different failure scenarios
- **Response Parsing**: Automatically parses and validates JSON responses from the AI model
- **Configurable**: Supports custom retry configurations and Bedrock client instances

### Usage

```typescript
import { getTestGenerationService } from './services/testGenerationService';

const service = getTestGenerationService();

const result = await service.generateTest({
  testPrompt: 'Test login functionality with valid credentials',
  environment: 'DEV',
  environmentConfig: {
    baseUrl: 'https://dev.example.com',
    // ... other config
  },
});

console.log('Generated test script:', result.testScript);
console.log('Tokens used:', result.tokensUsed);
console.log('Attempts:', result.attempts);
```

### Retry Behavior

The service automatically retries failed requests with exponential backoff:

- **Default max attempts**: 3
- **Initial delay**: 1000ms
- **Max delay**: 10000ms
- **Backoff multiplier**: 2x

Retries are triggered for:
- Bedrock API errors (throttling, service unavailable)
- Network errors (timeouts, connection resets)
- Temporary failures

Retries are NOT triggered for:
- Invalid input (empty prompts)
- JSON parsing errors (invalid response format)
- Validation errors (invalid test script structure)

### Error Codes

The service throws `TestGenerationError` with specific error codes:

- `INVALID_INPUT`: Empty or invalid test prompt
- `BEDROCK_API_ERROR`: Bedrock API failure
- `TIMEOUT`: Request timeout after retries
- `INVALID_RESPONSE`: Unable to parse AI response
- `NETWORK_ERROR`: Network connectivity issues
- `GENERATION_FAILED`: Generic failure (fallback)

### Custom Configuration

You can customize retry behavior:

```typescript
import { TestGenerationService } from './services/testGenerationService';

const service = new TestGenerationService(undefined, {
  maxAttempts: 5,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 3,
});
```

### Testing

Comprehensive unit tests are available in `tests/unit/testGenerationService.test.ts`:

- Test script generation
- Retry logic and exponential backoff
- Error handling for various failure scenarios
- Configuration management
- Edge cases

Run tests:
```bash
npm test -- testGenerationService.test.ts
```

### Dependencies

- **BedrockClient**: AWS Bedrock client wrapper (`src/shared/utils/bedrock.ts`)
- **promptBuilder**: Prompt construction utilities (`src/shared/utils/promptBuilder.ts`)
- **Types**: Shared type definitions (`src/shared/types/index.ts`)

### Integration

This service is designed to be used by the Test Generation Lambda function to handle the AI-powered test generation workflow. It abstracts away the complexity of Bedrock API calls, retry logic, and response parsing.
