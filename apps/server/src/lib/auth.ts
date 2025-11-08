/**
 * Authentication utilities for DeviceToken-based auth
 *
 * DeviceToken is a bearer token sent in the Authorization header:
 * Authorization: Bearer <token>
 */

export interface AuthResult {
  userId: string;
  deviceToken: string;
}

/**
 * Extracts and validates DeviceToken from request headers
 *
 * For now, this is a stub implementation that accepts any token.
 * In production, this would validate against a database of DeviceTokens.
 */
export function getDeviceToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7).trim();
}

/**
 * Validates a DeviceToken and returns user info
 *
 * TODO: Replace with actual database lookup when Prisma is set up
 */
export async function validateDeviceToken(
  token: string | null,
): Promise<AuthResult | null> {
  if (!token) {
    return null;
  }

  // Stub: accept any non-empty token
  // In production, this would query the DeviceToken table
  if (token.length === 0) {
    return null;
  }

  return {
    userId: 'user-stub', // TODO: Get from database
    deviceToken: token,
  };
}

/**
 * Authenticates a request and returns user info or null
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthResult | null> {
  const token = getDeviceToken(request);
  return validateDeviceToken(token);
}

