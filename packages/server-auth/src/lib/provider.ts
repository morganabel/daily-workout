/**
 * BetterAuthProvider - AuthProvider implementation using Better Auth
 *
 * Validates Better Auth sessions (cookie-first; bearer supported as fallback) and returns AuthResult
 * with userId (account-level) and principalId (device/session-scoped).
 */

import type { AuthProvider, AuthResult } from '@workout-agent-ce/server-core';
import type { Auth } from './auth.js';

/**
 * AuthProvider implementation that uses Better Auth for session validation.
 *
 * Key behaviors:
 * - Validates bearer tokens against the session database
 * - Returns userId for billing/metering (account-scoped)
 * - Returns principalId derived from session ID (device-scoped)
 * - Ignores x-user-id and similar headers (identity from session only)
 */
export class BetterAuthProvider implements AuthProvider {
  constructor(private readonly auth: Auth) {}

  async authenticate(request: Request): Promise<AuthResult | null> {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    const hasCookie = Boolean(cookieHeader && cookieHeader.trim().length > 0);
    const hasBearer = Boolean(
      authHeader &&
        authHeader.toLowerCase().startsWith('bearer ') &&
        authHeader.substring(7).trim().length > 0
    );

    if (!hasCookie && !hasBearer) {
      return null;
    }

    try {
      // Validate session using Better Auth's API
      // This reads either the session cookie (default) or bearer token (if configured)
      const session = await this.auth.api.getSession({
        headers: request.headers,
      });

      if (!session || !session.session || !session.user) {
        return null;
      }

      // Return AuthResult with both identity types:
      // - userId: account-level identity for billing, metering
      // - principalId: session/device-scoped identity for GenerationStore
      //   Derived from session ID, stable across token refresh
      return {
        userId: session.user.id,
        principalId: session.session.id,
      };
    } catch (error) {
      // Session validation failed - don't log the token (security)
      console.warn('[BetterAuthProvider] Session validation failed');
      return null;
    }
  }
}
