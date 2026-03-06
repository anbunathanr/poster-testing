/**
 * Integration tests for Auth Lambda - User Registration and Login
 * Tests the complete flow with mocked dependencies at the module level
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambdas/auth/index';
import * as userOperations from '../../src/shared/database/userOperations';
import * as passwordHash from '../../src/shared/utils/passwordHash';

// Mock user operations and password hash modules
jest.mock('../../src/shared/database/userOperations');
jest.mock('../../src/shared/utils/passwordHash');

const mockCreateUser = userOperations.createUser as jest.MockedFunction<typeof userOperations.createUser>;
const mockGetUserByEmail = userOperations.getUserByEmail as jest.MockedFunction<typeof userOperations.getUserByEmail>;
const mockHashPassword = passwordHash.hashPassword as jest.MockedFunction<typeof passwordHash.hashPassword>;
const mockVerifyPassword = passwordHash.verifyPassword as jest.MockedFunction<typeof passwordHash.verifyPassword>;

describe('Auth Lambda Integration - Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USERS_TABLE = 'Users';
    mockHashPassword.mockImplementation(async (password) => `$2b$10$hashed_${password}`);
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      path: '/auth/register',
      httpMethod: 'POST',
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  };

  describe('End-to-End Registration Flow', () => {
    it('should complete full registration flow with password hashing', async () => {
      const requestBody = {
        email: 'integration@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-integration',
      };

      const mockUser = {
        userId: 'user-integration-123',
        email: 'integration@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-integration',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockCreateUser.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      expect(result.headers?.['Content-Type']).toBe('application/json');

      const responseBody = JSON.parse(result.body);
      expect(responseBody.userId).toBe('user-integration-123');
      expect(responseBody.email).toBe('integration@example.com');
      expect(responseBody.tenantId).toBe('tenant-integration');
      expect(responseBody.passwordHash).toBeUndefined();

      // Verify createUser was called with hashed password
      expect(mockCreateUser).toHaveBeenCalledTimes(1);
      const createUserCall = mockCreateUser.mock.calls[0][0];
      expect(createUserCall.email).toBe('integration@example.com');
      expect(createUserCall.tenantId).toBe('tenant-integration');
      expect(createUserCall.passwordHash).toBeDefined();
      expect(createUserCall.passwordHash).not.toBe('SecurePassword123!');
      expect(createUserCall.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should handle complete validation and error flow', async () => {
      const testCases = [
        {
          body: { password: 'test', tenantId: 'tenant' },
          expectedStatus: 400,
          expectedError: 'Email is required',
        },
        {
          body: { email: 'invalid-email', password: 'test12345', tenantId: 'tenant' },
          expectedStatus: 400,
          expectedError: 'Invalid email format',
        },
        {
          body: { email: 'test@example.com', password: 'short', tenantId: 'tenant' },
          expectedStatus: 400,
          expectedError: 'at least 8 characters',
        },
      ];

      for (const testCase of testCases) {
        const event = createMockEvent(testCase.body);
        const result = await handler(event);

        expect(result.statusCode).toBe(testCase.expectedStatus);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.error).toContain(testCase.expectedError);
      }
    });

    it('should handle duplicate user registration', async () => {
      const requestBody = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-123',
      };

      mockCreateUser.mockRejectedValue(
        new Error('User with this email already exists in the tenant')
      );

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(409);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('already exists');
    });

    it('should handle database errors gracefully', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-123',
      };

      mockCreateUser.mockRejectedValue(new Error('DynamoDB connection failed'));

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Failed to register user');
    });

    it('should normalize email to lowercase', async () => {
      const requestBody = {
        email: 'TestUser@EXAMPLE.COM',
        password: 'SecurePassword123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'testuser@example.com',
        passwordHash: '$2b$10$hash',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockCreateUser.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);

      // Email normalization happens in createUser, so we pass the trimmed email
      const createUserCall = mockCreateUser.mock.calls[0][0];
      expect(createUserCall.email).toBe('TestUser@EXAMPLE.COM'); // Auth Lambda passes as-is after trim
      
      // But the response should show the normalized email from the database
      const responseBody = JSON.parse(result.body);
      expect(responseBody.email).toBe('testuser@example.com');
    });

    it('should trim whitespace from inputs', async () => {
      const requestBody = {
        email: '  test@example.com  ',
        password: 'SecurePassword123!',
        tenantId: '  tenant-123  ',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hash',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockCreateUser.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);

      const createUserCall = mockCreateUser.mock.calls[0][0];
      expect(createUserCall.email).toBe('test@example.com');
      expect(createUserCall.tenantId).toBe('tenant-123');
    });
  });

  describe('Security Validation', () => {
    it('should never expose password hash in response', async () => {
      const requestBody = {
        email: 'secure@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'secure@example.com',
        passwordHash: '$2b$10$verysecurehash',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockCreateUser.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.passwordHash).toBeUndefined();
      expect(responseBody.password).toBeUndefined();
      expect(JSON.stringify(responseBody)).not.toContain('$2b$');
    });

    it('should hash different passwords to different hashes', async () => {
      const passwords = ['Password1!', 'Password2!', 'Password3!'];
      const hashes: string[] = [];

      for (const password of passwords) {
        const requestBody = {
          email: 'test@example.com',
          password,
          tenantId: 'tenant-123',
        };

        mockCreateUser.mockImplementation(async (input) => ({
          userId: 'user-123',
          email: input.email,
          passwordHash: input.passwordHash,
          tenantId: input.tenantId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'ACTIVE',
        }));

        const event = createMockEvent(requestBody);
        await handler(event);

        const createUserCall = mockCreateUser.mock.calls[mockCreateUser.mock.calls.length - 1][0];
        hashes.push(createUserCall.passwordHash);
      }

      // All hashes should be different
      expect(new Set(hashes).size).toBe(3);
      // All should be bcrypt hashes
      hashes.forEach(hash => {
        expect(hash).toMatch(/^\$2[aby]\$/);
      });
    });
  });

  describe('API Contract Validation', () => {
    it('should return correct response structure on success', async () => {
      const requestBody = {
        email: 'api@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-api',
      };

      const mockUser = {
        userId: 'user-api-123',
        email: 'api@example.com',
        passwordHash: '$2b$10$hash',
        tenantId: 'tenant-api',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockCreateUser.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      expect(result.headers).toBeDefined();
      expect(result.headers?.['Content-Type']).toBe('application/json');
      expect(result.body).toBeDefined();

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toHaveProperty('userId');
      expect(responseBody).toHaveProperty('email');
      expect(responseBody).toHaveProperty('tenantId');
      expect(Object.keys(responseBody)).toEqual(['userId', 'email', 'tenantId']);
    });

    it('should return correct error structure on failure', async () => {
      const requestBody = {
        email: 'invalid',
        password: 'test',
        tenantId: 'tenant',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBeGreaterThanOrEqual(400);
      expect(result.headers?.['Content-Type']).toBe('application/json');

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toHaveProperty('error');
      expect(typeof responseBody.error).toBe('string');
    });
  });
});


describe('Auth Lambda Integration - Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USERS_TABLE = 'Users';
    process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-characters-long-for-testing';
    // Mock password verification to return true for correct passwords
    mockVerifyPassword.mockImplementation(async (password, hash) => {
      // Simple mock: if hash contains the password, it's valid
      return hash.includes(password) || password === 'SecurePassword123!';
    });
  });

  const createMockEvent = (body: any, path = '/auth/login'): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      path,
      httpMethod: 'POST',
      headers: {},
      multiValueHeaders: {},
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  };

  describe('End-to-End Login Flow', () => {
    it('should complete full login flow with password verification and JWT generation', async () => {
      const requestBody = {
        email: 'login@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-login',
      };

      const mockUser = {
        userId: 'user-login-123',
        email: 'login@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-login',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');

      const responseBody = JSON.parse(result.body);
      expect(responseBody.token).toBeDefined();
      expect(typeof responseBody.token).toBe('string');
      expect(responseBody.token.length).toBeGreaterThan(0);
      expect(responseBody.expiresIn).toBe(3600);
      expect(responseBody.userId).toBe('user-login-123');
      expect(responseBody.tenantId).toBe('tenant-login');

      // Verify getUserByEmail was called correctly
      expect(mockGetUserByEmail).toHaveBeenCalledWith('login@example.com', 'tenant-login');
    });

    it('should reject login with invalid credentials', async () => {
      const requestBody = {
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
        tenantId: 'tenant-123',
      };

      mockGetUserByEmail.mockResolvedValue(null);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Invalid credentials');
      expect(responseBody.token).toBeUndefined();
    });

    it('should reject login for inactive user', async () => {
      const requestBody = {
        email: 'inactive@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-inactive-123',
        email: 'inactive@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'INACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('User account is not active');
      expect(responseBody.token).toBeUndefined();
    });

    it('should handle complete validation flow', async () => {
      const testCases = [
        {
          body: { password: 'test', tenantId: 'tenant' },
          expectedStatus: 400,
          expectedError: 'Email is required',
        },
        {
          body: { email: 'test@example.com', tenantId: 'tenant' },
          expectedStatus: 400,
          expectedError: 'Password is required',
        },
        {
          body: { email: 'test@example.com', password: 'test12345' },
          expectedStatus: 400,
          expectedError: 'TenantId is required',
        },
      ];

      for (const testCase of testCases) {
        const event = createMockEvent(testCase.body);
        const result = await handler(event);

        expect(result.statusCode).toBe(testCase.expectedStatus);
        const responseBody = JSON.parse(result.body);
        expect(responseBody.error).toContain(testCase.expectedError);
      }
    });

    it('should handle database errors gracefully', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-123',
      };

      mockGetUserByEmail.mockRejectedValue(new Error('DynamoDB connection failed'));

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Failed to authenticate user');
    });

    it('should trim whitespace from inputs', async () => {
      const requestBody = {
        email: '  test@example.com  ',
        password: 'SecurePassword123!',
        tenantId: '  tenant-123  ',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hash',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockGetUserByEmail).toHaveBeenCalledWith('test@example.com', 'tenant-123');
    });
  });

  describe('Security Validation', () => {
    it('should never expose password or passwordHash in response', async () => {
      const requestBody = {
        email: 'secure@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'secure@example.com',
        passwordHash: '$2b$10$verysecurehash',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.passwordHash).toBeUndefined();
      expect(responseBody.password).toBeUndefined();
      expect(JSON.stringify(responseBody)).not.toContain('$2b$10$verysecurehash');
      expect(JSON.stringify(responseBody)).not.toContain('SecurePassword123!');
    });

    it('should generate valid JWT token with correct payload', async () => {
      const requestBody = {
        email: 'jwt@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-jwt',
      };

      const mockUser = {
        userId: 'user-jwt-123',
        email: 'jwt@example.com',
        passwordHash: '$2b$10$hash',
        tenantId: 'tenant-jwt',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.token).toBeDefined();
      expect(typeof responseBody.token).toBe('string');

      // Token should be a JWT (three parts separated by dots)
      const tokenParts = responseBody.token.split('.');
      expect(tokenParts.length).toBe(3);
    });

    it('should enforce tenant isolation - different tenants cannot login with same email', async () => {
      const requestBody1 = {
        email: 'shared@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-1',
      };

      const requestBody2 = {
        email: 'shared@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-2',
      };

      // User exists in tenant-1
      mockGetUserByEmail.mockImplementation(async (_email, tenantId) => {
        if (tenantId === 'tenant-1') {
          return {
            userId: 'user-tenant1',
            email: 'shared@example.com',
            passwordHash: '$2b$10$hash',
            tenantId: 'tenant-1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'ACTIVE',
          };
        }
        return null; // User does not exist in tenant-2
      });

      // Login to tenant-1 should succeed
      const event1 = createMockEvent(requestBody1);
      const result1 = await handler(event1);
      expect(result1.statusCode).toBe(200);

      // Login to tenant-2 should fail
      const event2 = createMockEvent(requestBody2);
      const result2 = await handler(event2);
      expect(result2.statusCode).toBe(401);
      const responseBody2 = JSON.parse(result2.body);
      expect(responseBody2.error).toBe('Invalid credentials');
    });
  });

  describe('API Contract Validation', () => {
    it('should return correct response structure on success', async () => {
      const requestBody = {
        email: 'api@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-api',
      };

      const mockUser = {
        userId: 'user-api-123',
        email: 'api@example.com',
        passwordHash: '$2b$10$hash',
        tenantId: 'tenant-api',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toBeDefined();
      expect(result.headers?.['Content-Type']).toBe('application/json');
      expect(result.body).toBeDefined();

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toHaveProperty('token');
      expect(responseBody).toHaveProperty('expiresIn');
      expect(responseBody).toHaveProperty('userId');
      expect(responseBody).toHaveProperty('tenantId');
      expect(Object.keys(responseBody).sort()).toEqual(['expiresIn', 'tenantId', 'token', 'userId']);
    });

    it('should return correct error structure on failure', async () => {
      const requestBody = {
        email: 'invalid',
        password: 'test',
        tenantId: 'tenant',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBeGreaterThanOrEqual(400);
      expect(result.headers?.['Content-Type']).toBe('application/json');

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toHaveProperty('error');
      expect(typeof responseBody.error).toBe('string');
    });

    it('should match the API contract from design.md', async () => {
      const requestBody = {
        email: 'contract@example.com',
        password: 'SecurePassword123!',
        tenantId: 'tenant-contract',
      };

      const mockUser = {
        userId: 'user-contract-123',
        email: 'contract@example.com',
        passwordHash: '$2b$10$hash',
        tenantId: 'tenant-contract',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      
      // Verify response matches design.md contract
      expect(typeof responseBody.token).toBe('string');
      expect(responseBody.expiresIn).toBe(3600); // 1 hour
      expect(responseBody.userId).toBe('user-contract-123');
      expect(responseBody.tenantId).toBe('tenant-contract');
    });
  });
});
