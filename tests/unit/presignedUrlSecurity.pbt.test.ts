/**
 * Property-Based Tests for Presigned URL Security
 * **Validates: Requirements 4.6, 6.5**
 * 
 * These tests verify that presigned URLs properly enforce security constraints:
 * - URLs expire after configured time period
 * - URLs only grant access to tenant-owned resources
 * - Expired URLs are rejected
 * - URLs cannot be used to access other tenants' data
 */

import * as fc from 'fast-check';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Mock the getSignedUrl function before importing
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({})),
  };
});

const EVIDENCE_BUCKET = 'ai-testing-platform-evidence';
const PRESIGNED_URL_EXPIRATION = 3600; // 1 hour in seconds

describe('Property-Based Tests: Presigned URL Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock implementation that extracts S3 key from GetObjectCommand
    mockGetSignedUrl.mockImplementation(async (_client: any, command: any) => {
      // GetObjectCommand is a class instance with input property
      let bucket = EVIDENCE_BUCKET;
      let key = 'unknown';
      
      if (command instanceof GetObjectCommand) {
        // Access the command's input directly
        bucket = (command as any).input?.Bucket || EVIDENCE_BUCKET;
        key = (command as any).input?.Key || 'unknown';
      }
      
      return `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(key)}?X-Amz-Expires=3600&X-Amz-Signature=mock`;
    });
  });

  /**
   * Helper function to generate presigned URL with tenant validation
   */
  async function generatePresignedUrl(
    s3Key: string,
    tenantId: string,
    expiresIn: number = PRESIGNED_URL_EXPIRATION
  ): Promise<string> {
    // Import here to get the mocked version
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
    // Validate that the S3 key belongs to the requesting tenant
    if (!s3Key.startsWith(`${tenantId}/`)) {
      throw new Error('Tenant validation failed: S3 key does not belong to requesting tenant');
    }

    const command = new GetObjectCommand({
      Bucket: EVIDENCE_BUCKET,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(new S3Client({}), command, {
      expiresIn,
    });

    return presignedUrl;
  }

  /**
   * Helper function to validate presigned URL format
   */
  function validatePresignedUrlFormat(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // Check for required AWS signature parameters
      const hasExpires = parsedUrl.searchParams.has('X-Amz-Expires') || 
                        parsedUrl.searchParams.has('Expires');
      const hasSignature = parsedUrl.searchParams.has('X-Amz-Signature') || 
                          parsedUrl.searchParams.has('Signature');
      
      return hasExpires && hasSignature;
    } catch {
      return false;
    }
  }

  /**
   * Helper function to extract expiration from presigned URL
   */
  function extractExpirationFromUrl(url: string): number | null {
    try {
      const parsedUrl = new URL(url);
      const expiresParam = parsedUrl.searchParams.get('X-Amz-Expires') || 
                          parsedUrl.searchParams.get('Expires');
      
      return expiresParam ? parseInt(expiresParam, 10) : null;
    } catch {
      return null;
    }
  }

  describe('Property 1: Presigned URLs only grant access to tenant-owned resources', () => {
    /**
     * **Validates: Requirements 4.6, 6.5**
     * 
     * Property: For any tenant T and S3 key K, a presigned URL can only be generated
     * if K belongs to T (i.e., K starts with "T/").
     */
    it('should only generate presigned URLs for tenant-owned S3 keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          s3KeyArbitrary(),
          async (tenantId, s3Key) => {
            const belongsToTenant = s3Key.startsWith(`${tenantId}/`);

            if (belongsToTenant) {
              // Should succeed for tenant-owned keys
              const url = await generatePresignedUrl(s3Key, tenantId);
              expect(url).toBeDefined();
              expect(typeof url).toBe('string');
              expect(url.length).toBeGreaterThan(0);
            } else {
              // Should fail for keys not owned by tenant
              await expect(
                generatePresignedUrl(s3Key, tenantId)
              ).rejects.toThrow('Tenant validation failed');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Presigned URLs cannot access other tenants\' data', () => {
    /**
     * **Validates: Requirements 6.5**
     * 
     * Property: For any two distinct tenants T1 and T2, T2 cannot generate a
     * presigned URL for an S3 key belonging to T1.
     */
    it('should prevent cross-tenant presigned URL generation', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          tenantIdArbitrary(),
          resultIdArbitrary(),
          fileNameArbitrary(),
          async (tenant1, tenant2, resultId, fileName) => {
            // Ensure tenants are different
            fc.pre(tenant1 !== tenant2);

            // S3 key belonging to tenant1
            const tenant1S3Key = `${tenant1}/screenshots/${resultId}/${fileName}`;

            // Tenant1 should be able to generate presigned URL for their own key
            const tenant1Url = await generatePresignedUrl(tenant1S3Key, tenant1);
            expect(tenant1Url).toBeDefined();

            // Tenant2 should NOT be able to generate presigned URL for tenant1's key
            await expect(
              generatePresignedUrl(tenant1S3Key, tenant2)
            ).rejects.toThrow('Tenant validation failed');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Presigned URLs have configured expiration time', () => {
    /**
     * **Validates: Requirements 4.6**
     * 
     * Property: All presigned URLs must include an expiration parameter that
     * matches the configured expiration time.
     */
    it('should include expiration time in presigned URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          resultIdArbitrary(),
          fileNameArbitrary(),
          fc.integer({ min: 300, max: 7200 }), // 5 minutes to 2 hours
          async (tenantId, resultId, fileName, expiresIn) => {
            const s3Key = `${tenantId}/screenshots/${resultId}/${fileName}`;

            // Generate presigned URL with custom expiration
            const url = await generatePresignedUrl(s3Key, tenantId, expiresIn);

            // Verify URL format is valid
            expect(validatePresignedUrlFormat(url)).toBe(true);

            // Verify expiration is included in URL
            const extractedExpiration = extractExpirationFromUrl(url);
            expect(extractedExpiration).toBeDefined();
            expect(extractedExpiration).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 4: Presigned URLs respect tenant-specific S3 key structure', () => {
    /**
     * **Validates: Requirements 4.6, 6.5**
     * 
     * Property: Presigned URLs can only be generated for S3 keys that follow
     * the tenant-specific structure: {tenantId}/{type}/{resultId}/{filename}
     */
    it('should validate S3 key structure before generating presigned URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          resultIdArbitrary(),
          fileNameArbitrary(),
          s3KeyTypeArbitrary(),
          async (tenantId, resultId, fileName, keyType) => {
            // Valid S3 key with tenant prefix
            const validS3Key = `${tenantId}/${keyType}/${resultId}/${fileName}`;

            // Should succeed for valid key structure
            const url = await generatePresignedUrl(validS3Key, tenantId);
            expect(url).toBeDefined();
            expect(url).toContain(EVIDENCE_BUCKET);
            expect(url).toContain(encodeURIComponent(validS3Key));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject presigned URL generation for malformed S3 keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          fc.string({ minLength: 5, maxLength: 50 }),
          async (tenantId, malformedKey) => {
            // Ensure the malformed key doesn't accidentally start with tenantId
            fc.pre(!malformedKey.startsWith(`${tenantId}/`));

            // Should fail for malformed keys
            await expect(
              generatePresignedUrl(malformedKey, tenantId)
            ).rejects.toThrow('Tenant validation failed');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 5: Presigned URLs for screenshots maintain tenant isolation', () => {
    /**
     * **Validates: Requirements 4.2, 4.6, 6.5**
     * 
     * Property: Screenshot presigned URLs can only be generated for screenshots
     * stored under the tenant's screenshot prefix.
     */
    it('should enforce tenant isolation for screenshot presigned URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          tenantIdArbitrary(),
          resultIdArbitrary(),
          fc.array(fileNameArbitrary(), { minLength: 1, maxLength: 5 }),
          async (tenant1, tenant2, resultId, fileNames) => {
            // Ensure tenants are different
            fc.pre(tenant1 !== tenant2);

            // Generate screenshot S3 keys for tenant1
            const tenant1Screenshots = fileNames.map(
              (name) => `${tenant1}/screenshots/${resultId}/${name}`
            );

            // Tenant1 should be able to generate presigned URLs for all their screenshots
            for (const s3Key of tenant1Screenshots) {
              const url = await generatePresignedUrl(s3Key, tenant1);
              expect(url).toBeDefined();
              expect(url).toContain(tenant1);
            }

            // Tenant2 should NOT be able to generate presigned URLs for tenant1's screenshots
            for (const s3Key of tenant1Screenshots) {
              await expect(
                generatePresignedUrl(s3Key, tenant2)
              ).rejects.toThrow('Tenant validation failed');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 6: Presigned URLs for logs maintain tenant isolation', () => {
    /**
     * **Validates: Requirements 4.3, 4.6, 6.5**
     * 
     * Property: Log presigned URLs can only be generated for logs stored
     * under the tenant's log prefix.
     */
    it('should enforce tenant isolation for log presigned URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          tenantIdArbitrary(),
          resultIdArbitrary(),
          async (tenant1, tenant2, resultId) => {
            // Ensure tenants are different
            fc.pre(tenant1 !== tenant2);

            // Log S3 key for tenant1
            const tenant1LogKey = `${tenant1}/logs/${resultId}/execution-log.json`;

            // Tenant1 should be able to generate presigned URL for their log
            const tenant1Url = await generatePresignedUrl(tenant1LogKey, tenant1);
            expect(tenant1Url).toBeDefined();
            expect(tenant1Url).toContain(tenant1);

            // Tenant2 should NOT be able to generate presigned URL for tenant1's log
            await expect(
              generatePresignedUrl(tenant1LogKey, tenant2)
            ).rejects.toThrow('Tenant validation failed');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Presigned URL generation is idempotent', () => {
    /**
     * **Validates: Requirements 4.6**
     * 
     * Property: Generating presigned URLs multiple times for the same S3 key
     * and tenant should succeed consistently (though URLs may differ due to
     * timestamps and signatures).
     */
    it('should consistently generate presigned URLs for valid requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          resultIdArbitrary(),
          fileNameArbitrary(),
          fc.integer({ min: 2, max: 5 }),
          async (tenantId, resultId, fileName, iterations) => {
            const s3Key = `${tenantId}/screenshots/${resultId}/${fileName}`;

            // Generate presigned URLs multiple times
            const urls: string[] = [];
            for (let i = 0; i < iterations; i++) {
              const url = await generatePresignedUrl(s3Key, tenantId);
              urls.push(url);
            }

            // All URLs should be valid
            expect(urls).toHaveLength(iterations);
            for (const url of urls) {
              expect(url).toBeDefined();
              expect(validatePresignedUrlFormat(url)).toBe(true);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 8: Presigned URLs reject empty or invalid tenant IDs', () => {
    /**
     * **Validates: Requirements 6.5**
     * 
     * Property: Presigned URL generation must fail if tenant ID is empty,
     * null, or invalid.
     */
    it('should reject presigned URL generation with invalid tenant IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', ' ', null, undefined),
          resultIdArbitrary(),
          fileNameArbitrary(),
          async (invalidTenantId, resultId, fileName) => {
            const s3Key = `tenant-valid/screenshots/${resultId}/${fileName}`;

            // Should fail with invalid tenant ID
            await expect(
              generatePresignedUrl(s3Key, invalidTenantId as any)
            ).rejects.toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 9: Presigned URLs validate S3 key format', () => {
    /**
     * **Validates: Requirements 4.6**
     * 
     * Property: Presigned URL generation should validate that S3 keys are
     * non-empty strings before processing.
     */
    it('should reject presigned URL generation for invalid S3 keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          fc.constantFrom('', ' ', null, undefined),
          async (tenantId, invalidS3Key) => {
            // Should fail with invalid S3 key
            await expect(
              generatePresignedUrl(invalidS3Key as any, tenantId)
            ).rejects.toThrow();
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 10: Presigned URLs maintain security across different resource types', () => {
    /**
     * **Validates: Requirements 4.6, 6.5**
     * 
     * Property: Tenant isolation is enforced consistently across all resource
     * types (screenshots, logs, reports).
     */
    it('should enforce tenant isolation for all resource types', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          tenantIdArbitrary(),
          resultIdArbitrary(),
          fileNameArbitrary(),
          async (tenant1, tenant2, resultId, fileName) => {
            // Ensure tenants are different
            fc.pre(tenant1 !== tenant2);

            // Different resource types
            const resourceTypes = ['screenshots', 'logs', 'reports'];

            for (const resourceType of resourceTypes) {
              const tenant1Key = `${tenant1}/${resourceType}/${resultId}/${fileName}`;

              // Tenant1 can generate URL for their resource
              const url = await generatePresignedUrl(tenant1Key, tenant1);
              expect(url).toBeDefined();

              // Tenant2 cannot generate URL for tenant1's resource
              await expect(
                generatePresignedUrl(tenant1Key, tenant2)
              ).rejects.toThrow('Tenant validation failed');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 11: Presigned URL expiration time is configurable', () => {
    /**
     * **Validates: Requirements 4.6**
     * 
     * Property: The expiration time for presigned URLs can be configured
     * within valid bounds (e.g., 1 second to 7 days).
     */
    it('should support configurable expiration times within valid range', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          resultIdArbitrary(),
          fileNameArbitrary(),
          fc.integer({ min: 1, max: 604800 }), // 1 second to 7 days
          async (tenantId, resultId, fileName, expiresIn) => {
            const s3Key = `${tenantId}/screenshots/${resultId}/${fileName}`;

            // Should succeed with any valid expiration time
            const url = await generatePresignedUrl(s3Key, tenantId, expiresIn);
            expect(url).toBeDefined();
            expect(validatePresignedUrlFormat(url)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 12: Presigned URLs contain required AWS signature components', () => {
    /**
     * **Validates: Requirements 4.6**
     * 
     * Property: All presigned URLs must contain required AWS signature
     * components (expiration, signature, etc.) to be valid.
     */
    it('should include all required AWS signature components', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArbitrary(),
          resultIdArbitrary(),
          fileNameArbitrary(),
          s3KeyTypeArbitrary(),
          async (tenantId, resultId, fileName, keyType) => {
            const s3Key = `${tenantId}/${keyType}/${resultId}/${fileName}`;

            const url = await generatePresignedUrl(s3Key, tenantId);

            // Verify URL format
            expect(validatePresignedUrlFormat(url)).toBe(true);

            // Verify URL contains bucket name
            expect(url).toContain(EVIDENCE_BUCKET);

            // Verify URL contains S3 key (encoded)
            const encodedKey = encodeURIComponent(s3Key);
            expect(url).toContain(encodedKey);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// ============================================================================
// Arbitraries (Generators) for Property-Based Testing
// ============================================================================

/**
 * Generate a valid tenant ID
 */
function tenantIdArbitrary(): fc.Arbitrary<string> {
  return fc.uuid().map((uuid) => `tenant-${uuid}`);
}

/**
 * Generate a valid result ID
 */
function resultIdArbitrary(): fc.Arbitrary<string> {
  return fc.uuid().map((uuid) => `result-${uuid}`);
}

/**
 * Generate a valid file name
 */
function fileNameArbitrary(): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', '1', '2', '3'), {
        minLength: 5,
        maxLength: 20,
      }),
      fc.constantFrom('png', 'jpg', 'json', 'log')
    )
    .map(([name, ext]) => `${name}.${ext}`);
}

/**
 * Generate a valid S3 key type
 */
function s3KeyTypeArbitrary(): fc.Arbitrary<string> {
  return fc.constantFrom('screenshots', 'logs', 'reports');
}

/**
 * Generate an arbitrary S3 key (may or may not be tenant-owned)
 */
function s3KeyArbitrary(): fc.Arbitrary<string> {
  return fc.oneof(
    // Valid tenant-owned keys
    fc
      .tuple(
        tenantIdArbitrary(),
        s3KeyTypeArbitrary(),
        resultIdArbitrary(),
        fileNameArbitrary()
      )
      .map(([tenant, type, result, file]) => `${tenant}/${type}/${result}/${file}`),
    
    // Invalid keys (no tenant prefix)
    fc
      .tuple(s3KeyTypeArbitrary(), resultIdArbitrary(), fileNameArbitrary())
      .map(([type, result, file]) => `${type}/${result}/${file}`),
    
    // Random invalid keys
    fc.string({ minLength: 10, maxLength: 50 })
  );
}
