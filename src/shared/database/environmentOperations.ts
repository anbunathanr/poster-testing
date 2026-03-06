/**
 * DynamoDB Environment Operations
 * Handles CRUD operations for the Environments table
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { EnvironmentConfig, Environment } from '../types';

// Initialize DynamoDB client lazily
let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({});
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

const ENVIRONMENTS_TABLE = process.env.ENVIRONMENTS_TABLE || 'Environments';

/**
 * Retrieves environment configuration for a tenant
 *
 * @param tenantId - Tenant identifier
 * @param environment - Environment name (DEV, STAGING, PROD)
 * @returns The environment configuration if found, null otherwise
 * @throws Error if query fails
 */
export async function getEnvironmentConfig(
  tenantId: string,
  environment: Environment
): Promise<EnvironmentConfig | null> {
  // Validate input
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!environment) {
    throw new Error('Environment is required');
  }

  const command = new GetCommand({
    TableName: ENVIRONMENTS_TABLE,
    Key: {
      tenantId,
      environment,
    },
  });

  try {
    const response = await getDocClient().send(command);

    if (!response.Item) {
      return null;
    }

    return response.Item as EnvironmentConfig;
  } catch (error) {
    throw new Error(
      `Failed to get environment config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Input for creating or updating environment configuration
 */
export interface CreateEnvironmentConfigInput {
  tenantId: string;
  environment: Environment;
  baseUrl: string;
  credentials?: Record<string, any>;
  configuration?: Record<string, any>;
}

/**
 * Creates or updates environment configuration
 *
 * @param input - Environment configuration data
 * @returns The created/updated environment configuration
 * @throws Error if operation fails or validation fails
 */
export async function createOrUpdateEnvironmentConfig(
  input: CreateEnvironmentConfigInput
): Promise<EnvironmentConfig> {
  // Validate input
  if (!input.tenantId || input.tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!input.environment) {
    throw new Error('Environment is required');
  }
  if (!input.baseUrl || input.baseUrl.trim() === '') {
    throw new Error('Base URL is required');
  }

  const now = Date.now();

  // Check if config already exists to preserve createdAt
  const existingConfig = await getEnvironmentConfig(input.tenantId, input.environment);

  const config: EnvironmentConfig = {
    tenantId: input.tenantId,
    environment: input.environment,
    baseUrl: input.baseUrl,
    credentials: input.credentials || {},
    configuration: input.configuration || {},
    createdAt: existingConfig?.createdAt || now,
    updatedAt: now,
  };

  const command = new PutCommand({
    TableName: ENVIRONMENTS_TABLE,
    Item: config,
  });

  try {
    await getDocClient().send(command);
    return config;
  } catch (error) {
    throw new Error(
      `Failed to create/update environment config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Updates environment configuration
 *
 * @param input - Environment configuration data to update
 * @returns The updated environment configuration
 * @throws Error if environment not found or operation fails
 */
export async function updateEnvironmentConfig(
  input: CreateEnvironmentConfigInput
): Promise<EnvironmentConfig> {
  // Validate input
  if (!input.tenantId || input.tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!input.environment) {
    throw new Error('Environment is required');
  }

  // Check if config exists
  const existingConfig = await getEnvironmentConfig(input.tenantId, input.environment);

  if (!existingConfig) {
    throw new Error('Environment configuration not found');
  }

  // Update the configuration
  return await createOrUpdateEnvironmentConfig(input);
}

/**
 * Deletes environment configuration
 *
 * @param tenantId - Tenant identifier
 * @param environment - Environment name (DEV, STAGING, PROD)
 * @throws Error if operation fails
 */
export async function deleteEnvironmentConfig(
  tenantId: string,
  environment: Environment
): Promise<void> {
  // Validate input
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }
  if (!environment) {
    throw new Error('Environment is required');
  }

  const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');

  const command = new DeleteCommand({
    TableName: ENVIRONMENTS_TABLE,
    Key: {
      tenantId,
      environment,
    },
  });

  try {
    await getDocClient().send(command);
  } catch (error) {
    throw new Error(
      `Failed to delete environment config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Lists all environment configurations for a tenant
 *
 * @param tenantId - Tenant identifier
 * @returns Array of environment configurations
 * @throws Error if query fails
 */
export async function listEnvironmentConfigs(tenantId: string): Promise<EnvironmentConfig[]> {
  // Validate input
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID is required');
  }

  const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');

  const command = new QueryCommand({
    TableName: ENVIRONMENTS_TABLE,
    KeyConditionExpression: 'tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':tenantId': tenantId,
    },
  });

  try {
    const response = await getDocClient().send(command);
    return (response.Items || []) as EnvironmentConfig[];
  } catch (error) {
    throw new Error(
      `Failed to list environment configs: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
