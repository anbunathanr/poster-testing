/**
 * S3 Upload Utilities
 * Handles uploading test evidence (screenshots and logs) to S3
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';

// Initialize S3 client lazily
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({});
  }
  return s3Client;
}

const EVIDENCE_BUCKET = process.env.EVIDENCE_BUCKET || 'ai-testing-platform-evidence';
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * Sleep for a specified duration
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number): number {
  return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Check if error is a transient error that should be retried
 * @param error - Error to check
 * @returns True if error is transient
 */
function isTransientError(error: any): boolean {
  if (!error) return false;
  
  // Check for common transient error codes
  const transientErrorCodes = [
    'RequestTimeout',
    'RequestTimeoutException',
    'ServiceUnavailable',
    'ServiceUnavailableException',
    'ThrottlingException',
    'TooManyRequestsException',
    'ProvisionedThroughputExceededException',
    'SlowDown',
    'NetworkingError',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH'
  ];
  
  const errorCode = error.code || error.name || '';
  const errorMessage = error.message || '';
  
  return transientErrorCodes.some(code => 
    errorCode.includes(code) || errorMessage.includes(code)
  );
}

/**
 * Execute S3 upload with retry logic and exponential backoff
 * @param command - S3 PutObjectCommand to execute
 * @param s3Key - S3 key for logging purposes
 * @returns Promise that resolves when upload succeeds
 * @throws Error if all retry attempts fail
 */
async function executeWithRetry(
  command: PutObjectCommand,
  s3Key: string
): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      await getS3Client().send(command);
      
      if (attempt > 0) {
        console.log(`S3 upload succeeded on attempt ${attempt + 1} for: ${s3Key}`);
      }
      
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if this is the last attempt
      if (attempt === MAX_RETRY_ATTEMPTS - 1) {
        console.error(`S3 upload failed after ${MAX_RETRY_ATTEMPTS} attempts for: ${s3Key}`);
        break;
      }
      
      // Check if error is transient and should be retried
      if (!isTransientError(error)) {
        console.error(`S3 upload failed with non-transient error for: ${s3Key}`, error);
        throw lastError;
      }
      
      // Calculate backoff delay and log retry attempt
      const delayMs = calculateBackoffDelay(attempt);
      console.log(
        `S3 upload attempt ${attempt + 1} failed for: ${s3Key}. ` +
        `Retrying in ${delayMs}ms... Error: ${lastError.message}`
      );
      
      // Wait before retrying
      await sleep(delayMs);
    }
  }
  
  // All retries exhausted
  throw new Error(
    `S3 upload failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Upload a file to S3
 * 
 * @param filePath - Local file path
 * @param s3Key - S3 object key
 * @param contentType - Content type (optional)
 * @returns S3 key of uploaded file
 * @throws Error if upload fails
 */
export async function uploadFileToS3(
  filePath: string,
  s3Key: string,
  contentType?: string
): Promise<string> {
  try {
    // Read file from disk
    const fileContent = await fs.readFile(filePath);

    // Upload to S3 with retry logic
    const command = new PutObjectCommand({
      Bucket: EVIDENCE_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
    });

    await executeWithRetry(command, s3Key);
    
    console.log(`File uploaded to S3: ${s3Key}`);
    return s3Key;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to upload file to S3: ${errorMessage}`);
    throw new Error(`S3 upload failed: ${errorMessage}`);
  }
}

/**
 * Upload screenshots to S3
 * 
 * @param screenshotPaths - Array of local screenshot file paths
 * @param tenantId - Tenant identifier
 * @param resultId - Test result identifier
 * @returns Array of S3 keys
 * @throws Error if any upload fails
 */
export async function uploadScreenshotsToS3(
  screenshotPaths: string[],
  tenantId: string,
  resultId: string
): Promise<string[]> {
  const s3Keys: string[] = [];

  for (const screenshotPath of screenshotPaths) {
    const fileName = path.basename(screenshotPath);
    const s3Key = `${tenantId}/screenshots/${resultId}/${fileName}`;
    
    await uploadFileToS3(screenshotPath, s3Key, 'image/png');
    s3Keys.push(s3Key);
  }

  console.log(`Uploaded ${s3Keys.length} screenshots to S3`);
  return s3Keys;
}

/**
 * Upload execution log to S3
 * 
 * @param logFilePath - Local log file path
 * @param tenantId - Tenant identifier
 * @param resultId - Test result identifier
 * @returns S3 key of uploaded log
 * @throws Error if upload fails
 */
export async function uploadLogToS3(
  logFilePath: string,
  tenantId: string,
  resultId: string
): Promise<string> {
  const fileName = path.basename(logFilePath);
  const s3Key = `${tenantId}/logs/${resultId}/${fileName}`;
  
  await uploadFileToS3(logFilePath, s3Key, 'application/json');
  
  console.log(`Uploaded execution log to S3: ${s3Key}`);
  return s3Key;
}

/**
 * Upload buffer content to S3 (for in-memory content)
 * 
 * @param content - Content to upload (string or buffer)
 * @param s3Key - S3 object key
 * @param contentType - Content type
 * @returns S3 key of uploaded content
 * @throws Error if upload fails
 */
export async function uploadContentToS3(
  content: string | Buffer,
  s3Key: string,
  contentType: string
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: EVIDENCE_BUCKET,
      Key: s3Key,
      Body: content,
      ContentType: contentType,
    });

    await executeWithRetry(command, s3Key);
    
    console.log(`Content uploaded to S3: ${s3Key}`);
    return s3Key;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to upload content to S3: ${errorMessage}`);
    throw new Error(`S3 upload failed: ${errorMessage}`);
  }
}
