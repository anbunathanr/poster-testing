/**
 * Jest Setup File
 * Runs before each test file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock AWS SDK clients by default
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-sns');
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-secrets-manager');

// Increase timeout for async operations
jest.setTimeout(30000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
};
