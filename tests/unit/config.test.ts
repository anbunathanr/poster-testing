/**
 * Unit tests for configuration loader
 */

import { loadConfig, getJwtSecret } from '../../src/shared/config';

describe('Configuration Loader', () => {
  describe('loadConfig', () => {
    it('should load dev configuration by default', () => {
      const config = loadConfig('dev');
      
      expect(config.environment).toBe('dev');
      expect(config.region).toBe('us-east-1');
      expect(config.dynamodb.usersTable).toBe('ai-testing-users-dev');
      expect(config.s3.evidenceBucket).toBe('ai-testing-evidence-dev');
    });

    it('should load staging configuration', () => {
      const config = loadConfig('staging');
      
      expect(config.environment).toBe('staging');
      expect(config.dynamodb.usersTable).toBe('ai-testing-users-staging');
      expect(config.s3.evidenceBucket).toBe('ai-testing-evidence-staging');
    });

    it('should load prod configuration', () => {
      const config = loadConfig('prod');
      
      expect(config.environment).toBe('prod');
      expect(config.dynamodb.usersTable).toBe('ai-testing-users-prod');
      expect(config.s3.evidenceBucket).toBe('ai-testing-evidence-prod');
    });

    it('should include all required configuration sections', () => {
      const config = loadConfig('dev');
      
      expect(config.dynamodb).toBeDefined();
      expect(config.s3).toBeDefined();
      expect(config.bedrock).toBeDefined();
      expect(config.jwt).toBeDefined();
      expect(config.lambda).toBeDefined();
      expect(config.apiGateway).toBeDefined();
      expect(config.sns).toBeDefined();
      expect(config.cloudwatch).toBeDefined();
    });

    it('should include Lambda configuration for all functions', () => {
      const config = loadConfig('dev');
      
      expect(config.lambda.auth).toBeDefined();
      expect(config.lambda.testGeneration).toBeDefined();
      expect(config.lambda.testExecution).toBeDefined();
      expect(config.lambda.storage).toBeDefined();
      expect(config.lambda.report).toBeDefined();
    });

    it('should have correct Lambda resource limits', () => {
      const config = loadConfig('dev');
      
      expect(config.lambda.auth.memorySize).toBe(256);
      expect(config.lambda.auth.timeout).toBe(10);
      expect(config.lambda.testExecution.memorySize).toBe(2048);
      expect(config.lambda.testExecution.timeout).toBe(300);
    });

    it('should throw error for invalid environment', () => {
      expect(() => loadConfig('invalid')).toThrow();
    });
  });

  describe('getJwtSecret', () => {
    const originalEnv = process.env.JWT_SECRET;

    afterEach(() => {
      process.env.JWT_SECRET = originalEnv;
    });

    it('should return JWT secret from environment', () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      const secret = getJwtSecret();
      expect(secret).toBe('a'.repeat(32));
    });

    it('should throw error if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('JWT_SECRET environment variable is not set');
    });

    it('should throw error if JWT_SECRET is too short', () => {
      process.env.JWT_SECRET = 'short';
      expect(() => getJwtSecret()).toThrow('JWT_SECRET must be at least 32 characters long');
    });
  });
});
