/**
 * Authentication interfaces for server-core
 */

/**
 * Result of successful authentication.
 *
 * - `userId`: Stable account-level identity for billing, metering, and cross-device data.
 * - `principalId`: Session/device-scoped identity for device-specific state (e.g., GenerationStore).
 *   Derived from session ID, unique per device. Must remain stable across token refresh.
 */
export interface AuthResult {
  userId: string;
  principalId: string;
}

/**
 * AuthProvider defines how the server authenticates requests.
 * Implementations can use stub auth (CE default), Better Auth, or custom logic.
 */
export interface AuthProvider {
  /**
   * Authenticates a request and returns user info or null if unauthorized.
   * Identity must come from validating the bearer session, not from arbitrary headers.
   */
  authenticate(request: Request): Promise<AuthResult | null>;
}
