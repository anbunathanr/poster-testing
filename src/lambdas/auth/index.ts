// Auth Lambda - User authentication and JWT token management
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { hashPassword, verifyPassword } from '../../shared/utils/passwordHash';
import { createUser, getUserByEmail } from '../../shared/database/userOperations';
import { generateToken } from '../../shared/utils/jwt';
import { getJwtSecret } from '../../shared/config';

/**
 * Main handler for Auth Lambda
 * Routes requests to appropriate handlers based on HTTP method and path
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Route to appropriate handler
    if (path === '/auth/register' && method === 'POST') {
      return await handleRegister(event);
    }

    if (path === '/auth/login' && method === 'POST') {
      return await handleLogin(event);
    }

    // Default response for unimplemented routes
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Route not found' }),
    };
  } catch (error) {
    console.error('Unhandled error in Auth Lambda:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Registration request body interface
 */
interface RegisterRequest {
  email: string;
  password: string;
  tenantId: string;
}

/**
 * Handles user registration
 * POST /auth/register
 */
async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: RegisterRequest;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    // Validate required fields
    const { email, password, tenantId } = requestBody;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Email is required and must be a non-empty string' }),
      };
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Password is required and must be a non-empty string' }),
      };
    }

    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'TenantId is required and must be a non-empty string' }),
      };
    }

    // Validate email format (after trimming)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid email format' }),
      };
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Password must be at least 8 characters long' }),
      };
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create user in DynamoDB
    const user = await createUser({
      email: email.trim(),
      passwordHash,
      tenantId: tenantId.trim(),
    });

    // Return success response (exclude passwordHash from response)
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.userId,
        email: user.email,
        tenantId: user.tenantId,
      }),
    };
  } catch (error) {
    console.error('Error in handleRegister:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      // User already exists
      if (error.message.includes('already exists')) {
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: error.message }),
        };
      }

      // Validation errors from userOperations or passwordHash
      if (
        error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('cannot be empty')
      ) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: error.message }),
        };
      }
    }

    // Generic error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to register user' }),
    };
  }
}

/**
 * Login request body interface
 */
interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Handles user login
 * POST /auth/login
 */
async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let requestBody: LoginRequest;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid JSON in request body' }),
      };
    }

    // Validate required fields
    const { email, password } = requestBody;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Email is required and must be a non-empty string' }),
      };
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Password is required and must be a non-empty string' }),
      };
    }

    // Note: For login, we need to search across all tenants since we don't know the tenantId yet
    // We'll use a workaround by trying common tenant patterns or requiring tenantId in the request
    // For now, we'll require tenantId in the login request (as per the design, JWT contains tenantId)
    // Alternative: Add a GSI on email only, but this could expose cross-tenant data

    // Extract tenantId from request body (required for multi-tenant isolation)
    const tenantId = (requestBody as any).tenantId;
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'TenantId is required for login' }),
      };
    }

    // Retrieve user from DynamoDB
    const user = await getUserByEmail(email.trim(), tenantId.trim());

    if (!user) {
      // Return generic error to prevent user enumeration
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'User account is not active' }),
      };
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // Return generic error to prevent user enumeration
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }

    // Get JWT secret from environment
    const jwtSecret = getJwtSecret();

    // Generate JWT token
    const token = generateToken(
      {
        userId: user.userId,
        tenantId: user.tenantId,
        email: user.email,
      },
      jwtSecret
    );

    // Return success response with token and user info
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        expiresIn: 3600, // 1 hour in seconds
        userId: user.userId,
        tenantId: user.tenantId,
      }),
    };
  } catch (error) {
    console.error('Error in handleLogin:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      // JWT secret errors
      if (error.message.includes('JWT_SECRET')) {
        console.error('JWT configuration error:', error.message);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Authentication service configuration error' }),
        };
      }

      // Validation errors
      if (
        error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('cannot be empty')
      ) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: error.message }),
        };
      }
    }

    // Generic error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to authenticate user' }),
    };
  }
}
