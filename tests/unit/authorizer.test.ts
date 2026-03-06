// Unit tests for API Gateway Lambda Authorizer
import { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { handler, extractAndValidateToken, generatePolicy } from '../../src/lambdas/authorizer';
import { generateToken } from '../../src/shared/utils/jwt';
import * as config from '../../src/shared/config';

// Mock the config module
jest.mock('../../src/shared/config');

const mockGetJwtSecret = config.getJwtSecret as jest.MockedFunction<typeof config.getJwtSecret>;

describe('Lambda Authorizer', () => {
  const TEST_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  const TEST_METHOD_ARN = 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/prod/GET/tests';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock JWT secret
    mockGetJwtSecret.mockReturnValue(TEST_JWT_SECRET);
  });

  describe('extractAndValidateToken', () => {
    it('should successfully extract and validate a valid Bearer token', () => {
      const token = generateToken(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        TEST_JWT_SECRET
      );

      const authHeader = `Bearer ${token}`;
      const decoded = extractAndValidateToken(authHeader);

      expect(decoded.userId).toBe('user-123');
      expect(decoded.tenantId).toBe('tenant-456');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw error when authorization token is missing', () => {
      expect(() => extractAndValidateToken('')).toThrow('Authorization token is missing');
    });

    it('should throw error when authorization token is whitespace only', () => {
      expect(() => extractAndValidateToken('   ')).toThrow('Authorization token is missing');
    });

    it('should throw error when authorization header format is invalid (no space)', () => {
      expect(() => extractAndValidateToken('BearerToken123')).toThrow(
        'Authorization header format must be: Bearer <token>'
      );
    });

    it('should throw error when authorization header has too many parts', () => {
      expect(() => extractAndValidateToken('Bearer token extra')).toThrow(
        'Authorization header format must be: Bearer <token>'
      );
    });

    it('should throw error when authorization scheme is not Bearer', () => {
      expect(() => extractAndValidateToken('Basic token123')).toThrow(
        'Authorization scheme must be Bearer'
      );
    });

    it('should accept Bearer scheme in any case (case-insensitive)', () => {
      const token = generateToken(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        TEST_JWT_SECRET
      );

      const authHeaderLower = `bearer ${token}`;
      const decodedLower = extractAndValidateToken(authHeaderLower);
      expect(decodedLower.userId).toBe('user-123');

      const authHeaderUpper = `BEARER ${token}`;
      const decodedUpper = extractAndValidateToken(authHeaderUpper);
      expect(decodedUpper.userId).toBe('user-123');

      const authHeaderMixed = `BeArEr ${token}`;
      const decodedMixed = extractAndValidateToken(authHeaderMixed);
      expect(decodedMixed.userId).toBe('user-123');
    });

    it('should throw error when token part is empty', () => {
      expect(() => extractAndValidateToken('Bearer ')).toThrow('Token cannot be empty');
    });

    it('should throw error when token part is whitespace only', () => {
      // When there are multiple spaces, split creates more than 2 parts
      expect(() => extractAndValidateToken('Bearer    ')).toThrow(
        'Authorization header format must be: Bearer <token>'
      );
    });

    it('should throw error when token is invalid (malformed)', () => {
      expect(() => extractAndValidateToken('Bearer invalid-token')).toThrow('Invalid token');
    });

    it('should throw error when token is expired', async () => {
      // Create a token that expires immediately
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '0s', // Expires immediately
        }
      );

      // Wait a moment to ensure token is expired
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(() => extractAndValidateToken(`Bearer ${expiredToken}`)).toThrow('Token has expired');
    });

    it('should throw error when token is signed with wrong secret', () => {
      const wrongSecret = 'wrong-secret-key-at-least-32-characters-long';
      const token = generateToken(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        wrongSecret
      );

      expect(() => extractAndValidateToken(`Bearer ${token}`)).toThrow('Invalid token');
    });

    it('should throw error when JWT secret is not configured', () => {
      mockGetJwtSecret.mockImplementation(() => {
        throw new Error('JWT_SECRET environment variable is not set');
      });

      const token = generateToken(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        TEST_JWT_SECRET
      );

      expect(() => extractAndValidateToken(`Bearer ${token}`)).toThrow(
        'JWT_SECRET environment variable is not set'
      );
    });
  });

  describe('generatePolicy', () => {
    it('should generate Allow policy with context', () => {
      const policy = generatePolicy(
        'user-123',
        'Allow',
        TEST_METHOD_ARN,
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        }
      );

      expect(policy.principalId).toBe('user-123');
      expect(policy.policyDocument.Version).toBe('2012-10-17');
      expect(policy.policyDocument.Statement).toHaveLength(1);
      
      const statement = policy.policyDocument.Statement[0] as any;
      expect(statement.Effect).toBe('Allow');
      expect(statement.Action).toBe('execute-api:Invoke');
      expect(statement.Resource).toBe(TEST_METHOD_ARN);
      
      expect(policy.context).toEqual({
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
      });
    });

    it('should generate Deny policy without context', () => {
      const policy = generatePolicy('user-123', 'Deny', TEST_METHOD_ARN);

      expect(policy.principalId).toBe('user-123');
      
      const statement = policy.policyDocument.Statement[0] as any;
      expect(statement.Effect).toBe('Deny');
      
      expect(policy.context).toBeUndefined();
    });

    it('should generate policy with correct resource ARN', () => {
      const customArn = 'arn:aws:execute-api:us-west-2:987654321098:xyz789/dev/POST/auth/login';
      const policy = generatePolicy('user-456', 'Allow', customArn);

      const statement = policy.policyDocument.Statement[0] as any;
      expect(statement.Resource).toBe(customArn);
    });
  });

  describe('handler', () => {
    it('should return Allow policy for valid token', async () => {
      const token = generateToken(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        TEST_JWT_SECRET
      );

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: TEST_METHOD_ARN,
        authorizationToken: `Bearer ${token}`,
      };

      const result = await handler(event);

      expect(result.principalId).toBe('user-123');
      
      const statement = result.policyDocument.Statement[0] as any;
      expect(statement.Effect).toBe('Allow');
      expect(statement.Resource).toBe(TEST_METHOD_ARN);
      
      expect(result.context).toEqual({
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
      });
    });

    it('should throw Unauthorized for missing token', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: TEST_METHOD_ARN,
        authorizationToken: '',
      };

      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should throw Unauthorized for invalid token format', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: TEST_METHOD_ARN,
        authorizationToken: 'InvalidFormat',
      };

      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should throw Unauthorized for malformed token', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: TEST_METHOD_ARN,
        authorizationToken: 'Bearer invalid-token',
      };

      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should throw Unauthorized for expired token', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '0s',
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: TEST_METHOD_ARN,
        authorizationToken: `Bearer ${expiredToken}`,
      };

      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should throw Unauthorized when JWT secret is not configured', async () => {
      mockGetJwtSecret.mockImplementation(() => {
        throw new Error('JWT_SECRET environment variable is not set');
      });

      const token = generateToken(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        TEST_JWT_SECRET
      );

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: TEST_METHOD_ARN,
        authorizationToken: `Bearer ${token}`,
      };

      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should handle different method ARNs correctly', async () => {
      const token = generateToken(
        {
          userId: 'user-789',
          tenantId: 'tenant-abc',
          email: 'another@example.com',
        },
        TEST_JWT_SECRET
      );

      const customArn = 'arn:aws:execute-api:eu-west-1:111222333444:api123/staging/DELETE/tests/test-id';
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: customArn,
        authorizationToken: `Bearer ${token}`,
      };

      const result = await handler(event);

      expect(result.principalId).toBe('user-789');
      
      const statement = result.policyDocument.Statement[0] as any;
      expect(statement.Resource).toBe(customArn);
      
      expect(result.context?.userId).toBe('user-789');
      expect(result.context?.tenantId).toBe('tenant-abc');
      expect(result.context?.email).toBe('another@example.com');
    });
  });

  describe('Edge Cases', () => {
    it('should handle token with extra whitespace in Bearer scheme', () => {
      const token = generateToken(
        {
          userId: 'user-123',
          tenantId: 'tenant-456',
          email: 'test@example.com',
        },
        TEST_JWT_SECRET
      );

      // Note: This should fail because we split by space and expect exactly 2 parts
      expect(() => extractAndValidateToken(`Bearer  ${token}`)).toThrow(
        'Authorization header format must be: Bearer <token>'
      );
    });

    it('should validate all required fields are present in decoded token', () => {
      // Create a token with missing fields
      const jwt = require('jsonwebtoken');
      const incompleteToken = jwt.sign(
        {
          userId: 'user-123',
          // Missing tenantId and email
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
        }
      );

      expect(() => extractAndValidateToken(`Bearer ${incompleteToken}`)).toThrow(
        'Token payload is missing required fields'
      );
    });
  });
});
