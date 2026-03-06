import { generateToken, validateToken, JWTPayload, DecodedToken } from '../../src/shared/utils/jwt';
import jwt from 'jsonwebtoken';

describe('JWT Token Utilities', () => {
  const SECRET = 'test-secret-key-for-jwt-signing';
  const validPayload: JWTPayload = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    email: 'test@example.com',
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(validPayload, SECRET);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts: header.payload.signature
    });

    it('should include userId, tenantId, and email in token payload', () => {
      const token = generateToken(validPayload, SECRET);
      const decoded = jwt.decode(token) as DecodedToken;

      expect(decoded.userId).toBe(validPayload.userId);
      expect(decoded.tenantId).toBe(validPayload.tenantId);
      expect(decoded.email).toBe(validPayload.email);
    });

    it('should include iat (issued at) timestamp', () => {
      const token = generateToken(validPayload, SECRET);
      const decoded = jwt.decode(token) as DecodedToken;

      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
      expect(decoded.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('should include exp (expiration) timestamp', () => {
      const token = generateToken(validPayload, SECRET);
      const decoded = jwt.decode(token) as DecodedToken;

      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should set expiration to 1 hour from issuance', () => {
      const token = generateToken(validPayload, SECRET);
      const decoded = jwt.decode(token) as DecodedToken;

      const expectedExpiration = decoded.iat + 3600; // 1 hour = 3600 seconds
      expect(decoded.exp).toBe(expectedExpiration);
    });

    it('should use HS256 algorithm', () => {
      const token = generateToken(validPayload, SECRET);
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());

      expect(header.alg).toBe('HS256');
    });

    it('should throw error for empty userId', () => {
      const invalidPayload = { ...validPayload, userId: '' };
      expect(() => generateToken(invalidPayload, SECRET)).toThrow('userId is required in token payload');
    });

    it('should throw error for whitespace-only userId', () => {
      const invalidPayload = { ...validPayload, userId: '   ' };
      expect(() => generateToken(invalidPayload, SECRET)).toThrow('userId is required in token payload');
    });

    it('should throw error for empty tenantId', () => {
      const invalidPayload = { ...validPayload, tenantId: '' };
      expect(() => generateToken(invalidPayload, SECRET)).toThrow('tenantId is required in token payload');
    });

    it('should throw error for whitespace-only tenantId', () => {
      const invalidPayload = { ...validPayload, tenantId: '   ' };
      expect(() => generateToken(invalidPayload, SECRET)).toThrow('tenantId is required in token payload');
    });

    it('should throw error for empty email', () => {
      const invalidPayload = { ...validPayload, email: '' };
      expect(() => generateToken(invalidPayload, SECRET)).toThrow('email is required in token payload');
    });

    it('should throw error for whitespace-only email', () => {
      const invalidPayload = { ...validPayload, email: '   ' };
      expect(() => generateToken(invalidPayload, SECRET)).toThrow('email is required in token payload');
    });

    it('should throw error for empty secret', () => {
      expect(() => generateToken(validPayload, '')).toThrow('Secret key cannot be empty');
    });

    it('should throw error for whitespace-only secret', () => {
      expect(() => generateToken(validPayload, '   ')).toThrow('Secret key cannot be empty');
    });

    it('should handle special characters in email', () => {
      const payload = { ...validPayload, email: 'test+tag@example.com' };
      const token = generateToken(payload, SECRET);
      const decoded = jwt.decode(token) as DecodedToken;

      expect(decoded.email).toBe(payload.email);
    });

    it('should handle UUID format for userId and tenantId', () => {
      const payload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        email: 'test@example.com',
      };
      const token = generateToken(payload, SECRET);
      const decoded = jwt.decode(token) as DecodedToken;

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.tenantId).toBe(payload.tenantId);
    });

    it('should generate different tokens for same payload at different times', () => {
      const token1 = generateToken(validPayload, SECRET);
      
      // Wait a small amount to ensure different iat
      const start = Date.now();
      while (Date.now() - start < 1100) {} // Wait > 1 second
      
      const token2 = generateToken(validPayload, SECRET);

      expect(token1).not.toBe(token2);
    });

    it('should generate different tokens with different secrets', () => {
      const token1 = generateToken(validPayload, SECRET);
      const token2 = generateToken(validPayload, 'different-secret');

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateToken', () => {
    it('should validate and decode a valid token', () => {
      const token = generateToken(validPayload, SECRET);
      const decoded = validateToken(token, SECRET);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(validPayload.userId);
      expect(decoded.tenantId).toBe(validPayload.tenantId);
      expect(decoded.email).toBe(validPayload.email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should return correct timestamps', () => {
      const token = generateToken(validPayload, SECRET);
      const decoded = validateToken(token, SECRET);

      expect(typeof decoded.iat).toBe('number');
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should throw error for empty token', () => {
      expect(() => validateToken('', SECRET)).toThrow('Token cannot be empty');
    });

    it('should throw error for whitespace-only token', () => {
      expect(() => validateToken('   ', SECRET)).toThrow('Token cannot be empty');
    });

    it('should throw error for empty secret', () => {
      const token = generateToken(validPayload, SECRET);
      expect(() => validateToken(token, '')).toThrow('Secret key cannot be empty');
    });

    it('should throw error for whitespace-only secret', () => {
      const token = generateToken(validPayload, SECRET);
      expect(() => validateToken(token, '   ')).toThrow('Secret key cannot be empty');
    });

    it('should throw error for invalid token format', () => {
      expect(() => validateToken('invalid.token', SECRET)).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      expect(() => validateToken('not-a-jwt-token', SECRET)).toThrow('Invalid token');
    });

    it('should throw error for token with wrong secret', () => {
      const token = generateToken(validPayload, SECRET);
      expect(() => validateToken(token, 'wrong-secret')).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      // Create a token that expires immediately
      const expiredToken = jwt.sign(
        validPayload,
        SECRET,
        { algorithm: 'HS256', expiresIn: '0s' }
      );

      // Wait a moment to ensure expiration
      const start = Date.now();
      while (Date.now() - start < 100) {}

      expect(() => validateToken(expiredToken, SECRET)).toThrow('Token has expired');
    });

    it('should throw error for token with missing userId', () => {
      const invalidPayload = { tenantId: 'tenant-456', email: 'test@example.com' };
      const token = jwt.sign(invalidPayload, SECRET, { algorithm: 'HS256', expiresIn: '1h' });

      expect(() => validateToken(token, SECRET)).toThrow('Token payload is missing required fields');
    });

    it('should throw error for token with missing tenantId', () => {
      const invalidPayload = { userId: 'user-123', email: 'test@example.com' };
      const token = jwt.sign(invalidPayload, SECRET, { algorithm: 'HS256', expiresIn: '1h' });

      expect(() => validateToken(token, SECRET)).toThrow('Token payload is missing required fields');
    });

    it('should throw error for token with missing email', () => {
      const invalidPayload = { userId: 'user-123', tenantId: 'tenant-456' };
      const token = jwt.sign(invalidPayload, SECRET, { algorithm: 'HS256', expiresIn: '1h' });

      expect(() => validateToken(token, SECRET)).toThrow('Token payload is missing required fields');
    });

    it('should reject token signed with different algorithm', () => {
      // Create token with RS256 instead of HS256
      const token = jwt.sign(validPayload, SECRET, { algorithm: 'HS512', expiresIn: '1h' });

      expect(() => validateToken(token, SECRET)).toThrow('Invalid token');
    });

    it('should handle token with extra claims', () => {
      const payloadWithExtra = { ...validPayload, customField: 'custom-value' };
      const token = jwt.sign(payloadWithExtra, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
      const decoded = validateToken(token, SECRET);

      expect(decoded.userId).toBe(validPayload.userId);
      expect(decoded.tenantId).toBe(validPayload.tenantId);
      expect(decoded.email).toBe(validPayload.email);
    });

    it('should validate token multiple times consistently', () => {
      const token = generateToken(validPayload, SECRET);

      const decoded1 = validateToken(token, SECRET);
      const decoded2 = validateToken(token, SECRET);
      const decoded3 = validateToken(token, SECRET);

      expect(decoded1).toEqual(decoded2);
      expect(decoded2).toEqual(decoded3);
    });
  });

  describe('Integration tests', () => {
    it('should complete full token lifecycle: generate -> validate -> decode', () => {
      const token = generateToken(validPayload, SECRET);
      const decoded = validateToken(token, SECRET);

      expect(decoded.userId).toBe(validPayload.userId);
      expect(decoded.tenantId).toBe(validPayload.tenantId);
      expect(decoded.email).toBe(validPayload.email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp - decoded.iat).toBe(3600); // 1 hour
    });

    it('should handle multiple users with different tokens', () => {
      const user1Payload: JWTPayload = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user1@example.com',
      };

      const user2Payload: JWTPayload = {
        userId: 'user-2',
        tenantId: 'tenant-2',
        email: 'user2@example.com',
      };

      const token1 = generateToken(user1Payload, SECRET);
      const token2 = generateToken(user2Payload, SECRET);

      const decoded1 = validateToken(token1, SECRET);
      const decoded2 = validateToken(token2, SECRET);

      expect(decoded1.userId).toBe(user1Payload.userId);
      expect(decoded1.tenantId).toBe(user1Payload.tenantId);
      expect(decoded2.userId).toBe(user2Payload.userId);
      expect(decoded2.tenantId).toBe(user2Payload.tenantId);
    });

    it('should enforce tenant isolation through tokens', () => {
      const tenant1User: JWTPayload = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user1@tenant1.com',
      };

      const tenant2User: JWTPayload = {
        userId: 'user-2',
        tenantId: 'tenant-2',
        email: 'user2@tenant2.com',
      };

      const token1 = generateToken(tenant1User, SECRET);
      const token2 = generateToken(tenant2User, SECRET);

      const decoded1 = validateToken(token1, SECRET);
      const decoded2 = validateToken(token2, SECRET);

      // Verify tokens maintain tenant isolation
      expect(decoded1.tenantId).not.toBe(decoded2.tenantId);
      expect(decoded1.tenantId).toBe('tenant-1');
      expect(decoded2.tenantId).toBe('tenant-2');
    });

    it('should reject cross-secret validation', () => {
      const secret1 = 'secret-for-env-1';
      const secret2 = 'secret-for-env-2';

      const token = generateToken(validPayload, secret1);

      // Should validate with correct secret
      expect(() => validateToken(token, secret1)).not.toThrow();

      // Should fail with different secret
      expect(() => validateToken(token, secret2)).toThrow('Invalid token');
    });

    it('should handle rapid token generation and validation', () => {
      const tokens: string[] = [];
      const count = 10;

      // Generate multiple tokens rapidly
      for (let i = 0; i < count; i++) {
        const payload: JWTPayload = {
          userId: `user-${i}`,
          tenantId: `tenant-${i}`,
          email: `user${i}@example.com`,
        };
        tokens.push(generateToken(payload, SECRET));
      }

      // Validate all tokens
      tokens.forEach((token, i) => {
        const decoded = validateToken(token, SECRET);
        expect(decoded.userId).toBe(`user-${i}`);
        expect(decoded.tenantId).toBe(`tenant-${i}`);
        expect(decoded.email).toBe(`user${i}@example.com`);
      });
    });
  });
});
