/**
 * Unit tests for Auth Lambda - User Registration and Login
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambdas/auth/index';
import * as passwordHash from '../../src/shared/utils/passwordHash';
import * as userOperations from '../../src/shared/database/userOperations';
import * as jwt from '../../src/shared/utils/jwt';
import * as config from '../../src/shared/config';

// Mock dependencies
jest.mock('../../src/shared/utils/passwordHash');
jest.mock('../../src/shared/database/userOperations');
jest.mock('../../src/shared/utils/jwt');
jest.mock('../../src/shared/config');

const mockHashPassword = passwordHash.hashPassword as jest.MockedFunction<typeof passwordHash.hashPassword>;
const mockVerifyPassword = passwordHash.verifyPassword as jest.MockedFunction<typeof passwordHash.verifyPassword>;
const mockCreateUser = userOperations.createUser as jest.MockedFunction<typeof userOperations.createUser>;
const mockGetUserByEmail = userOperations.getUserByEmail as jest.MockedFunction<typeof userOperations.getUserByEmail>;
const mockGenerateToken = jwt.generateToken as jest.MockedFunction<typeof jwt.generateToken>;
const mockGetJwtSecret = config.getJwtSecret as jest.MockedFunction<typeof config.getJwtSecret>;

describe('Auth Lambda - Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (body: any, path = '/auth/register', method = 'POST'): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      path,
      httpMethod: method,
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

  describe('POST /auth/register - Success Cases', () => {
    it('should successfully register a new user with valid credentials', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockHashPassword.mockResolvedValue('hashed_password');
      mockCreateUser.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      expect(mockHashPassword).toHaveBeenCalledWith('SecurePass123!');
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        tenantId: 'tenant-123',
      });

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        tenantId: 'tenant-123',
      });
      expect(responseBody.passwordHash).toBeUndefined();
    });

    it('should trim whitespace from email and tenantId', async () => {
      const requestBody = {
        email: '  test@example.com  ',
        password: 'SecurePass123!',
        tenantId: '  tenant-123  ',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockHashPassword.mockResolvedValue('hashed_password');
      mockCreateUser.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        tenantId: 'tenant-123',
      });
    });
  });

  describe('POST /auth/register - Validation Errors', () => {
    it('should return 400 when request body is missing', async () => {
      const event = {
        ...createMockEvent({}),
        body: null,
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Request body is required');
    });

    it('should return 400 when request body is invalid JSON', async () => {
      const event = {
        ...createMockEvent({}),
        body: 'invalid json{',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Invalid JSON in request body');
    });

    it('should return 400 when email is missing', async () => {
      const requestBody = {
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Email is required');
    });

    it('should return 400 when email is empty string', async () => {
      const requestBody = {
        email: '   ',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Email is required');
    });

    it('should return 400 when email format is invalid', async () => {
      const requestBody = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Invalid email format');
    });

    it('should return 400 when password is missing', async () => {
      const requestBody = {
        email: 'test@example.com',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Password is required');
    });

    it('should return 400 when password is too short', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'short',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Password must be at least 8 characters long');
    });

    it('should return 400 when tenantId is missing', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('TenantId is required');
    });
  });

  describe('POST /auth/register - Conflict Errors', () => {
    it('should return 409 when user already exists', async () => {
      const requestBody = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      mockHashPassword.mockResolvedValue('hashed_password');
      mockCreateUser.mockRejectedValue(new Error('User with this email already exists in the tenant'));

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(409);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('already exists');
    });
  });

  describe('POST /auth/register - Server Errors', () => {
    it('should return 500 when password hashing fails', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      mockHashPassword.mockRejectedValue(new Error('Hashing failed'));

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Failed to register user');
    });

    it('should return 500 when database operation fails', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      mockHashPassword.mockResolvedValue('hashed_password');
      mockCreateUser.mockRejectedValue(new Error('Database connection failed'));

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Failed to register user');
    });
  });

  describe('Route Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const event = createMockEvent({}, '/auth/unknown', 'POST');
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Route not found');
    });

    it('should return 404 for wrong HTTP method', async () => {
      const event = createMockEvent({}, '/auth/register', 'GET');
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Route not found');
    });
  });

  describe('Response Headers', () => {
    it('should include Content-Type header in all responses', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockHashPassword.mockResolvedValue('hashed_password');
      mockCreateUser.mockResolvedValue(mockUser);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });
  });
});


describe('Auth Lambda - Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetJwtSecret.mockReturnValue('test-secret-key-at-least-32-characters-long');
  });

  const createMockEvent = (body: any, path = '/auth/login', method = 'POST'): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      path,
      httpMethod: method,
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

  describe('POST /auth/login - Success Cases', () => {
    it('should successfully login with valid credentials', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('mock-jwt-token');

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockGetUserByEmail).toHaveBeenCalledWith('test@example.com', 'tenant-123');
      expect(mockVerifyPassword).toHaveBeenCalledWith('SecurePass123!', '$2b$10$hashedpassword');
      expect(mockGenerateToken).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          tenantId: 'tenant-123',
          email: 'test@example.com',
        },
        'test-secret-key-at-least-32-characters-long'
      );

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toEqual({
        token: 'mock-jwt-token',
        expiresIn: 3600,
        userId: 'user-123',
        tenantId: 'tenant-123',
      });
    });

    it('should trim whitespace from email and tenantId', async () => {
      const requestBody = {
        email: '  test@example.com  ',
        password: 'SecurePass123!',
        tenantId: '  tenant-123  ',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('mock-jwt-token');

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockGetUserByEmail).toHaveBeenCalledWith('test@example.com', 'tenant-123');
    });
  });

  describe('POST /auth/login - Validation Errors', () => {
    it('should return 400 when request body is missing', async () => {
      const event = {
        ...createMockEvent({}),
        body: null,
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Request body is required');
    });

    it('should return 400 when request body is invalid JSON', async () => {
      const event = {
        ...createMockEvent({}),
        body: 'invalid json{',
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Invalid JSON in request body');
    });

    it('should return 400 when email is missing', async () => {
      const requestBody = {
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Email is required');
    });

    it('should return 400 when email is empty string', async () => {
      const requestBody = {
        email: '   ',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Email is required');
    });

    it('should return 400 when password is missing', async () => {
      const requestBody = {
        email: 'test@example.com',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Password is required');
    });

    it('should return 400 when password is empty string', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: '   ',
        tenantId: 'tenant-123',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('Password is required');
    });

    it('should return 400 when tenantId is missing', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('TenantId is required');
    });

    it('should return 400 when tenantId is empty string', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: '   ',
      };

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toContain('TenantId is required');
    });
  });

  describe('POST /auth/login - Authentication Errors', () => {
    it('should return 401 when user does not exist', async () => {
      const requestBody = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      mockGetUserByEmail.mockResolvedValue(null);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Invalid credentials');
      expect(mockVerifyPassword).not.toHaveBeenCalled();
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 401 when password is incorrect', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(false);

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Invalid credentials');
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should return 401 when user account is inactive', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
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
      expect(mockVerifyPassword).not.toHaveBeenCalled();
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should not reveal whether user exists (user enumeration protection)', async () => {
      // Test with non-existent user
      const requestBody1 = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      mockGetUserByEmail.mockResolvedValue(null);

      const event1 = createMockEvent(requestBody1);
      const result1 = await handler(event1);

      // Test with wrong password
      const requestBody2 = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(false);

      const event2 = createMockEvent(requestBody2);
      const result2 = await handler(event2);

      // Both should return the same generic error
      expect(result1.statusCode).toBe(401);
      expect(result2.statusCode).toBe(401);
      const responseBody1 = JSON.parse(result1.body);
      const responseBody2 = JSON.parse(result2.body);
      expect(responseBody1.error).toBe('Invalid credentials');
      expect(responseBody2.error).toBe('Invalid credentials');
    });
  });

  describe('POST /auth/login - Server Errors', () => {
    it('should return 500 when database query fails', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      mockGetUserByEmail.mockRejectedValue(new Error('Database connection failed'));

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Failed to authenticate user');
    });

    it('should return 500 when password verification fails', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockRejectedValue(new Error('Verification failed'));

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Failed to authenticate user');
    });

    it('should return 500 when JWT generation fails', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockGenerateToken.mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Failed to authenticate user');
    });

    it('should return 500 when JWT secret is not configured', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockGetJwtSecret.mockImplementation(() => {
        throw new Error('JWT_SECRET environment variable is not set');
      });

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error).toBe('Authentication service configuration error');
    });
  });

  describe('Response Structure', () => {
    it('should include Content-Type header in all responses', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('mock-jwt-token');

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });

    it('should never expose password or passwordHash in response', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$hashedpassword',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE' as const,
      };

      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('mock-jwt-token');

      const event = createMockEvent(requestBody);
      const result = await handler(event);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.password).toBeUndefined();
      expect(responseBody.passwordHash).toBeUndefined();
      expect(JSON.stringify(responseBody)).not.toContain('SecurePass123!');
      expect(JSON.stringify(responseBody)).not.toContain('$2b$10$hashedpassword');
    });
  });
});
