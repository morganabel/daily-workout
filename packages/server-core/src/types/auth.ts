/**
 * Authentication interfaces for server-core
 */

export interface AuthResult {
  userId: string;
  deviceToken: string;
}

/**
 * AuthProvider defines how the server authenticates requests.
 * Implementations can use DeviceToken (OSS default), Better Auth, or custom logic.
 */
export interface AuthProvider {
  /**
   * Authenticates a request and returns user info or null if unauthorized
   */
  authenticate(request: Request): Promise<AuthResult | null>;
}
