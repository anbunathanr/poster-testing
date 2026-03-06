// Shared TypeScript types and interfaces

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  createdAt: number;
  updatedAt: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Test {
  testId: string;
  tenantId: string;
  userId: string;
  testPrompt: string;
  testScript: TestScript;
  environment: Environment;
  createdAt: number;
  status: 'DRAFT' | 'READY' | 'EXECUTING' | 'COMPLETED';
}

export interface TestScript {
  steps: TestStep[];
}

export interface TestStep {
  action: 'navigate' | 'fill' | 'click' | 'assert' | 'waitForNavigation';
  url?: string;
  selector?: string;
  value?: string;
  condition?: string;
}

export interface TestResult {
  resultId: string;
  testId: string;
  tenantId: string;
  userId: string;
  status: 'PASS' | 'FAIL';
  startTime: number;
  endTime: number;
  duration: number;
  screenshotsS3Keys: string[];
  logsS3Key: string;
  errorMessage?: string;
  executionLog: Record<string, any>;
}

export interface EnvironmentConfig {
  tenantId: string;
  environment: Environment;
  baseUrl: string;
  credentials: Record<string, any>;
  configuration: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export type Environment = 'DEV' | 'STAGING' | 'PROD';

export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface APIResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}
