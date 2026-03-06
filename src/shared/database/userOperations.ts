/**
 * DynamoDB User Operations
 * Handles CRUD operations for the Users table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Initialize DynamoDB client lazily
let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({});
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

const USERS_TABLE = process.env.USERS_TABLE || 'Users';

/**
 * User data model
 */
export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  createdAt: number;
  updatedAt: number;
  status: 'ACTIVE' | 'INACTIVE';
}

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  email: string;
  passwordHash: string;
  tenantId: string;
}

/**
 * Creates a new user in the Users table
 *
 * @param input - User creation data
 * @returns The created user
 * @throws Error if user creation fails or validation fails
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  // Validate input
  if (!input.email || input.email.trim() === '') {
    throw new Error('Email is required');
  }
  if (!input.passwordHash || input.passwordHash.trim() === '') {
    throw new Error('Password hash is required');
  }
  if (!input.tenantId || input.tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) {
    throw new Error('Invalid email format');
  }

  // Check if user already exists
  const existingUser = await getUserByEmail(input.email, input.tenantId);
  if (existingUser) {
    throw new Error('User with this email already exists in the tenant');
  }

  const now = Date.now();
  const user: User = {
    userId: uuidv4(),
    email: input.email.toLowerCase().trim(),
    passwordHash: input.passwordHash,
    tenantId: input.tenantId,
    createdAt: now,
    updatedAt: now,
    status: 'ACTIVE',
  };

  const command = new PutCommand({
    TableName: USERS_TABLE,
    Item: user,
  });

  try {
    await getDocClient().send(command);
    return user;
  } catch (error) {
    throw new Error(
      `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Retrieves a user by email address within a tenant
 * Uses the tenantId-email GSI for efficient lookup
 *
 * @param email - User's email address
 * @param tenantId - Tenant identifier
 * @returns The user if found, null otherwise
 * @throws Error if query fails
 */
export async function getUserByEmail(email: string, tenantId: string): Promise<User | null> {
  // Validate input
  if (!email || email.trim() === '') {
    throw new Error('Email is required');
  }
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }

  const command = new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'tenantId-email-index',
    KeyConditionExpression: 'tenantId = :tenantId AND email = :email',
    ExpressionAttributeValues: {
      ':tenantId': tenantId,
      ':email': email.toLowerCase().trim(),
    },
  });

  try {
    const response = await getDocClient().send(command);

    if (!response.Items || response.Items.length === 0) {
      return null;
    }

    return response.Items[0] as User;
  } catch (error) {
    throw new Error(
      `Failed to get user by email: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Retrieves a user by userId
 *
 * @param userId - User identifier
 * @returns The user if found, null otherwise
 * @throws Error if query fails
 */
export async function getUserById(userId: string): Promise<User | null> {
  // Validate input
  if (!userId || userId.trim() === '') {
    throw new Error('User ID is required');
  }

  const command = new GetCommand({
    TableName: USERS_TABLE,
    Key: {
      userId,
    },
  });

  try {
    const response = await getDocClient().send(command);

    if (!response.Item) {
      return null;
    }

    return response.Item as User;
  } catch (error) {
    throw new Error(
      `Failed to get user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Associates a user with a tenant by updating the tenantId
 * This operation is used when moving a user to a different tenant
 *
 * @param userId - User identifier
 * @param newTenantId - New tenant identifier
 * @returns The updated user
 * @throws Error if user not found or update fails
 */
export async function associateUserWithTenant(userId: string, newTenantId: string): Promise<User> {
  // Validate input
  if (!userId || userId.trim() === '') {
    throw new Error('User ID is required');
  }
  if (!newTenantId || newTenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }

  // Verify user exists
  const existingUser = await getUserById(userId);
  if (!existingUser) {
    throw new Error('User not found');
  }

  const now = Date.now();

  const command = new UpdateCommand({
    TableName: USERS_TABLE,
    Key: {
      userId,
    },
    UpdateExpression: 'SET tenantId = :tenantId, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':tenantId': newTenantId,
      ':updatedAt': now,
    },
    ReturnValues: 'ALL_NEW',
  });

  try {
    const response = await getDocClient().send(command);

    if (!response.Attributes) {
      throw new Error('Failed to update user');
    }

    return response.Attributes as User;
  } catch (error) {
    throw new Error(
      `Failed to associate user with tenant: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Updates user status (ACTIVE/INACTIVE)
 *
 * @param userId - User identifier
 * @param status - New status
 * @returns The updated user
 * @throws Error if user not found or update fails
 */
export async function updateUserStatus(
  userId: string,
  status: 'ACTIVE' | 'INACTIVE'
): Promise<User> {
  // Validate input
  if (!userId || userId.trim() === '') {
    throw new Error('User ID is required');
  }
  if (status !== 'ACTIVE' && status !== 'INACTIVE') {
    throw new Error('Status must be ACTIVE or INACTIVE');
  }

  // Verify user exists
  const existingUser = await getUserById(userId);
  if (!existingUser) {
    throw new Error('User not found');
  }

  const now = Date.now();

  const command = new UpdateCommand({
    TableName: USERS_TABLE,
    Key: {
      userId,
    },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':updatedAt': now,
    },
    ReturnValues: 'ALL_NEW',
  });

  try {
    const response = await getDocClient().send(command);

    if (!response.Attributes) {
      throw new Error('Failed to update user status');
    }

    return response.Attributes as User;
  } catch (error) {
    throw new Error(
      `Failed to update user status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
