/**
 * Unit tests for User Operations
 * Tests DynamoDB operations with mocked AWS SDK
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Create mock DynamoDB Document client
const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock DynamoDBClient constructor
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

// Now import the functions to test
import {
  createUser,
  getUserByEmail,
  getUserById,
  associateUserWithTenant,
  updateUserStatus,
  User,
  CreateUserInput,
} from '../../src/shared/database/userOperations';

describe('User Operations', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    ddbMock.reset();
    // Set default environment variable
    process.env.USERS_TABLE = 'Users';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const validInput: CreateUserInput = {
      email: 'test@example.com',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
      tenantId: 'tenant-123',
    };

    it('should create a new user successfully', async () => {
      // Mock getUserByEmail to return null (user doesn't exist)
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      // Mock PutCommand
      ddbMock.on(PutCommand).resolves({});

      const user = await createUser(validInput);

      expect(user).toBeDefined();
      expect(user.userId).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.passwordHash).toBe(validInput.passwordHash);
      expect(user.tenantId).toBe('tenant-123');
      expect(user.status).toBe('ACTIVE');
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
      expect(user.createdAt).toBe(user.updatedAt);
    });

    it('should normalize email to lowercase', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({});

      const input = { ...validInput, email: 'Test@Example.COM' };
      const user = await createUser(input);

      expect(user.email).toBe('test@example.com');
    });

    it('should throw error for empty email', async () => {
      const input = { ...validInput, email: '' };
      await expect(createUser(input)).rejects.toThrow('Email is required');
    });

    it('should throw error for invalid email format', async () => {
      const input = { ...validInput, email: 'invalid-email' };
      await expect(createUser(input)).rejects.toThrow('Invalid email format');
    });

    it('should throw error for empty password hash', async () => {
      const input = { ...validInput, passwordHash: '' };
      await expect(createUser(input)).rejects.toThrow('Password hash is required');
    });

    it('should throw error for empty tenant ID', async () => {
      const input = { ...validInput, tenantId: '' };
      await expect(createUser(input)).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if user already exists', async () => {
      const existingUser: User = {
        userId: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$10$existing',
        tenantId: 'tenant-123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ACTIVE',
      };

      ddbMock.on(QueryCommand).resolves({ Items: [existingUser] });

      await expect(createUser(validInput)).rejects.toThrow('User with this email already exists in the tenant');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      await expect(createUser(validInput)).rejects.toThrow('Failed to create user: DynamoDB error');
    });
  });

  describe('getUserByEmail', () => {
    const mockUser: User = {
      userId: 'user-123',
      email: 'test@example.com',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
      tenantId: 'tenant-123',
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
      status: 'ACTIVE',
    };

    it('should retrieve user by email successfully', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [mockUser] });

      const user = await getUserByEmail('test@example.com', 'tenant-123');

      expect(user).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const user = await getUserByEmail('nonexistent@example.com', 'tenant-123');

      expect(user).toBeNull();
    });

    it('should throw error for empty email', async () => {
      await expect(getUserByEmail('', 'tenant-123')).rejects.toThrow('Email is required');
    });

    it('should throw error for empty tenant ID', async () => {
      await expect(getUserByEmail('test@example.com', '')).rejects.toThrow('Tenant ID is required');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      await expect(getUserByEmail('test@example.com', 'tenant-123')).rejects.toThrow('Failed to get user by email: DynamoDB error');
    });
  });

  describe('getUserById', () => {
    const mockUser: User = {
      userId: 'user-123',
      email: 'test@example.com',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
      tenantId: 'tenant-123',
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
      status: 'ACTIVE',
    };

    it('should retrieve user by ID successfully', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockUser });

      const user = await getUserById('user-123');

      expect(user).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      const user = await getUserById('nonexistent-user');

      expect(user).toBeNull();
    });

    it('should throw error for empty user ID', async () => {
      await expect(getUserById('')).rejects.toThrow('User ID is required');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      await expect(getUserById('user-123')).rejects.toThrow('Failed to get user by ID: DynamoDB error');
    });
  });

  describe('associateUserWithTenant', () => {
    const mockUser: User = {
      userId: 'user-123',
      email: 'test@example.com',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
      tenantId: 'tenant-123',
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
      status: 'ACTIVE',
    };

    it('should associate user with new tenant successfully', async () => {
      const updatedUser = { ...mockUser, tenantId: 'tenant-456', updatedAt: Date.now() };
      
      ddbMock.on(GetCommand).resolves({ Item: mockUser });
      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedUser });

      const user = await associateUserWithTenant('user-123', 'tenant-456');

      expect(user.tenantId).toBe('tenant-456');
      expect(user.updatedAt).toBeGreaterThan(mockUser.updatedAt);
    });

    it('should throw error for empty user ID', async () => {
      await expect(associateUserWithTenant('', 'tenant-456')).rejects.toThrow('User ID is required');
    });

    it('should throw error for empty tenant ID', async () => {
      await expect(associateUserWithTenant('user-123', '')).rejects.toThrow('Tenant ID is required');
    });

    it('should throw error if user not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      await expect(associateUserWithTenant('nonexistent-user', 'tenant-456')).rejects.toThrow('User not found');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockUser });
      ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));

      await expect(associateUserWithTenant('user-123', 'tenant-456')).rejects.toThrow('Failed to associate user with tenant: DynamoDB error');
    });
  });

  describe('updateUserStatus', () => {
    const mockUser: User = {
      userId: 'user-123',
      email: 'test@example.com',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
      tenantId: 'tenant-123',
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
      status: 'ACTIVE',
    };

    it('should update user status to INACTIVE', async () => {
      const updatedUser = { ...mockUser, status: 'INACTIVE' as const, updatedAt: Date.now() };
      
      ddbMock.on(GetCommand).resolves({ Item: mockUser });
      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedUser });

      const user = await updateUserStatus('user-123', 'INACTIVE');

      expect(user.status).toBe('INACTIVE');
      expect(user.updatedAt).toBeGreaterThan(mockUser.updatedAt);
    });

    it('should throw error for empty user ID', async () => {
      await expect(updateUserStatus('', 'INACTIVE')).rejects.toThrow('User ID is required');
    });

    it('should throw error for invalid status', async () => {
      // @ts-expect-error Testing invalid status
      await expect(updateUserStatus('user-123', 'INVALID')).rejects.toThrow('Status must be ACTIVE or INACTIVE');
    });

    it('should throw error if user not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      await expect(updateUserStatus('nonexistent-user', 'INACTIVE')).rejects.toThrow('User not found');
    });

    it('should handle DynamoDB errors', async () => {
      ddbMock.on(GetCommand).resolves({ Item: mockUser });
      ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));

      await expect(updateUserStatus('user-123', 'INACTIVE')).rejects.toThrow('Failed to update user status: DynamoDB error');
    });
  });
});
