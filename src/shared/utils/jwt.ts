import jwt from 'jsonwebtoken';

/**
 * JWT token utilities for authentication
 * Algorithm: HS256
 * Token expiration: 1 hour (as specified in design.md)
 */

const TOKEN_EXPIRATION = '1h'; // 1 hour
const ALGORITHM = 'HS256';

/**
 * JWT token payload structure
 */
export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  iat?: number; // Issued at (automatically added by jwt.sign)
  exp?: number; // Expiration time (automatically added by jwt.sign)
}

/**
 * Decoded JWT token with standard claims
 */
export interface DecodedToken extends JWTPayload {
  iat: number;
  exp: number;
}

/**
 * Generate a JWT token for authenticated user
 * @param payload - Token payload containing userId, tenantId, and email
 * @param secret - Secret key for signing the token
 * @returns Signed JWT token string
 * @throws Error if payload is invalid or token generation fails
 */
export function generateToken(payload: JWTPayload, secret: string): string {
  if (!payload.userId || payload.userId.trim().length === 0) {
    throw new Error('userId is required in token payload');
  }

  if (!payload.tenantId || payload.tenantId.trim().length === 0) {
    throw new Error('tenantId is required in token payload');
  }

  if (!payload.email || payload.email.trim().length === 0) {
    throw new Error('email is required in token payload');
  }

  if (!secret || secret.trim().length === 0) {
    throw new Error('Secret key cannot be empty');
  }

  try {
    const token = jwt.sign(
      {
        userId: payload.userId,
        tenantId: payload.tenantId,
        email: payload.email,
      },
      secret,
      {
        algorithm: ALGORITHM,
        expiresIn: TOKEN_EXPIRATION,
      }
    );

    return token;
  } catch (error) {
    throw new Error(
      `Failed to generate token: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate and decode a JWT token
 * @param token - JWT token string to validate
 * @param secret - Secret key for verifying the token signature
 * @returns Decoded token payload if valid
 * @throws Error if token is invalid, expired, or verification fails
 */
export function validateToken(token: string, secret: string): DecodedToken {
  if (!token || token.trim().length === 0) {
    throw new Error('Token cannot be empty');
  }

  if (!secret || secret.trim().length === 0) {
    throw new Error('Secret key cannot be empty');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: [ALGORITHM],
    }) as DecodedToken;

    // Validate required fields are present in decoded token
    if (!decoded.userId || !decoded.tenantId || !decoded.email) {
      throw new Error('Token payload is missing required fields');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error(`Invalid token: ${error.message}`);
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to validate token: Unknown error');
    }
  }
}
