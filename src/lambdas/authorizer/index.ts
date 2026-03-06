// API Gateway Lambda Authorizer - JWT token validation
import { 
  APIGatewayAuthorizerResult, 
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResultContext 
} from 'aws-lambda';
import { validateToken, DecodedToken } from '../../shared/utils/jwt';
import { getJwtSecret } from '../../shared/config';

/**
 * Context object that will be passed to downstream Lambda functions
 * Contains user and tenant information extracted from JWT
 */
interface AuthorizerContext extends APIGatewayAuthorizerResultContext {
  userId: string;
  tenantId: string;
  email: string;
}

/**
 * Main handler for API Gateway Lambda Authorizer
 * Validates JWT tokens from the Authorization header
 * 
 * @param event - API Gateway Token Authorizer event containing the authorization token
 * @returns IAM policy document allowing or denying access
 */
export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer invoked for methodArn:', event.methodArn);

  try {
    // Extract and validate the JWT token
    const decodedToken = extractAndValidateToken(event.authorizationToken);

    // Generate IAM policy allowing access
    const policy = generatePolicy(
      decodedToken.userId,
      'Allow',
      event.methodArn,
      {
        userId: decodedToken.userId,
        tenantId: decodedToken.tenantId,
        email: decodedToken.email,
      }
    );

    console.log('Authorization successful for user:', decodedToken.userId);
    return policy;
  } catch (error) {
    console.error('Authorization failed:', error instanceof Error ? error.message : 'Unknown error');
    
    // For security reasons, we throw 'Unauthorized' instead of returning a Deny policy
    // This prevents potential information leakage about why the token was invalid
    throw new Error('Unauthorized');
  }
};

/**
 * Extract JWT token from Authorization header and validate it
 * 
 * @param authorizationToken - Authorization header value (format: "Bearer <token>")
 * @returns Decoded token payload
 * @throws Error if token is missing, malformed, or invalid
 */
export function extractAndValidateToken(authorizationToken: string): DecodedToken {
  // Check if authorization token is provided
  if (!authorizationToken || authorizationToken.trim() === '') {
    throw new Error('Authorization token is missing');
  }

  // Extract token from "Bearer <token>" format
  const tokenParts = authorizationToken.split(' ');
  
  if (tokenParts.length !== 2) {
    throw new Error('Authorization header format must be: Bearer <token>');
  }

  const [scheme, token] = tokenParts;

  // Validate Bearer scheme (case-insensitive)
  if (scheme.toLowerCase() !== 'bearer') {
    throw new Error('Authorization scheme must be Bearer');
  }

  // Validate token is not empty
  if (!token || token.trim() === '') {
    throw new Error('Token cannot be empty');
  }

  // Get JWT secret from environment
  const jwtSecret = getJwtSecret();

  // Validate the JWT token
  const decodedToken = validateToken(token, jwtSecret);

  return decodedToken;
}

/**
 * Generate IAM policy document for API Gateway
 * 
 * @param principalId - User identifier (userId)
 * @param effect - 'Allow' or 'Deny'
 * @param resource - API Gateway method ARN
 * @param context - Additional context to pass to downstream Lambda functions
 * @returns IAM policy document
 */
export function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: AuthorizerContext
): APIGatewayAuthorizerResult {
  const authResponse: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };

  // Add context if provided
  // Context values must be strings, numbers, or booleans
  if (context) {
    authResponse.context = context;
  }

  return authResponse;
}
